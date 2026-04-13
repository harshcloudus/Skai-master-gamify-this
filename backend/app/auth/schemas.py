from pydantic import BaseModel
from datetime import datetime


class RestaurantInfo(BaseModel):
    id: str
    name: str
    timezone: str
    agent_enabled: bool


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    restaurant: RestaurantInfo
