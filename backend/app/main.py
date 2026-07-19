from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.repositories.sentiment_repository import SentimentRepository
from app.routers import activity, ai_error_keywords, analytics, auth, chart_builder, conversations, dashboard, feedback, health, sentiment, settings
from app.routers.legacy import router as legacy_router
from app.services.huggingface_sentiment_client import HuggingFaceSentimentClient
from app.services.sentiment_service import SentimentService
from app.worker.ai_analytics_worker import SentimentAnalysisWorker
from app.worker.ai_issue_sync_worker import AiIssueKeywordSyncWorker
from app.worker.dashboard_worker import DashboardPrecomputeWorker
from app.worker.manager import BackgroundWorkerManager


configure_logging()
settings_obj = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    hf_client = HuggingFaceSentimentClient(settings_obj)
    repository = SentimentRepository()
    sentiment_service = SentimentService(hf_client)
    sentiment_worker = SentimentAnalysisWorker(repository, hf_client, settings_obj)
    dashboard_worker = DashboardPrecomputeWorker(interval_seconds=600)
    ai_issue_sync_worker = (
        AiIssueKeywordSyncWorker(settings_obj)
        if settings_obj.ai_analytics_sync_enabled
        else None
    )
    manager = BackgroundWorkerManager(sentiment_worker, dashboard_worker, ai_issue_sync_worker)

    app.state.hf_sentiment_client = hf_client
    app.state.sentiment_repository = repository
    app.state.sentiment_service = sentiment_service
    app.state.background_worker_manager = manager
    app.state.hf_background_enabled = settings_obj.hf_background_enabled
    app.state.hf_analysis_cutover_message_id = (
        settings_obj.hf_analysis_cutover_message_id
    )
    if settings_obj.hf_background_enabled:
        manager.start()
    try:
        yield
    finally:
        await manager.stop()
        await hf_client.close()


app = FastAPI(
    title=settings_obj.app_name,
    version=settings_obj.app_version,
    description="FastAPI backend for the FLIC WebChat dashboard.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_obj.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(chart_builder.router)
app.include_router(sentiment.router)
app.include_router(conversations.router)
app.include_router(settings.router)
app.include_router(feedback.router)
app.include_router(ai_error_keywords.router)
app.include_router(activity.router)
app.include_router(legacy_router)


@app.get("/")
def root():
    return {
        "service": "flic-fastapi-backend",
        "version": settings_obj.app_version,
        "apiBase": "/api",
        "sentimentRuntime": "huggingface-inference-providers",
    }
