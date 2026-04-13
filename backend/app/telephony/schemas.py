from pydantic import BaseModel


class TwilioIncomingPayload(BaseModel):
    """Fields Twilio POSTs to our voice webhook (form-encoded)."""
    CallSid: str
    From: str
    To: str
    CallStatus: str | None = None
    Direction: str | None = None


class TakeawayCheckRequest(BaseModel):
    restaurant_id: str | None = None


class TakeawayCheckResponse(BaseModel):
    allowed: bool
    reason: str


# ── ElevenLabs Twilio Personalization Webhook ────────────

class PersonalizeRequest(BaseModel):
    """Payload ElevenLabs sends to our personalization webhook on inbound Twilio calls."""
    caller_id: str
    agent_id: str
    called_number: str
    call_sid: str
