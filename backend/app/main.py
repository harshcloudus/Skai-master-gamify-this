import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.auth.router import router as auth_router
from app.telephony.router import router as telephony_router
from app.webhooks.router import router as webhooks_router
from app.menu.router import router as menu_router
from app.dashboard.router import router as dashboard_router
from app.calls.router import router as calls_router
from app.settings.router import router as settings_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings()
    yield


app = FastAPI(
    title="SKAI Backend",
    description="AI-powered restaurant phone ordering system",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled error on %s %s: %s", request.method, request.url.path, exc
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# ── Routers ────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(telephony_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(menu_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(calls_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")


# ── Placeholder routes ─────────────────────────────────────
@app.get("/api/v1/reports", tags=["Placeholders"])
async def reports_placeholder():
    return {"message": "Coming soon"}


@app.get("/api/v1/earnings", tags=["Placeholders"])
async def earnings_placeholder():
    return {"message": "Coming soon"}


@app.get("/api/v1/support", tags=["Placeholders"])
async def support_placeholder():
    return {"message": "Coming soon"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
