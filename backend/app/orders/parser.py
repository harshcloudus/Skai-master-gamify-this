"""Gemini-based transcript -> order parser.

Sends the call transcript to Gemini and extracts structured order data:
spoken item names, quantities, modifiers, and order type (dine-in / takeaway).
"""

import json
import logging
from functools import lru_cache
from google import genai
from google.genai import types

from app.config import get_settings
from app.orders.schemas import ParsedOrder, ParsedOrderItem

logger = logging.getLogger(__name__)

PARSER_MODEL = "gemini-2.5-flash"


@lru_cache
def _get_genai_client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)

SYSTEM_PROMPT = """\
You are an order extraction assistant for a restaurant phone ordering system.

Given a call transcript between a customer and an AI voice agent, extract any food/drink order.

Return a JSON object with this exact structure:
{
  "has_order": true/false,
  "order_type": "takeaway" or "dine-in",
  "customer_name": "the name the customer gave, or null if not provided",
  "items": [
    {
      "item_name": "the item as the customer described it",
      "quantity": 1,
      "modifiers": ["extra spicy", "no onions"],
      "estimated_price": null
    }
  ]
}

Rules:
- Set has_order to false if the customer did not place an order (just inquiring, cancelled, etc.)
- Use the exact words the customer used for item_name (e.g. "butter chicken" not "Murgh Makhani")
- Quantity defaults to 1 if not specified
- Modifiers include any customizations (extra cheese, no onions, spicy level, etc.)
- estimated_price should be null — prices will be resolved from the menu database
- order_type defaults to "takeaway" unless the customer explicitly mentions dine-in or reservation
- customer_name should be null if the customer's name was never mentioned in the transcript
- Only return valid JSON, no markdown fences or extra text
"""


def format_transcript_for_parser(transcript: list | str) -> str:
    """Convert the ElevenLabs transcript format into plain text for the parser."""
    if isinstance(transcript, str):
        return transcript

    if not isinstance(transcript, list):
        return str(transcript)

    lines = []
    for turn in transcript:
        role = turn.get("role", "unknown")
        message = turn.get("message", turn.get("text", ""))
        speaker = "Customer" if role in ("user", "customer") else "Agent"
        lines.append(f"{speaker}: {message}")
    return "\n".join(lines)


def parse_transcript(transcript: list | str) -> ParsedOrder:
    """Send the transcript to Gemini and extract structured order data."""
    transcript_text = format_transcript_for_parser(transcript)

    if not transcript_text.strip():
        logger.info("Empty transcript — no order to parse")
        return ParsedOrder(has_order=False)

    client = _get_genai_client()

    try:
        response = client.models.generate_content(
            model=PARSER_MODEL,
            contents=(
                f"Extract the order from this call transcript:\n\n{transcript_text}"
            ),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        raw_text = response.text.strip()
        parsed = json.loads(raw_text)

        items = [
            ParsedOrderItem(
                item_name=item.get("item_name", ""),
                quantity=item.get("quantity", 1),
                modifiers=item.get("modifiers", []),
                estimated_price=item.get("estimated_price"),
            )
            for item in parsed.get("items", [])
            if item.get("item_name")
        ]

        raw_name = parsed.get("customer_name")
        customer_name = raw_name.strip() if isinstance(raw_name, str) and raw_name.strip() else None

        return ParsedOrder(
            has_order=parsed.get("has_order", len(items) > 0),
            order_type=parsed.get("order_type", "takeaway"),
            customer_name=customer_name,
            items=items,
        )

    except json.JSONDecodeError as e:
        logger.error("Failed to parse Gemini response as JSON: %s", e)
        return ParsedOrder(has_order=False, error=f"json_decode: {e}")
    except Exception as e:
        logger.error("Gemini parser call failed: %s", e)
        return ParsedOrder(has_order=False, error=f"gemini_call: {e}")
