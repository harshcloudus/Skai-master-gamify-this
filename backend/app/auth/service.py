from app.auth.schemas import UserProfile, RestaurantInfo


def build_user_profile(user_data: dict) -> UserProfile:
    """Transform the raw DB row (with joined restaurant) into a UserProfile."""
    restaurant_raw = user_data.get("restaurant", {})
    return UserProfile(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data.get("full_name", ""),
        role=user_data.get("role", "owner"),
        restaurant=RestaurantInfo(
            id=restaurant_raw["id"],
            name=restaurant_raw["name"],
            timezone=restaurant_raw.get("timezone", "America/New_York"),
            agent_enabled=restaurant_raw.get("agent_enabled", True),
        ),
    )
