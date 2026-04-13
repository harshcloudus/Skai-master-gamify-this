"""Sync ElevenLabs conversations into the local calls table.

Pulls conversations from the ElevenLabs API and upserts any that are
missing from the database.  Useful as a fallback when webhooks are missed
or for initial backfill.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from supabase import Client

from app.db import models
from app.calls.elevenlabs import (
    list_all_conversations,
    get_conversation_detail,
)
from app.orders.service import process_call_order

logger = logging.getLogger(__name__)


def _existing_conversation_ids(db: Client, restaurant_id: str) -> set[str]:
    """Return the set of elevenlabs_conversation_id values already in DB."""
    result = (
        db.table(models.CALLS)
        .select("elevenlabs_conversation_id")
        .eq("restaurant_id", restaurant_id)
        .not_.is_("elevenlabs_conversation_id", "null")
        .execute()
    )
    return {
        row["elevenlabs_conversation_id"]
        for row in (result.data or [])
        if row.get("elevenlabs_conversation_id")
    }


def _parse_timestamp(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    if isinstance(value, str):
        return value
    return None


def _build_call_row(
    restaurant_id: str,
    detail: dict[str, Any],
) -> dict[str, Any]:
    """Map an ElevenLabs conversation detail response to a calls table row."""
    conversation_id = detail.get("conversation_id", "")
    agent_id = detail.get("agent_id", "")
    status = detail.get("status", "completed")

    metadata = detail.get("metadata", {})
    call_duration = detail.get("call_duration_secs", metadata.get("call_duration_secs"))

    analysis = detail.get("analysis", {})
    summary = analysis.get("transcript_summary", "")
    transcript = detail.get("transcript", [])

    conversation_initiation_data = detail.get("conversation_initiation_client_data", {})
    dynamic_vars = conversation_initiation_data.get("dynamic_variables", {})
    caller_number = dynamic_vars.get("caller_number", "")
    call_sid = dynamic_vars.get("call_sid", "")

    start_ts = _parse_timestamp(
        metadata.get("start_time", detail.get("start_time_unix_secs"))
    )

    return {
        "restaurant_id": restaurant_id,
        "twilio_call_sid": call_sid or None,
        "elevenlabs_conversation_id": conversation_id,
        "phone_number": caller_number or None,
        "call_status": status,
        "call_duration_seconds": int(call_duration) if call_duration else None,
        "transcript": transcript,
        "summary": summary,
        "has_order": False,
        "call_started_at": start_ts,
        "call_ended_at": datetime.now(timezone.utc).isoformat(),
    }


async def sync_conversations(
    db: Client,
    api_key: str,
    restaurant_id: str,
    agent_id: str,
    *,
    run_order_parser: bool = True,
) -> dict[str, Any]:
    """Pull conversations from ElevenLabs and import missing ones.

    Returns a summary dict with counts of synced / skipped conversations.
    """
    existing = _existing_conversation_ids(db, restaurant_id)
    logger.info(
        "Sync: %d conversations already in DB for restaurant %s",
        len(existing), restaurant_id,
    )

    all_convos = await list_all_conversations(api_key, agent_id=agent_id)

    new_ids = [
        c["conversation_id"]
        for c in all_convos
        if c.get("conversation_id") and c["conversation_id"] not in existing
    ]
    logger.info("Sync: %d new conversations to import", len(new_ids))

    imported = 0
    errors = 0

    for conv_id in new_ids:
        try:
            detail = await get_conversation_detail(api_key, conv_id)
            row = _build_call_row(restaurant_id, detail)
            result = db.table(models.CALLS).insert(row).execute()

            if result.data:
                saved = result.data[0]
                imported += 1
                logger.info("Imported conversation %s as call %s", conv_id, saved["id"])

                if run_order_parser and saved.get("id"):
                    try:
                        process_call_order(db, saved)
                    except Exception as e:
                        logger.error("Order parsing failed for synced call %s: %s", saved["id"], e)
            else:
                errors += 1
                logger.warning("Insert returned no data for conversation %s", conv_id)

        except Exception as e:
            errors += 1
            logger.error("Failed to import conversation %s: %s", conv_id, e)

    return {
        "total_in_elevenlabs": len(all_convos),
        "already_in_db": len(existing),
        "newly_imported": imported,
        "errors": errors,
    }
