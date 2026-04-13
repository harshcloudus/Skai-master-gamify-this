from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.auth.service import build_user_profile
from app.auth.schemas import UserProfile
from app.utils.response import api_response

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)) -> dict:
    profile = build_user_profile(user)
    return api_response(data=profile.model_dump())
