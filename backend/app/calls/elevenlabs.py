"""ElevenLabs Conversational AI API client.

Wraps the /v1/convai endpoints to list, fetch, and stream conversation data.
All functions are async and return parsed dicts or raw httpx responses.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
_TIMEOUT = httpx.Timeout(30.0, read=60.0)


def _headers(api_key: str) -> dict[str, str]:
    return {"xi-api-key": api_key}


async def list_conversations(
    api_key: str,
    *,
    agent_id: str | None = None,
    page_size: int = 100,
    cursor: str | None = None,
) -> dict[str, Any]:
    """GET /v1/convai/conversations — paginated list.

    Returns the raw JSON body which includes ``conversations`` list and
    optional ``next_cursor`` for pagination.
    """
    url = f"{ELEVENLABS_BASE}/convai/conversations"
    params: dict[str, Any] = {"page_size": page_size}
    if agent_id:
        params["agent_id"] = agent_id
    if cursor:
        params["cursor"] = cursor

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(url, headers=_headers(api_key), params=params)
        resp.raise_for_status()
        return resp.json()


async def get_conversation_detail(
    api_key: str,
    conversation_id: str,
) -> dict[str, Any]:
    """GET /v1/convai/conversations/{id} — full conversation detail.

    Returns transcript, analysis, metadata, and status for a single
    conversation.
    """
    url = f"{ELEVENLABS_BASE}/convai/conversations/{conversation_id}"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(url, headers=_headers(api_key))
        resp.raise_for_status()
        return resp.json()


async def fetch_conversation_audio(api_key: str, conversation_id: str) -> httpx.Response:
    """GET /v1/convai/conversations/{id}/audio — raw audio bytes.

    Returns the raw httpx response so the caller can relay the status code,
    content-type, and body directly.
    """
    url = f"{ELEVENLABS_BASE}/convai/conversations/{conversation_id}/audio"

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=120.0)) as client:
        response = await client.get(url, headers=_headers(api_key))
        return response


async def list_all_conversations(
    api_key: str,
    *,
    agent_id: str | None = None,
    max_pages: int = 10,
) -> list[dict[str, Any]]:
    """Auto-paginate through all conversations (up to *max_pages* pages).

    Useful for a full sync.  Returns a flat list of conversation summaries.
    """
    all_convos: list[dict[str, Any]] = []
    cursor: str | None = None

    for _ in range(max_pages):
        data = await list_conversations(
            api_key, agent_id=agent_id, page_size=100, cursor=cursor,
        )
        convos = data.get("conversations", [])
        all_convos.extend(convos)
        cursor = data.get("next_cursor")
        if not cursor:
            break

    logger.info("Fetched %d conversations from ElevenLabs", len(all_convos))
    return all_convos
