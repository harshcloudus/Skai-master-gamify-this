# SKAI Backend — Implementation Plan

## Summary of Decisions

| Area | Decision |
|---|---|
| Framework | Python + FastAPI |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (JWT) — Frontend uses Supabase JS client directly; backend verifies JWT |
| AI Parser | Google Gemini |
| Telephony | Twilio → ElevenLabs WebSocket (direct stream, no proxy) |
| Call Data | ElevenLabs post-call webhook (transcript, summary, conversation_id, phone, duration) |
| Audio Playback | On-demand proxy from ElevenLabs API |
| Multi-tenancy | Yes (`restaurant_id` on all tables from day one) — single restaurant for MVP |
| Vector Search | pgvector on Supabase — semantic menu item matching via ElevenLabs custom tool + order parser |
| Embeddings | Gemini `text-embedding-004` (768 dimensions) |
| Menu Source for Agent | Custom tool calling backend pgvector endpoint (no ElevenLabs KB) |
| Dine-in Transfer | ElevenLabs agent's built-in transfer tool via Twilio API (number connected in ElevenLabs dashboard) |
| SMS | Deferred (not in MVP) — setting persisted as dummy toggle |
| Deployment | Render (backend), Supabase (DB) |
| Frontend | Separate team (React + Supabase JS + React Query) — we build REST API only |

---

## 1. Project Structure

```
skai_backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app entry, CORS, lifespan
│   ├── config.py                # Settings via pydantic-settings (.env)
│   ├── dependencies.py          # Dependency injection (DB session, current_user via Supabase JWT verification)
│   │
│   ├── auth/
│   │   ├── router.py            # GET /auth/me
│   │   ├── service.py           # User profile + restaurant lookup
│   │   └── schemas.py           # UserProfile
│   │
│   ├── dashboard/
│   │   ├── router.py            # GET /dashboard/overview
│   │   ├── service.py           # KPI calculations (weekly), call graph data
│   │   └── schemas.py           # KPIResponse, CallGraphData, RecentActivity
│   │
│   ├── calls/
│   │   ├── router.py            # GET /calls, GET /calls/{id}/details, GET /calls/{id}/audio
│   │   ├── service.py           # Query calls, read transcript/summary from DB
│   │   ├── schemas.py           # CallListResponse, CallDetailResponse, filters
│   │   └── elevenlabs.py        # ElevenLabs API client (audio proxy)
│   │
│   ├── orders/
│   │   ├── router.py            # Orders tied to calls
│   │   ├── service.py           # Order creation, AI parsing pipeline
│   │   ├── schemas.py           # OrderCreate, OrderItem, OrderResponse
│   │   └── parser.py            # Gemini-based transcript→order parser
│   │
│   ├── menu/
│   │   ├── router.py            # GET/PATCH /menu/items, POST /menu/resync, POST /menu/items/match
│   │   ├── service.py           # CRUD, POS sync stub
│   │   ├── schemas.py           # MenuItemResponse, MenuItemUpdate
│   │   └── embeddings.py        # Gemini embedding generation, pgvector search
│   │
│   ├── settings/
│   │   ├── router.py            # GET/PUT /settings/business-hours, /dine-in, /takeaway, /divert, /sms, /agent-toggle
│   │   ├── service.py           # Settings CRUD
│   │   └── schemas.py           # BusinessHours, DineInSettings, TakeawaySettings, DivertSettings
│   │
│   ├── telephony/
│   │   ├── router.py            # POST /telephony/incoming
│   │   ├── service.py           # Business hours check, TwiML generation with Stream params
│   │   └── schemas.py           # TwilioWebhookPayload
│   │
│   ├── webhooks/
│   │   ├── router.py            # POST /webhooks/elevenlabs
│   │   └── service.py           # Post-call processing: save call, parse order, save order
│   │
│   ├── db/
│   │   ├── client.py            # Supabase client init
│   │   ├── models.py            # Table references
│   │   ├── functions.sql        # Supabase RPC functions (match_menu_items etc.)
│   │   └── migrations/          # SQL migration files
│   │
│   └── utils/
│       ├── timezone.py          # Timezone conversion helpers
│       ├── pagination.py        # Offset pagination
│       └── response.py          # Standardized API response wrapper
│
├── tests/
│   ├── test_auth.py
│   ├── test_dashboard.py
│   ├── test_calls.py
│   ├── test_menu.py
│   ├── test_settings.py
│   └── test_telephony.py
│
├── .env.example
├── .gitignore
├── pyproject.toml
├── uv.lock
└── README.md
```

