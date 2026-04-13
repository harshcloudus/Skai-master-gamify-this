import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from supabase import Client

from app.dependencies import get_current_user
from app.db.client import get_supabase
from app.db import models
from app.config import get_settings, Settings
from app.utils.response import api_response, paginated_response
from app.calls.service import get_calls_list, get_call_detail, get_elevenlabs_conversation_id
from app.calls.elevenlabs import (
    fetch_conversation_audio,
    list_conversations,
    get_conversation_detail,
)
from app.calls.sync import sync_conversations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calls", tags=["Calls"])


# ── ElevenLabs live-query endpoints (static paths first) ─


@router.get("/elevenlabs/conversations")
async def elevenlabs_conversations(
    page_size: int = Query(30, ge=1, le=100),
    cursor: str | None = Query(None, description="Pagination cursor from previous response"),
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Fetch conversations directly from the ElevenLabs API.

    Queries the restaurant's agent_id so results are scoped to this restaurant.
    """
    restaurant = user["restaurant"]
    agent_id = _get_agent_id(db, restaurant["id"])

    data = await list_conversations(
        settings.elevenlabs_api_key,
        agent_id=agent_id,
        page_size=page_size,
        cursor=cursor,
    )

    return api_response(data=data)


@router.get("/elevenlabs/conversations/{conversation_id}")
async def elevenlabs_conversation_detail(
    conversation_id: str,
    user: dict = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Fetch full conversation detail (transcript, analysis, metadata) from ElevenLabs."""
    try:
        detail = await get_conversation_detail(
            settings.elevenlabs_api_key, conversation_id,
        )
    except Exception as e:
        logger.error("ElevenLabs conversation fetch failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch conversation from ElevenLabs",
        )

    return api_response(data=detail)


@router.post("/sync")
async def sync_from_elevenlabs(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Pull all conversations from ElevenLabs and import any missing ones.

    Compares the ElevenLabs conversation list against the local calls table
    and inserts new records.  Also runs the order parsing pipeline on
    newly imported calls.
    """
    restaurant = user["restaurant"]
    restaurant_id = restaurant["id"]
    agent_id = _get_agent_id(db, restaurant_id)

    result = await sync_conversations(
        db,
        settings.elevenlabs_api_key,
        restaurant_id,
        agent_id,
    )

    return api_response(data=result)


# ── Local DB endpoints ────────────────────────────────────


@router.get("")
async def list_calls(
    search: str | None = Query(None, description="Search by phone number"),
    orders_only: bool = Query(False, description="Only calls with orders"),
    order_type: str | None = Query(None, description="Filter by order type: dine-in, takeaway"),
    date_from: str | None = Query(None, description="Filter from date (ISO 8601)"),
    date_to: str | None = Query(None, description="Filter to date (ISO 8601)"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id = user["restaurant"]["id"]
    timezone_str = user["restaurant"]["timezone"]

    items, total = get_calls_list(
        db,
        restaurant_id,
        timezone_str=timezone_str,
        search=search,
        orders_only=orders_only,
        order_type=order_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        limit=limit,
    )

    return paginated_response(
        data=[item.model_dump() for item in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{call_id}/details")
async def call_details(
    call_id: str,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id = user["restaurant"]["id"]
    detail = get_call_detail(db, restaurant_id, call_id)

    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found",
        )

    return api_response(data=detail.model_dump())


@router.get("/{call_id}/audio")
async def call_audio(
    call_id: str,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> Response:
    restaurant_id = user["restaurant"]["id"]
    conversation_id = get_elevenlabs_conversation_id(db, restaurant_id, call_id)

    if not conversation_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found or no conversation ID available",
        )

    response = await fetch_conversation_audio(settings.elevenlabs_api_key, conversation_id)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="Failed to fetch audio from ElevenLabs",
        )

    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "audio/mpeg"),
        headers={"Content-Disposition": f'inline; filename="call_{call_id}.mp3"'},
    )


# ── Helpers ──────────────────────────────────────────────


def _get_agent_id(db: Client, restaurant_id: str) -> str:
    """Resolve the ElevenLabs agent_id for a restaurant, or raise 422."""
    result = (
        db.table(models.RESTAURANTS)
        .select("elevenlabs_agent_id")
        .eq("id", restaurant_id)
        .maybe_single()
        .execute()
    )
    agent_id = (result.data or {}).get("elevenlabs_agent_id")
    if not agent_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No ElevenLabs agent configured for this restaurant. "
                   "Set elevenlabs_agent_id in the restaurants table first.",
        )
    return agent_id
