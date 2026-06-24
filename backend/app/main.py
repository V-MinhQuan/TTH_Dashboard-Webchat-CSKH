from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.routers import analytics, auth, chart_builder, conversations, dashboard, feedback, health, sentiment, settings
from app.routers.legacy import router as legacy_router
from app.tasks.background import enqueue_background_workers

configure_logging()
settings_obj = get_settings()

app = FastAPI(
    title=settings_obj.app_name,
    version=settings_obj.app_version,
    description="Controlled FastAPI migration backend for FLIC WebChat dashboard.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_obj.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

register_exception_handlers(app)

# ── Modular routers (new, database-driven) ──────────────────────────────────
# Auth router is included BEFORE legacy so /api/auth/login uses the new
# role-from-database logic instead of hardcoded usernames.
app.include_router(auth.router)
app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(chart_builder.router)
app.include_router(sentiment.router)
app.include_router(conversations.router)
app.include_router(settings.router)
app.include_router(feedback.router)

# ── Legacy router (compatibility layer) ──────────────────────────────────────
# Mounted AFTER modular routers so that new endpoints take precedence.
# The legacy /api/auth/login is now shadowed by the modular auth router.
# Do NOT add new endpoints here — use the modular structure above.
app.include_router(legacy_router)


@app.get("/")
def root():
    return {
        "service": "flic-fastapi-backend",
        "version": settings_obj.app_version,
        "apiBase": "/api",
        "migrationStatus": "parallel_run_candidate",
    }

@app.on_event("startup")
async def startup_event():
    enqueue_background_workers()