---

## 2. Database Schema

### `restaurants`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | VARCHAR | |
| timezone | VARCHAR | e.g. `America/New_York` |
| elevenlabs_agent_id | VARCHAR | Single agent for now |
| twilio_phone_number | VARCHAR | |
| agent_enabled | BOOLEAN | Master toggle for voice agent |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `users`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Matches Supabase Auth user ID |
| restaurant_id | UUID (FK) | |
| email | VARCHAR | |
| full_name | VARCHAR | |
| role | VARCHAR | `owner` (future: `staff`, `admin`) |
| created_at | TIMESTAMPTZ | |

### `business_hours`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| day_of_week | INT | 0=Monday … 6=Sunday |
| open_time | TIME | Nullable (null = closed) |
| close_time | TIME | Nullable |

### `restaurant_settings`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| restaurant_id | UUID (FK, unique) | One row per restaurant |
| dinein_transfer_enabled | BOOLEAN | Transfer calls for dine-in? |
| dinein_max_hourly_capacity | INT | Default 0 (used when transfer OFF) |
| takeaway_stop_minutes_before_close | INT | Default 0 |
| divert_enabled | BOOLEAN | Divert high-value orders to staff? |
| divert_threshold_amount | DECIMAL(10,2) | Order value threshold for divert |
| sms_order_ready_enabled | BOOLEAN | Dummy toggle (SMS deferred from MVP) |

### `menu_items`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| pos_name | VARCHAR | From POS, non-editable |
| title | VARCHAR | Editable, nullable (agent uses this if set, else pos_name) |
| description | TEXT | Editable — AI suggestions, modifiers |
| price | DECIMAL(10,2) | |
| category | VARCHAR | Nullable |
| is_active | BOOLEAN | Active/Inactive toggle |
| pos_item_id | VARCHAR | External POS reference ID |
| embedding | vector(768) | Auto-generated via Gemini `text-embedding-004` on create/update |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

> This table serves as the pgvector source for both the ElevenLabs voice agent (via custom tool) and post-call order parsing.
> The `embedding` column is used by pgvector for semantic menu item matching.
> Price and category are not displayed in the frontend — they are used by the voice agent during live calls.

### Supabase Extensions & Functions

**Enable pgvector:**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Similarity search function:**

```sql
CREATE OR REPLACE FUNCTION match_menu_items(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_restaurant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  pos_name text,
  title text,
  description text,
  price decimal,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mi.id,
    mi.pos_name,
    mi.title,
    mi.description,
    mi.price,
    1 - (mi.embedding <=> query_embedding) AS similarity
  FROM menu_items mi
  WHERE mi.is_active = true
    AND mi.restaurant_id = p_restaurant_id
    AND 1 - (mi.embedding <=> query_embedding) > match_threshold
  ORDER BY mi.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Index for fast vector search:**

```sql
CREATE INDEX ON menu_items
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### `calls`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| twilio_call_sid | VARCHAR (unique) | From ElevenLabs webhook (passed via Stream params) |
| elevenlabs_conversation_id | VARCHAR | From ElevenLabs webhook |
| phone_number | VARCHAR | Caller's number (passed via Stream params, returned in webhook) |
| customer_name | VARCHAR | Nullable (not captured in MVP) |
| call_status | VARCHAR | `completed`, `failed` — from webhook |
| call_duration_seconds | INT | From webhook |
| transcript | JSONB | Full transcript from ElevenLabs webhook |
| summary | TEXT | `transcript_summary` from ElevenLabs webhook |
| has_order | BOOLEAN | Whether this call resulted in an order |
| call_started_at | TIMESTAMPTZ | |
| call_ended_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `orders`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| call_id | UUID (FK) | One order per call |
| phone_number | VARCHAR | Denormalized for quick access |
| customer_name | VARCHAR | Nullable |
| order_type | VARCHAR | `dine-in` or `takeaway` |
| total_amount | DECIMAL(10,2) | |
| items_count | INT | Denormalized count |
| raw_parsed_data | JSONB | Full Gemini parser output |
| created_at | TIMESTAMPTZ | |

