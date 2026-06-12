from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.routers import analytics, conversations, dashboard, health, sentiment
from app.routers.legacy import router as legacy_router

configure_logging()
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Controlled FastAPI migration backend for FLIC WebChat dashboard.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

register_exception_handlers(app)

# Include legacy router first so its endpoints take precedence over the new ones
# This guarantees that Develop's functionality is not lost and UI remains the same
app.include_router(legacy_router)

app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(sentiment.router)
app.include_router(conversations.router)


@app.get("/")
def root():
    return {
        "service": "flic-fastapi-backend",
        "version": settings.app_version,
        "apiBase": "/api",
        "migrationStatus": "parallel_run_candidate",
    }

