from fastapi import APIRouter, Depends
from supabase import Client

from app.dependencies import get_current_user
from app.db.client import get_supabase
from app.utils.response import api_response
from app.settings.schemas import (
    BusinessHoursUpdate,
    DineInSettings,
    TakeawaySettings,
    DivertSettings,
    SmsSettings,
    CustomerNameSettings,
    AgentToggle,
    TimezoneUpdate,
)
from app.settings.service import (
    get_all_settings,
    update_business_hours,
    update_dine_in,
    update_takeaway,
    update_divert,
    update_sms,
    update_customer_name,
    update_agent_toggle,
    update_timezone,
)

router = APIRouter(prefix="/settings", tags=["Settings"])


def _restaurant(user: dict) -> tuple[str, bool]:
    r = user["restaurant"]
    return r["id"], r.get("agent_enabled", True)


@router.get("")
async def get_settings(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, agent_enabled = _restaurant(user)
    data = get_all_settings(db, restaurant_id, agent_enabled)
    return api_response(data=data.model_dump())


@router.put("/business-hours")
async def put_business_hours(
    body: BusinessHoursUpdate,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    hours = update_business_hours(db, restaurant_id, body.hours)
    return api_response(data=[h.model_dump() for h in hours])


@router.put("/dine-in")
async def put_dine_in(
    body: DineInSettings,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    updated = update_dine_in(db, restaurant_id, body)
    return api_response(data=updated)


@router.put("/takeaway")
async def put_takeaway(
    body: TakeawaySettings,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    updated = update_takeaway(db, restaurant_id, body)
    return api_response(data=updated)


@router.put("/divert")
async def put_divert(
    body: DivertSettings,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    updated = update_divert(db, restaurant_id, body)
    return api_response(data=updated)


@router.put("/sms")
async def put_sms(
    body: SmsSettings,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    updated = update_sms(db, restaurant_id, body)
    return api_response(data=updated)


@router.put("/customer-name")
async def put_customer_name(
    body: CustomerNameSettings,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    updated = update_customer_name(db, restaurant_id, body)
    return api_response(data=updated)


@router.put("/agent-toggle")
async def put_agent_toggle(
    body: AgentToggle,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    enabled = update_agent_toggle(db, restaurant_id, body.agent_enabled)
    return api_response(data={"agent_enabled": enabled})


@router.put("/timezone")
async def put_timezone(
    body: TimezoneUpdate,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id, _ = _restaurant(user)
    tz = update_timezone(db, restaurant_id, body.timezone)
    return api_response(data={"timezone": tz})