### `order_items`

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| order_id | UUID (FK) | |
| menu_item_id | UUID (FK, nullable) | Link to menu_items if matched |
| item_name | VARCHAR | As spoken/parsed |
| quantity | INT | |
| unit_price | DECIMAL(10,2) | |
| subtotal | DECIMAL(10,2) | |
| modifiers | JSONB | e.g. `["extra spicy", "no onions"]` |

---

## 3. API Endpoints

### Auth

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/auth/me` | Current user profile + restaurant info (JWT verified from Supabase) |

> Frontend handles login/refresh via Supabase JS client directly. Backend only verifies the JWT on each request.

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/dashboard/overview` | KPIs (weekly), call graph data (past 7 days), recent activity |

Timezone auto-applied from restaurant setting.

Response shape:

```json
{
  "kpis": {
    "revenue": { "value": 2450.00 },
    "total_orders": { "value": 87 },
    "labor_hours_saved": { "value": null }
  },
  "calls_graph": [
    { "date": "2026-03-26", "day": "Thu", "call_count": 15 },
    { "date": "2026-03-27", "day": "Fri", "call_count": 22 }
  ],
  "recent_activity": [
    {
      "id": "...",
      "phone_number": "+1234567890",
      "order_value": 45.50,
      "time": "2026-03-31T14:30:00-05:00",
      "call_status": "completed"
    }
  ]
}
```

### Calls & Orders

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/calls` | Paginated list with search & filters |
| GET | `/api/v1/calls/{call_id}/details` | Transcript + summary from DB, order items from DB |
| GET | `/api/v1/calls/{call_id}/audio` | Proxies audio from ElevenLabs API |

Query params for list: `search`, `orders_only`, `date_from`, `date_to`, `page`, `limit`

### Menu Items

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/menu/items` | List all items, filterable by `active`, searchable |
| PATCH | `/api/v1/menu/items/{id}` | Update title, description, is_active. Auto-regenerates embedding. |
| POST | `/api/v1/menu/resync` | Stub for POS sync (future). Regenerates embeddings for all items. |
| POST | `/api/v1/menu/items/match` | Vector similarity search — used by ElevenLabs agent custom tool + order parser (no auth for MVP) |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/settings` | All settings (business hours + dine-in + takeaway + divert + sms + agent toggle) |
| PUT | `/api/v1/settings/business-hours` | Update 7-day schedule |
| PUT | `/api/v1/settings/dine-in` | Update dine-in config (transfer toggle, transfer number, max capacity) |
| PUT | `/api/v1/settings/takeaway` | Update takeaway config |
| PUT | `/api/v1/settings/divert` | Update divert threshold config |
| PUT | `/api/v1/settings/sms` | Update SMS toggle (dummy — no functionality in MVP) |
| PUT | `/api/v1/settings/agent-toggle` | Enable/disable voice agent |

### Telephony (Twilio Webhook)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/telephony/incoming` | Twilio voice webhook — check business hours + agent toggle → return TwiML with Stream params |

### Webhooks (ElevenLabs)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/webhooks/elevenlabs` | ElevenLabs post-call webhook — save call record, trigger order parsing pipeline |

### Placeholder Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/reports` | `{ "message": "Coming soon" }` |
| GET | `/api/v1/earnings` | `{ "message": "Coming soon" }` |
| GET | `/api/v1/support` | `{ "message": "Coming soon" }` |

---

## 4. Core Flows

### Flow A: Incoming Call

