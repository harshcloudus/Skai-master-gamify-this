from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str

    # Google Gemini
    gemini_api_key: str

    # ElevenLabs
    elevenlabs_api_key: str

    # Twilio
    twilio_account_sid: str
    twilio_auth_token: str

    # Webhook / agent endpoint security
    webhook_secret: str = ""
    elevenlabs_webhook_secret: str = ""
    twilio_validate_signatures: bool = True

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # App
    env: str = "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
