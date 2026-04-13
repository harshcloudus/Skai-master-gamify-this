from datetime import time, timedelta
from supabase import Client
from twilio.twiml.voice_response import VoiceResponse, Connect

from app.db import models
from app.utils.timezone import now_in_tz, is_within_hours


def lookup_restaurant_by_twilio_number(db: Client, to_number: str) -> dict | None:
    """Find the restaurant whose twilio_phone_number matches the dialed number."""
    result = (
        db.table(models.RESTAURANTS)
        .select("*")
        .eq("twilio_phone_number", to_number)
        .maybe_single()
        .execute()
    )
    if result is None:
        return None
    return result.data


def get_business_hours(db: Client, restaurant_id: str) -> list[dict]:
    result = (
        db.table(models.BUSINESS_HOURS)
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .execute()
    )
    return result.data or []


def is_restaurant_open(restaurant: dict, hours_rows: list[dict]) -> bool:
    """Check if the restaurant is currently open based on its timezone + business hours."""
    timezone_str = restaurant.get("timezone", "America/New_York")
    now = now_in_tz(timezone_str)
    current_day = now.weekday()  # 0=Monday … 6=Sunday
    current_time = now.time()

    for row in hours_rows:
        if row["day_of_week"] == current_day:
            open_time = _parse_time(row.get("open_time"))
            close_time = _parse_time(row.get("close_time"))
            return is_within_hours(current_time, open_time, close_time)

    return False


def _parse_time(value: str | None) -> time | None:
    if value is None:
        return None
    parts = value.split(":")
    return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)


def build_stream_twiml(
    agent_id: str,
    caller_number: str,
    call_sid: str,
    dinein_transfer_enabled: bool = False,
    dinein_max_hourly_capacity: int | None = None,
    divert_enabled: bool = False,
    divert_threshold_amount: float = 0,
    after_hours: bool = False,
    ask_customer_name: bool = False,
) -> str:
    """Build TwiML that streams audio to ElevenLabs with caller metadata and restaurant settings."""
    response = VoiceResponse()
    connect = Connect()
    stream = connect.stream(
        url=f"wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}"
    )
    stream.parameter(name="caller_number", value=caller_number)
    stream.parameter(name="call_sid", value=call_sid)
    stream.parameter(name="dinein_transfer_enabled", value=str(dinein_transfer_enabled).lower())
    stream.parameter(name="dinein_max_hourly_capacity", value=str(dinein_max_hourly_capacity or 0))
    stream.parameter(name="divert_enabled", value=str(divert_enabled).lower())
    stream.parameter(name="divert_threshold_amount", value=str(divert_threshold_amount))
    stream.parameter(name="after_hours", value=str(after_hours).lower())
    stream.parameter(name="ask_customer_name", value=str(ask_customer_name).lower())
    response.append(connect)
    return str(response)


def check_takeaway_availability(
    restaurant: dict,
    settings: dict,
    hours_rows: list[dict],
) -> dict:
    """Determine if takeaway orders can be accepted right now.

    Toggle OFF  → accept orders until closing time (no early cutoff).
    Toggle ON   → apply the stop-minutes-before-close cutoff.

    Returns {"allowed": bool, "reason": str}.
    """
    timezone_str = restaurant.get("timezone", "America/New_York")
    now = now_in_tz(timezone_str)
    current_day = now.weekday()
    current_time = now.time()

    close_time = None
    for row in hours_rows:
        if row["day_of_week"] == current_day:
            close_time = _parse_time(row.get("close_time"))
            break

    if close_time is None:
        return {"allowed": False, "reason": "The restaurant is closed today so takeaway orders cannot be accepted."}

    takeaway_enabled = settings.get("takeaway_enabled", False)

    if not takeaway_enabled:
        return {"allowed": True, "reason": "Takeaway orders are being accepted until closing time."}

    stop_minutes = settings.get("takeaway_stop_minutes_before_close", 0)
    if stop_minutes <= 0:
        return {"allowed": True, "reason": "Takeaway orders are being accepted."}

    close_dt = now.replace(hour=close_time.hour, minute=close_time.minute, second=close_time.second)
    cutoff_dt = close_dt - timedelta(minutes=stop_minutes)
    cutoff_time = cutoff_dt.time()

    if current_time >= cutoff_time:
        return {
            "allowed": False,
            "reason": (
                f"The kitchen stops accepting takeaway orders {stop_minutes} minutes before closing. "
                f"Closing time today is {close_time.strftime('%H:%M')} and the cutoff was {cutoff_time.strftime('%H:%M')}."
            ),
        }

    return {"allowed": True, "reason": "Takeaway orders are being accepted."}


def get_restaurant_settings(db: Client, restaurant_id: str) -> dict:
    result = (
        db.table(models.RESTAURANT_SETTINGS)
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .maybe_single()
        .execute()
    )
    return result.data or {}


def build_personalization_response(
    restaurant: dict | None,
    is_open: bool,
    settings: dict,
    caller_id: str = "",
    call_sid: str = "",
    after_hours: bool = False,
) -> dict:
    """Build the conversation_initiation_client_data response for ElevenLabs.

    If the agent is disabled, or the restaurant is closed and the after-hours
    dine-in toggle is off, returns a closed override. Otherwise returns dynamic
    variables including after_hours and ask_customer_name flags.
    """
    agent_enabled = restaurant.get("agent_enabled", False) if restaurant else False
    take_after_hours = settings.get("dinein_take_reservations_after_hours", False)

    should_close = (
        not restaurant
        or not agent_enabled
        or (not is_open and not take_after_hours)
    )

    if should_close:
        return {
            "type": "conversation_initiation_client_data",
            "dynamic_variables": {
                "caller_number": caller_id,
                "call_sid": call_sid,
            },
            "conversation_config_override": {
                "agent": {
                    "prompt": {
                        "prompt": (
                            "The restaurant is currently closed or the agent is disabled. "
                            "Politely inform the caller that the restaurant is closed right now "
                            "and ask them to call back during business hours. "
                            "Do not take any orders."
                        ),
                    },
                    "first_message": (
                        "Sorry, we are currently closed. "
                        "Please call back during our business hours. Thank you!"
                    ),
                },
            },
        }

    dinein_transfer_enabled = settings.get("dinein_transfer_enabled", False)
    dinein_max_hourly_capacity = settings.get("dinein_max_hourly_capacity") or 0
    divert_enabled = settings.get("divert_enabled", False)
    divert_threshold_amount = settings.get("divert_threshold_amount", 0)
    ask_customer_name = settings.get("ask_customer_name", False)

    return {
        "type": "conversation_initiation_client_data",
        "dynamic_variables": {
            "caller_number": caller_id,
            "call_sid": call_sid,
            "dinein_transfer_enabled": str(dinein_transfer_enabled).lower(),
            "dinein_max_hourly_capacity": str(dinein_max_hourly_capacity),
            "divert_enabled": str(divert_enabled).lower(),
            "divert_threshold_amount": str(divert_threshold_amount),
            "after_hours": str(after_hours).lower(),
            "ask_customer_name": str(ask_customer_name).lower(),
        },
    }


def build_closed_twiml() -> str:
    """Build TwiML response for when the restaurant is closed or agent is disabled."""
    response = VoiceResponse()
    response.say(
        "Sorry, we are currently closed. Please call back during our business hours.",
        voice="Polly.Joanna",
    )
    return str(response)