```
Phone Call → Twilio
  → POST /telephony/incoming (our webhook)
    → Query restaurant by twilio_phone_number
    → Check: agent_enabled == true?
    → Check: current time (in restaurant timezone) within business_hours?
    → IF all pass:
        Return TwiML:
          <Response>
            <Connect>
              <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}">
                <Parameter name="caller_number" value="{From}" />
                <Parameter name="call_sid" value="{CallSid}" />
              </Stream>
            </Connect>
          </Response>
    → ELSE:
        Return TwiML:
          <Response>
            <Say>Sorry, we are currently closed.</Say>
          </Response>
```

### Flow B: Post-Call Processing (ElevenLabs Webhook)

```
Call Ends → ElevenLabs
  → POST /webhooks/elevenlabs
    → Extract from webhook payload:
        - conversation_id
        - transcript (full conversation)
        - transcript_summary
        - caller phone number (from Stream params)
        - call_sid (from Stream params)
        - call duration
        - call status
    → Look up restaurant by elevenlabs_agent_id (single restaurant for MVP)
    → Save call record to `calls` table (including transcript + summary)
    → IF call was completed and has transcript:
        → Send transcript to Gemini parser
        → Parser extracts spoken item names, quantities, order_type
            e.g. ["butter chicken x2", "garlic bread x1"]
        → For each extracted item:
            → Generate embedding via Gemini text-embedding-004
            → pgvector similarity search against menu_items (match_menu_items RPC)
            → Resolve to real menu_item_id + DB price (not AI-guessed price)
        → Build order with verified prices from DB
        → Save to `orders` + `order_items` tables
        → Link order to call record (call.has_order = true)
```

### Flow C: Call Details (From DB + Audio Proxy)

```
Frontend: User clicks "View" on a call
  → GET /calls/{call_id}/details
    → Read from DB: transcript, summary, order items
    → Return to frontend

Frontend: User clicks play audio
  → GET /calls/{call_id}/audio
    → Read call record (get elevenlabs_conversation_id)
    → Proxy request to ElevenLabs:
        GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio
        (with ElevenLabs API key from env)
    → Stream audio back to frontend
```

### Flow D: Dashboard Analytics (Weekly)

```
Frontend loads Dashboard
  → GET /dashboard/overview
    → Revenue: SUM(orders.total_amount) for current week (Mon–Sun)
    → Total Orders: COUNT(orders) for current week
    → Labor Hours: Return null (dummy value)
    → Calls Graph: COUNT calls per day for past 7 days
    → Recent Activity: Latest 10 calls with order info joined
```

### Flow E: Live Call — Menu Lookup (ElevenLabs Custom Tool)

```
During live call, customer asks about menu item
  → ElevenLabs agent triggers custom tool
    → POST /api/v1/menu/items/match
      { "query": "butter chicken" }
    → Backend generates embedding for query
    → pgvector similarity search against active menu_items
    → Returns matched items with names, prices, descriptions
  → Agent uses the response to answer the customer
```

---

