from fastapi import APIRouter, Depends
from supabase import Client

from app.dependencies import get_current_user
from app.db.client import get_supabase
from app.utils.response import api_response
from app.dashboard.service import get_dashboard_overview

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview")
async def dashboard_overview(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
) -> dict:
    restaurant = user["restaurant"]
    overview = get_dashboard_overview(
        db=db,
        restaurant_id=restaurant["id"],
        timezone=restaurant["timezone"],
    )
    return api_response(data=overview.model_dump())
