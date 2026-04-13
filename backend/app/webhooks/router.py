import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from supabase import Client

from app.db.client import get_supabase
from app.dependencies import verify_elevenlabs_signature, lookup_restaurant_by_agent_id
from app.webhooks.service import extract_call_data, save_call_record
from app.orders.service import process_call_order, update_parse_status
from app.orders.schemas import ParseStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def _run_order_pipeline(call_record: dict) -> None:
    """Background task: run the order-parsing pipeline for a saved call."""
    from app.db.client import get_supabase as _get_db
    db = _get_db()
    call_id = call_record["id"]
    try:
        process_call_order(db, call_record)
    except Exception as e:
        logger.error("Order parsing failed for call %s: %s", call_id, e, exc_info=True)
        update_parse_status(db, call_id, ParseStatus.PARSE_ERROR)


@router.post("/elevenlabs")
async def elevenlabs_post_call(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_supabase),
    event: dict = Depends(verify_elevenlabs_signature),
):
    """ElevenLabs post-call webhook.

    The elevenlabs-signature header is verified via HMAC before the handler
    runs. The parsed event payload is injected by verify_elevenlabs_signature.

    Persists a call record, then schedules the order-parsing pipeline as a
    background task so the webhook response is fast.
    """
    logger.info(
        "Received ElevenLabs webhook (type=%s)",
        event.get("type", "unknown"),
    )

    call_data = extract_call_data(event)

    if not call_data["conversation_id"]:
        logger.warning("Webhook payload missing conversation_id — skipping")
        return {"status": "skipped", "reason": "missing conversation_id"}

    agent_id = call_data.get("agent_id", "")
    restaurant = lookup_restaurant_by_agent_id(db, agent_id) if agent_id else None

    if not restaurant:
        logger.error(
            "No restaurant found for agent_id=%s, conversation=%s",
            agent_id,
            call_data["conversation_id"],
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No restaurant found for agent_id '{agent_id}'",
        )

    saved = save_call_record(db, restaurant["id"], call_data)

    if saved and saved.get("id"):
        background_tasks.add_task(_run_order_pipeline, saved)

    return {
        "status": "ok",
        "call_id": saved.get("id"),
        "conversation_id": call_data["conversation_id"],
    }