## 5. Key Dependencies

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.0
pydantic-settings>=2.0
supabase>=2.0
python-jose[cryptography]>=3.3    # JWT verification (Supabase tokens)
httpx>=0.27                        # Async HTTP (ElevenLabs audio proxy, Gemini API calls)
google-generativeai>=0.8           # Gemini SDK (text generation + embeddings)
twilio>=9.0                        # TwiML generation
python-dateutil>=2.9               # Timezone handling
python-multipart>=0.0.9            # Form data parsing (webhook payloads)
```

---

## 6. Week-by-Week Build Plan

### Week 1 — Core Build (Days 1–5)

| Day | Tasks |
|---|---|
| **Day 1** | Project scaffolding (folder structure, config, Supabase client, CORS, `.env`). DB schema — create all tables in Supabase (including pgvector extension). Auth: JWT verification middleware via Supabase, `GET /auth/me` endpoint. Dependency injection for `current_user`. |
| **Day 2** | Telephony: Twilio incoming webhook (business hours check, agent toggle, TwiML generation with Stream params — caller_number + call_sid). ElevenLabs webhook endpoint: receive post-call data, save call record with transcript + summary. |
| **Day 3** | Gemini AI parser: transcript → extract spoken items + quantities + order_type. pgvector matching: resolve spoken items → real menu items with DB prices. Complete post-call pipeline: parse order → save to `orders` + `order_items`. Menu items match endpoint for ElevenLabs custom tool (no auth). |
| **Day 4** | Dashboard overview endpoint (weekly KPIs, calls graph for past 7 days, recent activity). Calls list endpoint (search, filters, pagination). Call details endpoint (transcript + summary from DB, order items). Audio proxy endpoint. |
| **Day 5** | Menu items CRUD (list, update title/description/toggle active). Auto-generate embeddings on menu item create/update. Resync stub endpoint. Settings endpoints (business hours, dine-in with transfer number, takeaway, divert, SMS dummy, agent toggle). Placeholder routes. |

### Week 2 — Testing, Debugging & Hardening (Days 6–10)

| Day | Tasks |
|---|---|
| **Day 6** | End-to-end testing of the full call flow: Twilio → ElevenLabs → post-call webhook → order parsing. Test custom tool (menu match) during live call. |
| **Day 7** | Frontend integration testing — work with frontend team to verify all endpoints. Fix request/response shape mismatches. |
| **Day 8** | Edge cases: timezone handling, empty states, error responses, missing data. Input validation hardening. Webhook payload validation. |
| **Day 9** | Performance: add DB indexes (`restaurant_id`, `phone_number`, `created_at`). Test pagination with larger datasets. API response time optimization. |
| **Day 10** | Deployment to Render. Environment config (Supabase, ElevenLabs API key, Twilio, Gemini). Final smoke test. Documentation (FastAPI auto `/docs`). |

---

## 7. Open Items (Need Input Later)

| # | Item | Impact |
|---|---|---|
| 1 | Auth roles — single role `owner` or multiple? | User table schema |
| 2 | Multi-tenancy model — how are restaurants onboarded? | Seeding / admin flow |
| 3 | POS system identity — which POS will be integrated in future? (Square, Toast, Clover?) | Resync endpoint design |
| 4 | ElevenLabs webhook payload — paste mock data to finalize field mapping | Post-call pipeline |
| 5 | Dine-in transfer number — how is it passed to the ElevenLabs agent as a dynamic variable? | Agent prompt config |

---

## 8. pgvector — Menu Item Matching Pipeline

### Why pgvector?

Customers use informal names during calls. The AI parser extracts spoken item names, but these won't match DB entries exactly:

| Customer says | Menu DB has |
|---|---|
| "butter chicken" | "Murgh Makhani" |
| "garlic bread" | "Toasted Garlic Flatbread" |
| "a coke" | "Coca-Cola 330ml" |

pgvector provides **semantic similarity search** to resolve spoken names → real menu items with verified prices.

### Dual Usage

The pgvector search is used in two contexts:

1. **During live call** — ElevenLabs agent calls custom tool → `POST /menu/items/match` → checks item availability and retrieves price
2. **Post-call order parsing** — Gemini parser extracts spoken items → pgvector resolves to real menu items with DB prices

### Embedding Generation

- **Model**: Gemini `text-embedding-004` (768 dimensions)
- **Input text**: `"{title or pos_name}. {description}. Price: ${price}"`
- **When generated**:
  - On menu item create (manual DB seed or POS resync)
  - On menu item update (title, description, or price change)
  - Bulk regeneration via resync endpoint

### Matching Flow

```
1. Input: "butter chicken" (from agent tool call or order parser)
2. Generate embedding for "butter chicken"
3. Call match_menu_items RPC:
   - query_embedding = [0.12, -0.34, ...]
   - p_restaurant_id = <restaurant_uuid>
   - match_threshold = 0.7
   - match_count = 3
