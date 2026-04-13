"""Order creation pipeline.

Full post-call flow:
1. Parse transcript via Gemini → extract spoken items + order_type
2. For each item, generate embedding → pgvector match → resolve to real menu item + DB price
3. Save order + order_items to DB
4. Update call record (has_order = true, order_parse_status)
"""

import logging
from supabase import Client

from app.db import models
from app.orders.parser import parse_transcript
from app.orders.schemas import ParsedOrder, ParseStatus, ResolvedOrderItem
from app.menu.embeddings import generate_query_embedding, search_menu_items

logger = logging.getLogger(__name__)


def process_call_order(db: Client, call_record: dict) -> dict | None:
    """Run the full order-parsing pipeline for a completed call.

    Returns the saved order dict, or None if no order was detected.
    Updates call.order_parse_status to reflect the pipeline outcome.
    """
    call_id = call_record["id"]

    transcript = call_record.get("transcript")
    if not transcript:
        logger.info("Call %s has no transcript — skipping order parsing", call_id)
        update_parse_status(db, call_id, ParseStatus.SKIPPED)
        return None

    call_status = call_record.get("call_status", "")
    if call_status not in ("completed", "done"):
        logger.info("Call %s status is '%s' — skipping order parsing", call_id, call_status)
        update_parse_status(db, call_id, ParseStatus.SKIPPED)
        return None

    parsed = parse_transcript(transcript)

    # Save customer name to calls table as soon as it's extracted,
    # regardless of whether an order exists.
    if parsed.customer_name:
        update_call_customer_name(db, call_id, parsed.customer_name)

    if parsed.error:
        logger.error("Call %s — parser error: %s", call_id, parsed.error)
        update_parse_status(db, call_id, ParseStatus.PARSE_ERROR)
        return None

    if not parsed.has_order or not parsed.items:
        logger.info("Call %s — parser found no order", call_id)
        update_parse_status(db, call_id, ParseStatus.NO_ORDER)
        return None

    restaurant_id = call_record["restaurant_id"]

    try:
        resolved_items = resolve_order_items(db, parsed, restaurant_id)
    except Exception as e:
        logger.error("Call %s — item resolution failed: %s", call_id, e)
        update_parse_status(db, call_id, ParseStatus.RESOLVE_ERROR)
        return None

    total_amount = sum(item.subtotal for item in resolved_items)

    order = save_order(
        db=db,
        restaurant_id=restaurant_id,
        call_id=call_id,
        phone_number=call_record.get("phone_number"),
        customer_name=parsed.customer_name,
        order_type=parsed.order_type,
        total_amount=total_amount,
        items=resolved_items,
        raw_parsed_data=parsed.model_dump(),
    )

    if order:
        mark_call_has_order(db, call_id)
        update_parse_status(db, call_id, ParseStatus.SUCCESS)
    else:
        update_parse_status(db, call_id, ParseStatus.SAVE_ERROR)

    return order


def resolve_order_items(
    db: Client, parsed: ParsedOrder, restaurant_id: str
) -> list[ResolvedOrderItem]:
    """For each parsed item, run pgvector matching to find the real menu item."""
    resolved = []

    for parsed_item in parsed.items:
        try:
            query_embedding = generate_query_embedding(parsed_item.item_name)
            matches = search_menu_items(
                db=db,
                query_embedding=query_embedding,
                restaurant_id=restaurant_id,
                match_threshold=0.6,
                match_count=1,
            )
        except Exception as e:
            logger.warning("Embedding/search failed for '%s': %s", parsed_item.item_name, e)
            matches = []

        if matches:
            best = matches[0]
            unit_price = float(best["price"])
            resolved.append(
                ResolvedOrderItem(
                    menu_item_id=best["id"],
                    item_name=best.get("title") or best["pos_name"],
                    quantity=parsed_item.quantity,
                    unit_price=unit_price,
                    subtotal=unit_price * parsed_item.quantity,
                    modifiers=parsed_item.modifiers,
                    matched=True,
                )
            )
        else:
            # Fallback: save with the spoken name and AI-estimated price
            estimated = parsed_item.estimated_price or 0.0
            resolved.append(
                ResolvedOrderItem(
                    menu_item_id=None,
                    item_name=parsed_item.item_name,
                    quantity=parsed_item.quantity,
                    unit_price=estimated,
                    subtotal=estimated * parsed_item.quantity,
                    modifiers=parsed_item.modifiers,
                    matched=False,
                )
            )
            logger.warning(
                "No menu match for '%s' — saved with fallback price %.2f",
                parsed_item.item_name,
                estimated,
            )

    return resolved


def save_order(
    db: Client,
    restaurant_id: str,
    call_id: str,
    phone_number: str | None,
    customer_name: str | None,
    order_type: str,
    total_amount: float,
    items: list[ResolvedOrderItem],
    raw_parsed_data: dict,
) -> dict | None:
    """Insert an order and its order_items into the database."""
    order_row = {
        "restaurant_id": restaurant_id,
        "call_id": call_id,
        "phone_number": phone_number,
        "customer_name": customer_name,
        "order_type": order_type,
        "total_amount": total_amount,
        "items_count": len(items),
        "raw_parsed_data": raw_parsed_data,
    }

    result = db.table(models.ORDERS).insert(order_row).execute()
    if not result.data:
        logger.error("Failed to insert order for call %s", call_id)
        return None

    order = result.data[0]
    order_id = order["id"]

    item_rows = [
        {
            "order_id": order_id,
            "menu_item_id": item.menu_item_id,
            "item_name": item.item_name,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "subtotal": item.subtotal,
            "modifiers": item.modifiers,
        }
        for item in items
    ]

    if item_rows:
        db.table(models.ORDER_ITEMS).insert(item_rows).execute()

    logger.info(
        "Saved order %s with %d items (total: $%.2f) for call %s",
        order_id, len(items), total_amount, call_id,
    )
    return order


def mark_call_has_order(db: Client, call_id: str):
    """Set has_order=true on the call record."""
    db.table(models.CALLS).update({"has_order": True}).eq("id", call_id).execute()


def update_parse_status(db: Client, call_id: str, status: ParseStatus):
    """Update the order_parse_status field on the call record."""
    db.table(models.CALLS).update({"order_parse_status": status.value}).eq("id", call_id).execute()


def update_call_customer_name(db: Client, call_id: str, customer_name: str):
    """Persist the customer's name on the call record once extracted from the transcript."""
    db.table(models.CALLS).update({"customer_name": customer_name}).eq("id", call_id).execute()
