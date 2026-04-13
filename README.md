# SKAI

AI-powered restaurant phone ordering system. Incoming calls hit **Twilio**, voice is handled by **ElevenLabs**, transcripts are parsed by **Google Gemini**, and menu matching uses **pgvector** embeddings on **Supabase (Postgres)**. A **React** dashboard lets restaurant owners manage calls, orders, menus, and settings.

## Architecture

```
Phone Call
    │
    ▼
  Twilio ──POST /telephony/incoming──▶ FastAPI Backend
    │                                       │
    │  TwiML + WebSocket Stream             │ Business hours / agent toggle check
    ▼                                       │
ElevenLabs Voice Agent ◄───────────────────┘
    │
    │ Custom tool calls (live)         Post-call webhook
    │  POST /menu/items/match          POST /webhooks/elevenlabs
    ▼                                       │
pgvector similarity search                  ▼
  (Supabase Postgres)              Save call record
                                            │
                                   Gemini transcript parser
                                            │
                                   pgvector menu matching
                                            │
                                   Save order + order items
                                            │
                                            ▼
                              React Dashboard (Supabase Auth)
                                   TanStack Query → REST API
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12+, FastAPI, Pydantic v2, Uvicorn |
| **Database** | Supabase (Postgres), pgvector, Supabase Auth |
| **AI** | Google Gemini (transcript parsing + embeddings) |
| **Voice** | ElevenLabs Conversational AI, Twilio |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack React Query |
| **Deployment** | Render (backend), Supabase (DB + auth), Vercel/Netlify (frontend) |

## Project Structure

```
skai/
├── README.md                       ← you are here
├── PLAN.md                         # Detailed architecture / API / DB design doc
│
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, global error handler
│   │   ├── config.py               # Settings via pydantic-settings (.env)
│   │   ├── dependencies.py         # JWT auth, Twilio sig verification, webhook secret
│   │   ├── auth/                   # GET /auth/me
│   │   ├── dashboard/              # GET /dashboard/overview (KPIs, call graph)
│   │   ├── calls/                  # Call list, detail, audio proxy, ElevenLabs sync
│   │   ├── orders/                 # Gemini parser → pgvector match → save order
│   │   ├── menu/                   # CRUD, embeddings, vector match endpoint
│   │   ├── settings/               # Business hours, dine-in, takeaway, divert, SMS, agent toggle
│   │   ├── telephony/              # Twilio voice webhook, TwiML, personalization
│   │   ├── webhooks/               # ElevenLabs post-call webhook
│   │   ├── db/                     # Supabase client, table constants, SQL migrations
│   │   └── utils/                  # Response helpers, pagination, timezone
│   ├── pyproject.toml
│   ├── .env.example
│   └── README.md                   # Backend-specific setup + deployment
│
└── frontend/
    ├── src/
    │   ├── App.tsx                  # Routes, error boundaries
    │   ├── main.tsx                 # React Query + Auth + Toaster providers
    │   ├── pages/                   # Dashboard, Calls, Menu, Settings, Login
    │   ├── components/              # Layout, Sidebar, TopBar, ErrorBoundary, Toaster
    │   └── lib/                     # API client, auth context, Supabase, realtime, toast
    ├── package.json
    └── .env.example
```

## Getting Started

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) 18+ and npm
- A [Supabase](https://supabase.com/) project with pgvector enabled
- API keys for: Google Gemini, ElevenLabs, Twilio

### 1. Database Setup

Run the SQL migration files in `backend/app/db/migrations/` against your Supabase project **in order** (001, 002, ..., 008) via the Supabase SQL editor.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in all credentials in .env

uv sync --python 3.12
uv run --python 3.12 uvicorn app.main:app --reload
```

API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Fill in Supabase URL, anon key, and API base URL

npm install
npm run dev
```

Dashboard at [http://localhost:3000](http://localhost:3000)

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | JWT secret for HS256 verification |
| `GEMINI_API_KEY` | Google Gemini API key |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `WEBHOOK_SECRET` | Shared secret for agent custom tool endpoints via X-Webhook-Secret header (empty = skip in dev) |
| `ELEVENLABS_WEBHOOK_SECRET` | HMAC secret from ElevenLabs post-call webhook settings (empty = skip in dev) |
| `TWILIO_VALIDATE_SIGNATURES` | Validate Twilio X-Twilio-Signature header (`true`/`false`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `ENV` | `development` or `production` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_API_BASE_URL` | Backend URL (default: `http://localhost:8000`) |

## API Overview

All endpoints are versioned under `/api/v1/`. Protected endpoints require a `Authorization: Bearer <supabase-jwt>` header. Agent tool endpoints require `X-Webhook-Secret` header. The post-call webhook verifies `elevenlabs-signature` via HMAC.

| Module | Key Endpoints |
|--------|--------------|
| Auth | `GET /auth/me` |
| Dashboard | `GET /dashboard/overview` |
| Calls | `GET /calls`, `GET /calls/{id}/details`, `GET /calls/{id}/audio` |
| Menu | `GET /menu/items`, `PATCH /menu/items/{id}`, `POST /menu/items/match` |
| Settings | `GET /settings`, `PUT /settings/business-hours`, `PUT /settings/agent-toggle`, ... |
| Telephony | `POST /telephony/incoming`, `POST /telephony/personalize`, `POST /telephony/check-takeaway` |
| Webhooks | `POST /webhooks/elevenlabs` |

## Core Flows

1. **Incoming Call** — Twilio POST -> business hours check -> TwiML streams audio to ElevenLabs agent
2. **Live Menu Lookup** — ElevenLabs agent custom tool -> `POST /menu/items/match` -> pgvector search
3. **Post-Call Processing** — ElevenLabs webhook -> save call -> background task: Gemini parser -> pgvector match -> save order
4. **Dashboard** — Weekly KPIs, call volume graph, recent activity from Supabase

## Deployment

See [`backend/README.md`](backend/README.md) for Render deployment configuration and environment variable setup.