4. Top result: "Murgh Makhani" (similarity: 0.92, price: $16.99)
5. Return matched item(s) with verified prices from DB
```

### Fallback

If no match exceeds the similarity threshold (0.7), the order item is saved with:
- `menu_item_id = NULL`
- `item_name` = raw spoken name from transcript
- `unit_price` = price extracted by Gemini (best guess)
- A flag or log entry for manual review

---

## 9. ElevenLabs Agent Integration

### Voice Agent Setup

The ElevenLabs voice agent handles live customer calls. The Twilio phone number is connected to the agent via the ElevenLabs dashboard, which gives ElevenLabs Twilio API access for call control (e.g., transfer).

The voice URL in Twilio points to our backend (`POST /telephony/incoming`) for pre-call logic (business hours, agent toggle). If conditions pass, the backend returns TwiML that streams audio to the ElevenLabs agent with caller metadata in Stream params.

### Custom Tool: Menu Lookup

Instead of using ElevenLabs' built-in Knowledge Base, the agent uses a **custom tool** configured in the ElevenLabs dashboard that calls our backend:

**Tool config:**
- **Name**: `search_menu`
- **URL**: `POST https://<backend-url>/api/v1/menu/items/match`
- **Input**: `{ "query": "<item name or description>" }`
- **Output**: Matched menu items with name, price, description, availability
- **Auth**: None for MVP

This allows the agent to check item availability and prices in real-time against the Supabase pgvector database.

### Dine-in Call Transfer

When the agent determines a call is for dine-in and transfer is enabled:

1. Agent uses ElevenLabs native tool calling to transfer the call directly
2. ElevenLabs uses stored Twilio credentials (from dashboard connection) to redirect the live call via Twilio REST API
3. Caller is transferred to the restaurant's dine-in line

### Post-Call Webhook

After each conversation, ElevenLabs sends a POST to `/api/v1/webhooks/elevenlabs` containing:
- `conversation_id`
- `transcript` (array of speaker turns)
- `transcript_summary`
- Caller phone number and call_sid (from Stream params passed during TwiML)
- Call duration and status

This webhook triggers the full post-call processing pipeline (save call, parse order, save order).

---

## 10. Notes

- Single restaurant for MVP. `restaurant_id` is on all tables for future multi-tenancy but routing is not enforced yet.
- Each restaurant has a configured timezone. All time-based logic (business hours, dashboard) respects it.
- Menu items in Supabase serve as the pgvector source for both live agent tool calls and post-call order parsing.
- The `customer_name` field exists on calls/orders for future use but will remain null — the agent does not capture customer names.
- Labor Hours Saved KPI is a dummy/null value for now — depends on client input.
- SMS functionality (send SMS when takeaway order is ready) is deferred from MVP. Toggle is persisted as a dummy setting.
- No missed/failed call tracking for now — only calls that connect to ElevenLabs and complete are recorded via webhook.
- Audio recordings are not stored in the DB — they are fetched on-demand from ElevenLabs API via backend proxy.
- Price and category columns on `menu_items` are not exposed in the frontend UI — they are used by the voice agent during live calls.
- Dashboard KPIs and graphs are weekly (current week Mon–Sun, past 7 days for graph). No percentage change indicators.

---

## 11. Frontend Integration Notes

| Area | Approach |
|---|---|
| Auth | Supabase JS client (`@supabase/supabase-js`) — login, refresh, session management handled client-side |
| API Calls | React Query (TanStack Query) — caching, loading states, refetching |
| JWT | Supabase session token passed as `Authorization: Bearer <token>` to all backend API calls |
| Date/Time | TopBar shows real current date/time in restaurant's configured timezone |
| Call Status | Display `completed` (not `success`) |
| Customer Name | Expect null — display phone number only |
| Dashboard | Weekly KPIs, no percentage change badges, past 7 days call graph |
| Sentiment | Not displayed (removed from dashboard recent activity) |
| Menu Price | Not displayed in frontend Menu Management table — only used by voice agent |
| Settings | Includes: business hours, dine-in (with transfer number input), takeaway, divert threshold, SMS (dummy), agent toggle, region/timezone |
| Cleanup | Remove unused deps: `@google/genai`, `express`, `dotenv`, Syncfusion calendar packages | 
