# SKAI Backend

FastAPI backend for SKAI — AI-powered restaurant phone ordering system.

## Setup

### Local: `uv`

1. Install `uv`:

Windows (PowerShell):

```powershell
irm https://astral.sh/uv/install.ps1 | iex
$env:Path = "C:\Users\Cloudus\.local\bin;$env:Path"
```

2. Install dependencies and run:

```powershell
cd backend
uv sync --python 3.12
uv run --python 3.12 uvicorn app.main:app --reload
```

3. Copy `.env.example` to `.env` and fill in your credentials.

4. Open API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

Create a **Web Service** in the Render dashboard and configure:

| Setting | Value |
|--------|--------|
| **Environment** | Python 3 (set version to **3.12**; matches `backend/.python-version`) |
| **Root Directory** | `backend` |
| **Build Command** | `pip install uv && uv sync --frozen --no-dev` |
| **Start Command** | `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Add these environment variables in Render:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_JWT_SECRET`
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `WEBHOOK_SECRET` (shared secret for agent custom tool endpoints — X-Webhook-Secret header)
- `ELEVENLABS_WEBHOOK_SECRET` (HMAC secret from ElevenLabs post-call webhook settings)
- `TWILIO_VALIDATE_SIGNATURES=true`
- `CORS_ORIGINS` (include your frontend URL)
- `ENV=production`

## Database

Run the SQL migration files in `app/db/migrations/` against your Supabase project in order.
