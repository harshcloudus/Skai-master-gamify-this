from datetime import date, datetime, time, timedelta, timezone as dt_timezone

from dateutil import tz


def now_in_tz(timezone_str: str) -> datetime:
    """Get current datetime in the given timezone."""
    return datetime.now(tz.gettz(timezone_str))


def local_date_key_from_iso(iso_timestamp: str, timezone_str: str) -> str:
    """Return YYYY-MM-DD calendar date in `timezone_str` for a call timestamp.

    DB/API timestamps are typically UTC. Bucketing by ``iso_timestamp[:10]`` would
    count the wrong day vs. UIs that show times in the restaurant timezone.
    """
    tzinfo = tz.gettz(timezone_str)
    if tzinfo is None:
        return iso_timestamp[:10]
    normalized = iso_timestamp.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return iso_timestamp[:10]
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_timezone.utc)
    return dt.astimezone(tzinfo).strftime("%Y-%m-%d")


def utc_range_for_local_date(
    day: str,
    timezone_str: str,
    *,
    end_of_day: bool,
) -> str:
    """Return an ISO timestamp in UTC for the start/end of a local calendar day.

    - `day` must be YYYY-MM-DD (restaurant-local).
    - If `end_of_day` is False: returns local midnight converted to UTC.
    - If `end_of_day` is True: returns last microsecond of local day converted to UTC.
    """
    tzinfo = tz.gettz(timezone_str)
    if tzinfo is None:
        # Fallback: behave like previous naive "YYYY-MM-DDT.."
        return f"{day}T23:59:59" if end_of_day else f"{day}T00:00:00"

    y, m, d = day.split("-")
    local_midnight = datetime(int(y), int(m), int(d), 0, 0, 0, tzinfo=tzinfo)
    local_dt = (
        local_midnight + timedelta(days=1) - timedelta(microseconds=1)
        if end_of_day
        else local_midnight
    )
    return local_dt.astimezone(dt_timezone.utc).isoformat()


def is_within_hours(current_time: time, open_time: time | None, close_time: time | None) -> bool:
    """Check if current_time falls between open_time and close_time.
    Returns False if either bound is None (day is closed).
    Handles overnight ranges (e.g. 18:00 - 02:00).
    """
    if open_time is None or close_time is None:
        return False

    if open_time <= close_time:
        return open_time <= current_time <= close_time
    # Overnight span
    return current_time >= open_time or current_time <= close_time
