"""Settings CRUD — business hours, dine-in, takeaway, divert, SMS, agent toggle."""

import logging
from supabase import Client

from app.db import models
from app.settings.schemas import (
    DayHours,
    DineInSettings,
    TakeawaySettings,
    DivertSettings,
    SmsSettings,
    CustomerNameSettings,
    AllSettings,
)

logger = logging.getLogger(__name__)


def get_all_settings(db: Client, restaurant_id: str, agent_enabled: bool) -> AllSettings:
    """Load every settings section for one restaurant."""
    hours = _get_business_hours(db, restaurant_id)
    rs = _get_restaurant_settings(db, restaurant_id)

    return AllSettings(
        business_hours=hours,
        dine_in=DineInSettings(
            dinein_transfer_enabled=rs.get("dinein_transfer_enabled", False),
            dinein_max_hourly_capacity=rs.get("dinein_max_hourly_capacity") or 0,
            dinein_take_reservations_after_hours=rs.get("dinein_take_reservations_after_hours", False),
        ),
        takeaway=TakeawaySettings(
            takeaway_enabled=rs.get("takeaway_enabled", False),
            takeaway_stop_minutes_before_close=rs.get("takeaway_stop_minutes_before_close", 0),
        ),
        divert=DivertSettings(
            divert_enabled=rs.get("divert_enabled", False),
            divert_threshold_amount=float(rs.get("divert_threshold_amount", 0)),
        ),
        sms=SmsSettings(
            sms_order_ready_enabled=rs.get("sms_order_ready_enabled", False),
        ),
        customer_name=CustomerNameSettings(
            ask_customer_name=rs.get("ask_customer_name", False),
        ),
        agent_enabled=agent_enabled,
    )


# ── Business Hours ────────────────────────────────────────

def _get_business_hours(db: Client, restaurant_id: str) -> list[DayHours]:
    result = (
        db.table(models.BUSINESS_HOURS)
        .select("day_of_week, open_time, close_time")
        .eq("restaurant_id", restaurant_id)
        .order("day_of_week")
        .execute()
    )
    return [
        DayHours(
            day_of_week=row["day_of_week"],
            open_time=row.get("open_time"),
            close_time=row.get("close_time"),
        )
        for row in (result.data or [])
    ]


def update_business_hours(db: Client, restaurant_id: str, hours: list[DayHours]) -> list[DayHours]:
    """Upsert all 7 days of business hours."""
    for day in hours:
        row = {
            "restaurant_id": restaurant_id,
            "day_of_week": day.day_of_week,
            "open_time": day.open_time,
            "close_time": day.close_time,
        }
        db.table(models.BUSINESS_HOURS).upsert(
            row, on_conflict="restaurant_id,day_of_week"
        ).execute()

    return _get_business_hours(db, restaurant_id)


# ── Restaurant Settings helpers ───────────────────────────

def _get_restaurant_settings(db: Client, restaurant_id: str) -> dict:
    result = (
        db.table(models.RESTAURANT_SETTINGS)
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .maybe_single()
        .execute()
    )
    return result.data or {}


def _ensure_settings_row(db: Client, restaurant_id: str) -> dict:
    """Return existing settings row or create a default one."""
    existing = _get_restaurant_settings(db, restaurant_id)
    if existing:
        return existing

    result = (
        db.table(models.RESTAURANT_SETTINGS)
        .insert({"restaurant_id": restaurant_id})
        .execute()
    )
    return result.data[0] if result.data else {}


def _update_settings(db: Client, restaurant_id: str, updates: dict) -> dict:
    _ensure_settings_row(db, restaurant_id)
    result = (
        db.table(models.RESTAURANT_SETTINGS)
        .update(updates)
        .eq("restaurant_id", restaurant_id)
        .execute()
    )
    return result.data[0] if result.data else {}


# ── Section updaters ──────────────────────────────────────

def update_dine_in(db: Client, restaurant_id: str, data: DineInSettings) -> dict:
    return _update_settings(db, restaurant_id, data.model_dump())


def update_takeaway(db: Client, restaurant_id: str, data: TakeawaySettings) -> dict:
    return _update_settings(db, restaurant_id, data.model_dump())


def update_divert(db: Client, restaurant_id: str, data: DivertSettings) -> dict:
    return _update_settings(db, restaurant_id, data.model_dump())


def update_sms(db: Client, restaurant_id: str, data: SmsSettings) -> dict:
    return _update_settings(db, restaurant_id, data.model_dump())


def update_customer_name(db: Client, restaurant_id: str, data: CustomerNameSettings) -> dict:
    return _update_settings(db, restaurant_id, data.model_dump())


def update_agent_toggle(db: Client, restaurant_id: str, enabled: bool) -> bool:
    """Toggle agent_enabled on the restaurants table."""
    db.table(models.RESTAURANTS).update(
        {"agent_enabled": enabled}
    ).eq("id", restaurant_id).execute()
    return enabled


def update_timezone(db: Client, restaurant_id: str, timezone: str) -> str:
    """Update the restaurant's timezone on the restaurants table."""
    db.table(models.RESTAURANTS).update(
        {"timezone": timezone}
    ).eq("id", restaurant_id).execute()
    return timezone
