from pydantic import BaseModel, Field
from typing import Any


class CallListFilters(BaseModel):
    search: str | None = None
    orders_only: bool = False
    date_from: str | None = None
    date_to: str | None = None


class CallListItem(BaseModel):
    id: str
    phone_number: str | None = None
    customer_name: str | None = None
    call_status: str
    call_duration_seconds: int | None = None
    has_order: bool
    order_value: float | None = None
    order_type: str | None = None
    items_count: int | None = None
    call_started_at: str | None = None
    created_at: str


class OrderItemDetail(BaseModel):
    id: str
    item_name: str
    quantity: int
    unit_price: float
    subtotal: float
    modifiers: list[str] = []
    menu_item_id: str | None = None


class OrderDetail(BaseModel):
    id: str
    order_type: str
    total_amount: float
    items_count: int
    items: list[OrderItemDetail] = []


class CallDetail(BaseModel):
    id: str
    phone_number: str | None = None
    customer_name: str | None = None
    call_status: str
    call_duration_seconds: int | None = None
    has_order: bool
    transcript: Any = None
    summary: str | None = None
    call_started_at: str | None = None
    call_ended_at: str | None = None
    created_at: str
    order: OrderDetail | None = None
