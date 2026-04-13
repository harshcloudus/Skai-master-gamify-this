from pydantic import BaseModel
from datetime import datetime


class KPIValue(BaseModel):
    value: float | None = None


class KPIs(BaseModel):
    revenue: KPIValue
    total_orders: KPIValue
    labor_hours_saved: KPIValue


class CallGraphPoint(BaseModel):
    date: str
    day: str
    call_count: int


class RecentActivityItem(BaseModel):
    id: str
    phone_number: str | None = None
    order_value: float | None = None
    time: str
    call_status: str


class DashboardOverview(BaseModel):
    kpis: KPIs
    calls_graph: list[CallGraphPoint]
    recent_activity: list[RecentActivityItem]
