import logging
import math
from functools import lru_cache

from google import genai
from google.genai import types
from supabase import Client

from app.config import get_settings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768


@lru_cache
def _get_genai_client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


def _normalize_l2(values: list[float]) -> list[float]:
    """Unit L2-normalize; recommended for gemini-embedding-001 at 768 dims."""
    norm = math.sqrt(sum(x * x for x in values))
    if norm <= 0:
        return values
    return [x / norm for x in values]


def build_embedding_text(item: dict) -> str:
    """Build the text string used for embedding a menu item.

    Format: "{title or pos_name}. {description}. Price: ${price}"
    """
    name = item.get("title") or item.get("pos_name", "")
    description = item.get("description") or ""
    price = item.get("price", 0)

    parts = [name]
    if description:
        parts.append(description)
    parts.append(f"Price: ${price}")
    return ". ".join(parts)


def generate_embedding(text: str) -> list[float]:
    """Generate a 768-dimension embedding via Gemini gemini-embedding-001."""
    client = _get_genai_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBEDDING_DIMENSIONS,
        ),
    )
    return _normalize_l2(result.embeddings[0].values)


def generate_query_embedding(query: str) -> list[float]:
    """Generate an embedding for a search query (uses retrieval_query task type)."""
    client = _get_genai_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=EMBEDDING_DIMENSIONS,
        ),
    )
    return _normalize_l2(result.embeddings[0].values)


def search_menu_items(
    db: Client,
    query_embedding: list[float],
    restaurant_id: str,
    match_threshold: float = 0.6,
    match_count: int = 5,
) -> list[dict]:
    """Run pgvector similarity search via the match_menu_items RPC function."""
    result = db.rpc(
        "match_menu_items",
        {
            "query_embedding": query_embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
            "p_restaurant_id": restaurant_id,
        },
    ).execute()
    return result.data or []
