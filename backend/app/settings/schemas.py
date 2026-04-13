from pydantic import BaseModel, Field


# ── Business Hours ────────────────────────────────────────

class DayHours(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    open_time: str | None = None
    close_time: str | None = None


class BusinessHoursUpdate(BaseModel):
    hours: list[DayHours] = Field(..., min_length=7, max_length=7)


# ── Dine-in ───────────────────────────────────────────────

class DineInSettings(BaseModel):
    dinein_transfer_enabled: bool = False
    dinein_max_hourly_capacity: int = 0
    dinein_take_reservations_after_hours: bool = False


# ── Takeaway ──────────────────────────────────────────────

class TakeawaySettings(BaseModel):
    takeaway_enabled: bool = False
    takeaway_stop_minutes_before_close: int = 0


# ── Divert ────────────────────────────────────────────────

class DivertSettings(BaseModel):
    divert_enabled: bool = False
    divert_threshold_amount: float = 0.0


# ── SMS (dummy) ───────────────────────────────────────────

class SmsSettings(BaseModel):
    sms_order_ready_enabled: bool = False


# ── Customer name ─────────────────────────────────────────

class CustomerNameSettings(BaseModel):
    ask_customer_name: bool = False


# ── Agent toggle ──────────────────────────────────────────

class AgentToggle(BaseModel):
    agent_enabled: bool


class TimezoneUpdate(BaseModel):
    timezone: str


# ── Combined GET response ────────────────────────────────

class AllSettings(BaseModel):
    business_hours: list[DayHours] = []
    dine_in: DineInSettings = DineInSettings()
    takeaway: TakeawaySettings = TakeawaySettings()
    divert: DivertSettings = DivertSettings()
    sms: SmsSettings = SmsSettings()
    customer_name: CustomerNameSettings = CustomerNameSettings()
    agent_enabled: bool = True
