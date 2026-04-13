import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.db.client import get_supabase
from app.dependencies import get_current_user, verify_webhook_secret
from app.utils.response import api_response
from app.menu.schemas import (
    MenuMatchRequest,
    MenuMatchResponse,
    MatchedMenuItem,
    MenuItemResponse,
    MenuItemUpdate,
)
from app.menu.embeddings import generate_query_embedding, search_menu_items
from app.menu.service import get_menu_items, update_menu_item, resync_all_embeddings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/menu", tags=["Menu"])


# ── CRUD ──────────────────────────────────────────────────


@router.get("/items")
async def list_menu_items(
    search: str | None = Query(None, description="Search by name"),
    active: bool | None = Query(None, description="Filter by active status"),
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id = user["restaurant"]["id"]
    items = get_menu_items(db, restaurant_id, search=search, active=active)
    return api_response(data=items)


@router.patch("/items/{item_id}")
async def patch_menu_item(
    item_id: str,
    body: MenuItemUpdate,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant_id = user["restaurant"]["id"]

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    updated = update_menu_item(db, restaurant_id, item_id, updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found",
        )

    return api_response(data=updated)


@router.post("/resync")
async def resync_menu(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    """Stub for POS sync. Regenerates embeddings for all menu items."""
    restaurant_id = user["restaurant"]["id"]
    count = resync_all_embeddings(db, restaurant_id)
    return api_response(data={"items_processed": count}, message="Resync complete")


# ── Vector match (protected by webhook secret) ───────────


@router.post(
    "/items/match",
    response_model=MenuMatchResponse,
    dependencies=[Depends(verify_webhook_secret)],
)
async def match_menu_items(
    body: MenuMatchRequest,
    db: Client = Depends(get_supabase),
):
    """Vector similarity search for menu items.

    Used by the ElevenLabs agent custom tool during live calls.
    Protected by webhook secret. Requires restaurant_id.
    """
    restaurant_id = body.restaurant_id
    if not restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="restaurant_id is required",
        )

    try:
        query_embedding = generate_query_embedding(body.query)
    except Exception as e:
        logger.error("Embedding generation failed for query '%s': %s", body.query, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate embedding for query",
        )

    results = search_menu_items(
        db=db,
        query_embedding=query_embedding,
        restaurant_id=restaurant_id,
        match_threshold=body.match_threshold,
        match_count=body.match_count,
    )

    matches = [
        MatchedMenuItem(
            id=row["id"],
            pos_name=row["pos_name"],
            title=row.get("title"),
            description=row.get("description"),
            price=float(row["price"]),
            similarity=float(row["similarity"]),
        )
        for row in results
    ]

    return MenuMatchResponse(matches=matches, query=body.query)
