import logging
from fastapi import APIRouter, Depends, Form, HTTPException, Response, status
from fastapi.responses import JSONResponse
from app.db.client import get_supabase
from app.db import models
from app.dependencies import (
    verify_twilio_signature,
    verify_webhook_secret,
    lookup_restaurant_by_agent_id,
)
from app.telephony.service import (
    lookup_restaurant_by_twilio_number,
    get_business_hours,
    get_restaurant_settings,
    is_restaurant_open,
    check_takeaway_availability,
    build_personalization_response,
    build_stream_twiml,
    build_closed_twiml,
)
from app.telephony.schemas import (
    TakeawayCheckRequest,
    TakeawayCheckResponse,
    PersonalizeRequest,
)
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telephony", tags=["Telephony"])


@router.post("/incoming", dependencies=[Depends(verify_twilio_signature)])
async def incoming_call(
    CallSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    db: Client = Depends(get_supabase),
):
    """Twilio voice webhook — check business hours + agent toggle, return TwiML."""
    logger.info("Incoming call: CallSid=%s From=%s To=%s", CallSid, From, To)

    restaurant = lookup_restaurant_by_twilio_number(db, To)
    if not restaurant:
        logger.warning("No restaurant found for number %s", To)
        return Response(content=build_closed_twiml(), media_type="application/xml")

    if not restaurant.get("agent_enabled", False):
        logger.info("Agent disabled for restaurant %s", restaurant["id"])
        return Response(content=build_closed_twiml(), media_type="application/xml")

    agent_id = restaurant.get("elevenlabs_agent_id")
    if not agent_id:
        logger.error("No ElevenLabs agent_id configured for restaurant %s", restaurant["id"])
        return Response(content=build_closed_twiml(), media_type="application/xml")

    hours = get_business_hours(db, restaurant["id"])
    is_open = is_restaurant_open(restaurant, hours)
    settings = get_restaurant_settings(db, restaurant["id"])

    if not is_open:
        take_after_hours = settings.get("dinein_take_reservations_after_hours", False)
        if not take_after_hours:
            logger.info("Restaurant %s is currently closed", restaurant["id"])
            return Response(content=build_closed_twiml(), media_type="application/xml")
        logger.info("Restaurant %s is closed but after-hours reservations enabled", restaurant["id"])

    after_hours = not is_open
    twiml = build_stream_twiml(
        agent_id=agent_id,
        caller_number=From,
        call_sid=CallSid,
        dinein_transfer_enabled=settings.get("dinein_transfer_enabled", False),
        dinein_max_hourly_capacity=settings.get("dinein_max_hourly_capacity"),
        divert_enabled=settings.get("divert_enabled", False),
        divert_threshold_amount=settings.get("divert_threshold_amount", 0),
        after_hours=after_hours,
        ask_customer_name=settings.get("ask_customer_name", False),
    )
    logger.info("Streaming call %s to ElevenLabs agent %s (after_hours=%s)", CallSid, agent_id, after_hours)
    return Response(content=twiml, media_type="application/xml")


# ── ElevenLabs Twilio personalization webhook ──


@router.post("/personalize", dependencies=[Depends(verify_webhook_secret)])
async def personalize_call(
    body: PersonalizeRequest,
    db: Client = Depends(get_supabase),
):
    """ElevenLabs personalization webhook for inbound Twilio calls.

    Called by ElevenLabs (native Twilio integration) when a call arrives.
    Returns dynamic variables (dine-in, divert settings) or a closed-override
    so the agent knows the restaurant's current state.
    """
    logger.info(
        "Personalize webhook: caller_id=%s agent_id=%s called_number=%s call_sid=%s",
        body.caller_id, body.agent_id, body.called_number, body.call_sid,
    )

    restaurant = lookup_restaurant_by_agent_id(db, body.agent_id)
    if not restaurant:
        restaurant = lookup_restaurant_by_twilio_number(db, body.called_number)

    if not restaurant:
        logger.warning("No restaurant found for agent_id=%s or number=%s", body.agent_id, body.called_number)
        return JSONResponse(content=build_personalization_response(
            None, False, {},
            caller_id=body.caller_id, call_sid=body.call_sid,
        ))

    hours = get_business_hours(db, restaurant["id"])
    is_open = is_restaurant_open(restaurant, hours)
    agent_enabled = restaurant.get("agent_enabled", False)

    # Always fetch settings when agent is enabled so we can check after-hours toggle
    settings = get_restaurant_settings(db, restaurant["id"]) if agent_enabled else {}

    after_hours = not is_open
    response_data = build_personalization_response(
        restaurant, is_open, settings,
        caller_id=body.caller_id, call_sid=body.call_sid,
        after_hours=after_hours,
    )
    logger.info(
        "Personalize response for restaurant %s: open=%s after_hours=%s",
        restaurant["id"], is_open, after_hours,
    )
    return JSONResponse(content=response_data)


# ── Agent tool: takeaway availability ─────────────────────


@router.post(
    "/check-takeaway",
    response_model=TakeawayCheckResponse,
    dependencies=[Depends(verify_webhook_secret)],
)
async def check_takeaway(
    body: TakeawayCheckRequest,
    db: Client = Depends(get_supabase),
):
    """Check whether takeaway orders are currently accepted.

    Used by the ElevenLabs agent custom tool during live calls.
    Protected by webhook secret. Requires restaurant_id.
    """
    restaurant_id = body.restaurant_id
    if not restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="restaurant_id is required",
        )

    restaurant = (
        db.table(models.RESTAURANTS)
        .select("*")
        .eq("id", restaurant_id)
        .maybe_single()
        .execute()
    ).data
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )

    settings = get_restaurant_settings(db, restaurant_id)
    hours = get_business_hours(db, restaurant_id)

    result = check_takeaway_availability(restaurant, settings, hours)
    return TakeawayCheckResponse(**result)
