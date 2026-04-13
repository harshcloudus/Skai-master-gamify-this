// ── Auth ────────────────────────────────────────────────

export interface RestaurantInfo {
  id: string;
  name: string;
  timezone: string;
  agent_enabled: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  restaurant: RestaurantInfo;
}

// ── Dashboard ───────────────────────────────────────────

export interface KPIValue {
  value: number | null;
}

export interface KPIs {
  revenue: KPIValue;
  total_orders: KPIValue;
  labor_hours_saved: KPIValue;
}

export interface CallGraphPoint {
  date: string;
  day: string;
  call_count: number;
}

export interface RecentActivityItem {
  id: string;
  phone_number: string | null;
  order_value: number | null;
  time: string;
  call_status: string;
}

export interface DashboardOverview {
  kpis: KPIs;
  calls_graph: CallGraphPoint[];
  recent_activity: RecentActivityItem[];
}

// ── Calls ───────────────────────────────────────────────

export interface CallListItem {
  id: string;
  phone_number: string | null;
  customer_name: string | null;
  call_status: string;
  call_duration_seconds: number | null;
  has_order: boolean;
  order_value: number | null;
  order_type: string | null;
  items_count: number | null;
  call_started_at: string | null;
  created_at: string;
}

export interface OrderItemDetail {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  modifiers: string[];
  menu_item_id: string | null;
}

export interface OrderDetail {
  id: string;
  order_type: string;
  total_amount: number;
  items_count: number;
  items: OrderItemDetail[];
}

export interface CallDetail {
  id: string;
  phone_number: string | null;
  customer_name: string | null;
  call_status: string;
  call_duration_seconds: number | null;
  has_order: boolean;
  transcript: TranscriptEntry[] | null;
  summary: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  created_at: string;
  order: OrderDetail | null;
}

export interface TranscriptEntry {
  role: string;
  message: string;
  time_in_call_secs?: number;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ── Menu ────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  pos_name: string;
  title: string | null;
  description: string | null;
  price: number;
  category: string | null;
  is_active: boolean;
  pos_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItemUpdate {
  title?: string | null;
  description?: string | null;
  is_active?: boolean;
}

// ── Settings ────────────────────────────────────────────

export interface DayHours {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
}

export interface DineInSettings {
  dinein_transfer_enabled: boolean;
  dinein_transfer_number: string | null;
  dinein_max_hourly_capacity: number | null;
  dinein_take_reservations_after_hours: boolean;
}

export interface TakeawaySettings {
  takeaway_enabled: boolean;
  takeaway_stop_minutes_before_close: number;
}

export interface DivertSettings {
  divert_enabled: boolean;
  divert_threshold_amount: number;
}

export interface SmsSettings {
  sms_order_ready_enabled: boolean;
}

export interface CustomerNameSettings {
  ask_customer_name: boolean;
}

export interface AllSettings {
  business_hours: DayHours[];
  dine_in: DineInSettings;
  takeaway: TakeawaySettings;
  divert: DivertSettings;
  sms: SmsSettings;
  customer_name: CustomerNameSettings;
  agent_enabled: boolean;
}
