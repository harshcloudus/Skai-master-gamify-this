from enum import Enum
from pydantic import BaseModel


class ParseStatus(str, Enum):
    """Tracks the outcome of the order-parsing pipeline on a call record."""
    PENDING = "pending"
    SUCCESS = "success"
    NO_ORDER = "no_order"
    SKIPPED = "skipped"
    PARSE_ERROR = "parse_error"
    RESOLVE_ERROR = "resolve_error"
    SAVE_ERROR = "save_error"


class ParsedOrderItem(BaseModel):
    """A single item extracted by the Gemini parser from the transcript."""
    item_name: str
    quantity: int = 1
    modifiers: list[str] = []
    estimated_price: float | None = None


class ParsedOrder(BaseModel):
    """Full parser output from a call transcript."""
    order_type: str = "takeaway"
    items: list[ParsedOrderItem] = []
    has_order: bool = False
    customer_name: str | None = None
    error: str | None = None


class ResolvedOrderItem(BaseModel):
    """An order item after pgvector matching resolves it to a real menu item."""
    menu_item_id: str | None = None
    item_name: str
    quantity: int = 1
    unit_price: float = 0.0
    subtotal: float = 0.0
    modifiers: list[str] = []
    matched: bool = False
