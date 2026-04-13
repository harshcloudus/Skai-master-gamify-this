"""Dashboard KPIs, calls graph, and recent activity.

The calls graph buckets counts by calendar day in the restaurant timezone (same idea
as the Calls list UI). KPIs (revenue, orders) are all-time totals; graph is last 7 days.
"""

import logging
from collections import Counter
from datetime import timedelta

from supabase import Client

from app.db import models
from app.utils.timezone import local_date_key_from_iso, now_in_tz
from app.dashboard.schemas import (
    KPIValue,
    KPIs,
    CallGraphPoint,
    RecentActivityItem,
    DashboardOverview,
)

logger = logging.getLogger(__name__)

DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def get_dashboard_overview(db: Client, restaurant_id: str, timezone: str) -> DashboardOverview:
    now = now_in_tz(timezone)

    kpis = _compute_kpis(db, restaurant_id)
    calls_graph = _build_calls_graph(db, restaurant_id, now, timezone)
    recent_activity = _get_recent_activity(db, restaurant_id)

    return DashboardOverview(kpis=kpis, calls_graph=calls_graph, recent_activity=recent_activity)


def _compute_kpis(db: Client, restaurant_id: str) -> KPIs:
    """All-time revenue and order count for this restaurant."""
    result = (
        db.table(models.ORDERS)
        .select("total_amount")
        .eq("restaurant_id", restaurant_id)
        .execute()
    )
    orders = result.data or []
    total_orders = len(orders)
    revenue = sum(float(o["total_amount"]) for o in orders)

    return KPIs(
        revenue=KPIValue(value=revenue),
        total_orders=KPIValue(value=total_orders),
        labor_hours_saved=KPIValue(value=None),
    )


def _build_calls_graph(db: Client, restaurant_id: str, now, timezone_str: str) -> list[CallGraphPoint]:
    """Count calls per day for the past 7 days (days = restaurant local midnight boundaries)."""
    start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)

    result = (
        db.table(models.CALLS)
        .select("created_at")
        .eq("restaurant_id", restaurant_id)
        .gte("created_at", start.isoformat())
        .order("created_at")
        .execute()
    )
    rows = result.data or []

    date_counts: Counter[str] = Counter()
    for row in rows:
        date_key = local_date_key_from_iso(row["created_at"], timezone_str)
        date_counts[date_key] += 1

    points: list[CallGraphPoint] = []
    for i in range(7):
        day = start + timedelta(days=i)
        date_key = day.strftime("%Y-%m-%d")
        points.append(
            CallGraphPoint(
                date=date_key,
                day=DAY_ABBR[day.weekday()],
                call_count=date_counts.get(date_key, 0),
            )
        )

    return points


def _get_recent_activity(db: Client, restaurant_id: str) -> list[RecentActivityItem]:
    """Latest 6 calls with order value joined."""
    result = (
        db.table(models.CALLS)
        .select("id, phone_number, call_status, created_at, orders(total_amount)")
        .eq("restaurant_id", restaurant_id)
        .order("created_at", desc=True)
        .limit(6)
        .execute()
    )
    rows = result.data or []

    items: list[RecentActivityItem] = []
    for row in rows:
        order_list = row.get("orders") or []
        order_value = float(order_list[0]["total_amount"]) if order_list else None

        items.append(
            RecentActivityItem(
                id=row["id"],
                phone_number=row.get("phone_number"),
                order_value=order_value,
                time=row["created_at"],
                call_status=row["call_status"],
            )
        )

    return items
