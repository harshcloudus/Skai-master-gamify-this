import hmac
import logging

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt, jwk
from twilio.request_validator import RequestValidator
from supabase import Client

from app.config import get_settings, Settings
from app.db.client import get_supabase
from app.db import models

logger = logging.getLogger(__name__)
security = HTTPBearer()

_jwks_cache: dict | None = None


async def _fetch_jwks(supabase_url: str) -> dict:
    """Fetch the JWKS from Supabase for ES256 token verification (async, cached)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache


async def _get_signing_key(token: str, supabase_url: str) -> tuple[dict, str]:
    """Extract the correct signing key from JWKS based on the token's kid header."""
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg == "ES256":
        kid = header.get("kid")
        jwks = await _fetch_jwks(supabase_url)
        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == kid:
                return key_data, "ES256"
        raise JWTError(f"No matching JWKS key for kid={kid}")

    return {}, "HS256"


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    settings: Settings = Depends(get_settings),
) -> str:
    """Verify Supabase JWT and return the user ID (sub claim)."""
    token = credentials.credentials
    try:
        key_data, alg = await _get_signing_key(token, settings.supabase_url)

        if alg == "ES256":
            key = jwk.construct(key_data, algorithm="ES256")
            payload = jwt.decode(
                token,
                key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        else:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )
        return user_id
    except JWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
) -> dict:
    """Fetch the full user row + restaurant info from DB."""
    result = (
        db.table(models.USERS)
        .select("*, restaurant:restaurants(*)")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please contact support.",
        )
    return result.data


# ── Twilio signature verification ─────────────────────────


async def verify_twilio_signature(request: Request) -> None:
    """Validate that the incoming request genuinely came from Twilio.

    Uses the X-Twilio-Signature header + auth token to verify.
    Skipped when TWILIO_VALIDATE_SIGNATURES is false (e.g. local dev).
    """
    settings = get_settings()
    if not settings.twilio_validate_signatures:
        return

    signature = request.headers.get("X-Twilio-Signature", "")
    validator = RequestValidator(settings.twilio_auth_token)

    form_data = await request.form()
    params = {k: v for k, v in form_data.items()}
    url = str(request.url)

    if not validator.validate(url, params, signature):
        logger.warning("Invalid Twilio signature for %s", url)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Twilio signature",
        )


# ── Webhook API key verification (custom tool endpoints) ──


async def verify_webhook_secret(request: Request) -> None:
    """Verify X-Webhook-Secret header matches the configured secret.

    Protects agent-facing tool endpoints from unauthorized callers.
    Skipped when WEBHOOK_SECRET is not configured (local dev).
    """
    settings = get_settings()
    if not settings.webhook_secret:
        return

    provided = request.headers.get("X-Webhook-Secret", "")
    if not hmac.compare_digest(provided, settings.webhook_secret):
        logger.warning("Invalid webhook secret on %s %s", request.method, request.url.path)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing webhook secret",
        )


# ── ElevenLabs post-call HMAC verification ────────────────


async def verify_elevenlabs_signature(request: Request) -> dict:
    """Verify the elevenlabs-signature header on post-call webhooks.

    Uses the ElevenLabs Python SDK to validate the HMAC signature
    against the raw request body. Returns the parsed event dict so
    the route handler doesn't need to re-parse the body.

    Skipped when ELEVENLABS_WEBHOOK_SECRET is not configured (local dev);
    in that case the raw body is parsed as JSON and returned directly.
    """
    raw_body = await request.body()
    raw_text = raw_body.decode("utf-8")

    settings = get_settings()
    if not settings.elevenlabs_webhook_secret:
        import json
        try:
            return json.loads(raw_text)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )

    signature = request.headers.get("elevenlabs-signature", "")
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing elevenlabs-signature header",
        )

    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=settings.elevenlabs_api_key)

    try:
        event = client.webhooks.construct_event(
            rawBody=raw_text,
            sig_header=signature,
            secret=settings.elevenlabs_webhook_secret,
        )
    except Exception as e:
        logger.warning("ElevenLabs signature verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ElevenLabs webhook signature",
        )

    return event


# ── Shared restaurant lookups ─────────────────────────────


def lookup_restaurant_by_agent_id(db: Client, agent_id: str) -> dict | None:
    """Find the restaurant whose elevenlabs_agent_id matches."""
    result = (
        db.table(models.RESTAURANTS)
        .select("*")
        .eq("elevenlabs_agent_id", agent_id)
        .maybe_single()
        .execute()
    )
    if result is None:
        return None
    return result.data
