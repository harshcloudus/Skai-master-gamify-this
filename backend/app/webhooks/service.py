import logging
from datetime import datetime, timezone
from supabase import Client

from app.db import models

logger = logging.getLogger(__name__)


def extract_call_data(payload: dict) -> dict:
    """Extract and normalize fields from the ElevenLabs post-call webhook payload.

    ElevenLabs sends a nested structure — this pulls out the fields we need and
    maps them to our calls table columns.  The exact payload shape may vary, so
    we defensively use .get() throughout.
    """
    data = payload.get("data", payload)
    conversation_id = data.get("conversation_id", payload.get("conversation_id", ""))
    agent_id = data.get("agent_id", payload.get("agent_id", ""))

    analysis = data.get("analysis", {})
    transcript_summary = analysis.get("transcript_summary", data.get("transcript_summary", ""))

    transcript = data.get("transcript", payload.get("transcript", []))

    metadata = data.get("metadata", {})
    call_duration = data.get("call_duration_secs", metadata.get("call_duration_secs"))
    call_status = data.get("status", metadata.get("status", "completed"))

    conversation_initiation_data = data.get("conversation_initiation_client_data", {})
    dynamic_vars = conversation_initiation_data.get("dynamic_variables", {})

    caller_number = dynamic_vars.get("system__caller_id") or dynamic_vars.get("caller_number") or ""
    call_sid = dynamic_vars.get("system__call_sid") or dynamic_vars.get("call_sid") or ""

    start_time_str = metadata.get("start_time", data.get("start_time_unix_secs"))
    call_started_at = _parse_timestamp(start_time_str)
    call_ended_at = datetime.now(timezone.utc)

    return {
        "conversation_id": conversation_id,
        "agent_id": agent_id,
        "transcript": transcript,
        "summary": transcript_summary,
        "call_duration_seconds": int(call_duration) if call_duration else None,
        "call_status": call_status,
        "caller_number": caller_number,
        "call_sid": call_sid,
        "call_started_at": call_started_at.isoformat() if call_started_at else None,
        "call_ended_at": call_ended_at.isoformat(),
    }


def _parse_timestamp(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def save_call_record(db: Client, restaurant_id: str, call_data: dict) -> dict:
    """Insert a new row into the calls table and return the created record."""
    row = {
        "restaurant_id": restaurant_id,
        "twilio_call_sid": call_data["call_sid"] or None,
        "elevenlabs_conversation_id": call_data["conversation_id"],
        "phone_number": call_data["caller_number"] or None,
        "call_status": call_data["call_status"],
        "call_duration_seconds": call_data["call_duration_seconds"],
        "transcript": call_data["transcript"],
        "summary": call_data["summary"],
        "has_order": False,
        "order_parse_status": "pending",
        "call_started_at": call_data["call_started_at"],
        "call_ended_at": call_data["call_ended_at"],
    }

    result = db.table(models.CALLS).insert(row).execute()
    if not result.data:
        logger.error("Failed to insert call record for conversation %s", call_data["conversation_id"])
        return {}
    logger.info(
        "Saved call record %s for conversation %s",
        result.data[0]["id"],
        call_data["conversation_id"],
    )
    return result.data[0]
