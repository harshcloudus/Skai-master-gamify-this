from pydantic import BaseModel, Field


# ── Match (existing) ──────────────────────────────────────

class MenuMatchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    restaurant_id: str | None = None
    match_threshold: float = Field(default=0.6, ge=0.0, le=1.0)
    match_count: int = Field(default=5, ge=1, le=20)


class MatchedMenuItem(BaseModel):
    id: str
    pos_name: str
    title: str | None = None
    description: str | None = None
    price: float
    similarity: float

    @property
    def display_name(self) -> str:
        return self.title or self.pos_name


class MenuMatchResponse(BaseModel):
    matches: list[MatchedMenuItem]
    query: str


# ── CRUD ──────────────────────────────────────────────────

class MenuItemResponse(BaseModel):
    id: str
    pos_name: str
    title: str | None = None
    description: str | None = None
    price: float
    category: str | None = None
    is_active: bool
    pos_item_id: str | None = None
    created_at: str
    updated_at: str


class MenuItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_active: bool | None = None
