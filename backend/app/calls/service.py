"""Calls listing, detail retrieval, and query building."""

import logging
from supabase import Client

from app.db import models
from app.utils.timezone import utc_range_for_local_date
from app.calls.schemas import (
    CallListItem,
    CallDetail,
    OrderDetail,
    OrderItemDetail,
)

logger = logging.getLogger(__name__)

CALL_LIST_COLUMNS = (
    "id, phone_number, customer_name, call_status, call_duration_seconds, "
    "has_order, call_started_at, created_at, orders(total_amount, order_type, items_count)"
)

CALL_DETAIL_COLUMNS = (
    "id, phone_number, customer_name, call_status, call_duration_seconds, "
    "has_order, transcript, summary, call_started_at, call_ended_at, created_at, "
    "orders(id, order_type, total_amount, items_count, order_items(id, item_name, quantity, unit_price, subtotal, modifiers, menu_item_id))"
)


def _get_call_ids_for_order_type(db: Client, restaurant_id: str, order_type: str) -> list[str]:
    """Pre-fetch call IDs whose order matches the given type."""
    result = (
        db.table(models.ORDERS)
        .select("call_id")
        .eq("restaurant_id", restaurant_id)
        .ilike("order_type", order_type)
        .execute()
    )
    return [row["call_id"] for row in (result.data or []) if row.get("call_id")]


def get_calls_list(
    db: Client,
    restaurant_id: str,
    *,
    timezone_str: str,
    search: str | None = None,
    orders_only: bool = False,
    order_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[CallListItem], int]:
    """Return a paginated list of calls with optional filters."""
    offset = (page - 1) * limit

    query = (
        db.table(models.CALLS)
        .select(CALL_LIST_COLUMNS, count="exact")
        .eq("restaurant_id", restaurant_id)
    )

    if search:
        query = query.ilike("phone_number", f"%{search}%")

    if order_type:
        call_ids = _get_call_ids_for_order_type(db, restaurant_id, order_type)
        if not call_ids:
            return [], 0
        query = query.in_("id", call_ids)
    elif orders_only:
        query = query.eq("has_order", True)

    # Date filters are interpreted as restaurant-local calendar days and
    # converted to UTC instants for querying timestamptz values.
    if date_from:
        query = query.gte(
            "created_at",
            utc_range_for_local_date(date_from, timezone_str, end_of_day=False),
        )

    if date_to:
        query = query.lte(
            "created_at",
            utc_range_for_local_date(date_to, timezone_str, end_of_day=True),
        )

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    rows = result.data or []
    total = result.count or 0

    items: list[CallListItem] = []
    for row in rows:
        order_list = row.get("orders") or []
        order_value = float(order_list[0]["total_amount"]) if order_list else None
        row_order_type = order_list[0].get("order_type") if order_list else None
        items_count = order_list[0].get("items_count") if order_list else None

        items.append(
            CallListItem(
                id=row["id"],
                phone_number=row.get("phone_number"),
                customer_name=row.get("customer_name"),
                call_status=row["call_status"],
                call_duration_seconds=row.get("call_duration_seconds"),
                has_order=row["has_order"],
                order_value=order_value,
                order_type=row_order_type,
                items_count=items_count,
                call_started_at=row.get("call_started_at"),
                created_at=row["created_at"],
            )
        )

    return items, total


def get_call_detail(db: Client, restaurant_id: str, call_id: str) -> CallDetail | None:
    """Fetch a single call with transcript, summary, and order items."""
    result = (
        db.table(models.CALLS)
        .select(CALL_DETAIL_COLUMNS)
        .eq("id", call_id)
        .eq("restaurant_id", restaurant_id)
        .maybe_single()
        .execute()
    )

    row = result.data
    if not row:
        return None

    order_data = None
    order_list = row.get("orders") or []
    if order_list:
        o = order_list[0]
        raw_items = o.get("order_items") or []
        order_items = [
            OrderItemDetail(
                id=oi["id"],
                item_name=oi["item_name"],
                quantity=oi["quantity"],
                unit_price=float(oi["unit_price"]),
                subtotal=float(oi["subtotal"]),
                modifiers=oi.get("modifiers") or [],
                menu_item_id=oi.get("menu_item_id"),
            )
            for oi in raw_items
        ]
        order_data = OrderDetail(
            id=o["id"],
            order_type=o["order_type"],
            total_amount=float(o["total_amount"]),
            items_count=o["items_count"],
            items=order_items,
        )

    return CallDetail(
        id=row["id"],
        phone_number=row.get("phone_number"),
        customer_name=row.get("customer_name"),
        call_status=row["call_status"],
        call_duration_seconds=row.get("call_duration_seconds"),
        has_order=row["has_order"],
        transcript=row.get("transcript"),
        summary=row.get("summary"),
        call_started_at=row.get("call_started_at"),
        call_ended_at=row.get("call_ended_at"),
        created_at=row["created_at"],
        order=order_data,
    )


def get_elevenlabs_conversation_id(db: Client, restaurant_id: str, call_id: str) -> str | None:
    """Look up the ElevenLabs conversation ID for audio proxy."""
    result = (
        db.table(models.CALLS)
        .select("elevenlabs_conversation_id")
        .eq("id", call_id)
        .eq("restaurant_id", restaurant_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return None
    return result.data.get("elevenlabs_conversation_id")
