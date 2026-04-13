"""Menu item CRUD and embedding management."""

import logging
from supabase import Client

from app.db import models
from app.menu.embeddings import build_embedding_text, generate_embedding

logger = logging.getLogger(__name__)


def get_menu_items(
    db: Client,
    restaurant_id: str,
    *,
    search: str | None = None,
    active: bool | None = None,
) -> list[dict]:
    """List menu items with optional search and active filter."""
    query = (
        db.table(models.MENU_ITEMS)
        .select("id, pos_name, title, description, price, category, is_active, pos_item_id, created_at, updated_at")
        .eq("restaurant_id", restaurant_id)
    )

    if active is not None:
        query = query.eq("is_active", active)

    if search:
        query = query.or_(f"pos_name.ilike.%{search}%,title.ilike.%{search}%")

    result = query.order("pos_name").execute()
    return result.data or []


def update_menu_item(
    db: Client,
    restaurant_id: str,
    item_id: str,
    updates: dict,
) -> dict | None:
    """Update a menu item and regenerate its embedding if text fields changed.

    Returns the updated row, or None if not found.
    """
    result = (
        db.table(models.MENU_ITEMS)
        .select("*")
        .eq("id", item_id)
        .eq("restaurant_id", restaurant_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return None

    existing = result.data

    needs_reembed = False
    if "title" in updates and updates["title"] != existing.get("title"):
        needs_reembed = True
    if "description" in updates and updates["description"] != existing.get("description"):
        needs_reembed = True

    updated = (
        db.table(models.MENU_ITEMS)
        .update(updates)
        .eq("id", item_id)
        .eq("restaurant_id", restaurant_id)
        .execute()
    )
    if not updated.data:
        return None

    row = updated.data[0]

    if needs_reembed:
        _regenerate_embedding(db, item_id, row)

    return row


def resync_all_embeddings(db: Client, restaurant_id: str) -> int:
    """Regenerate embeddings for every menu item in the restaurant.

    Returns the count of items processed.
    """
    result = (
        db.table(models.MENU_ITEMS)
        .select("id, pos_name, title, description, price")
        .eq("restaurant_id", restaurant_id)
        .execute()
    )
    items = result.data or []
    count = 0

    for item in items:
        try:
            _regenerate_embedding(db, item["id"], item)
            count += 1
        except Exception as e:
            logger.warning("Failed to regenerate embedding for item %s: %s", item["id"], e)

    logger.info("Resync complete: regenerated %d / %d embeddings for restaurant %s", count, len(items), restaurant_id)
    return count


def _regenerate_embedding(db: Client, item_id: str, item: dict):
    """Generate a new embedding for a menu item and save it to the DB."""
    text = build_embedding_text(item)
    embedding = generate_embedding(text)
    db.table(models.MENU_ITEMS).update({"embedding": embedding}).eq("id", item_id).execute()
    logger.debug("Regenerated embedding for menu item %s", item_id)
