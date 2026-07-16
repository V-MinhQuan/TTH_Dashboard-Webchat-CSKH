from __future__ import annotations

import asyncio
import math
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Request, Response, status

from app.core.config import get_settings
from app.db.health import check_database_health


router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health/live")
def live() -> dict[str, Any]:
    return {
        "success": True,
        "status": "live",
        "service": "flic-fastapi-backend",
    }


@router.get("/health/ready")
async def ready(request: Request, response: Response) -> dict[str, Any]:
    payload = await _readiness_payload(request)
    if payload["status"] == "not_ready":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return payload


@router.get("/health")
async def health(request: Request, response: Response) -> dict[str, Any]:
    readiness = await _readiness_payload(request)
    if readiness["status"] == "not_ready":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    hf = readiness["components"]["huggingface"]
    db = readiness["components"]["database"]
    return {
        "success": readiness["status"] == "ready",
        "message": (
            "Backend is running successfully."
            if readiness["status"] == "ready"
            else "Backend is running with degraded dependencies."
            if readiness["status"] == "degraded"
            else "Service is not ready."
        ),
        "status": "ok" if readiness["status"] == "ready" else readiness["status"],
        "service": "flic-fastapi-backend",
        "database": db["status"],
        "mlService": "connected" if hf["lastStatus"] == "ok" else "disconnected",
        "version": get_settings().app_version,
        "details": {
            "database": db,
            "ml": {
                **hf,
                "modelLoaded": hf["lastStatus"] == "ok",
                "mlServiceReachable": hf["lastStatus"] == "ok",
            },
            "worker": readiness["components"]["backgroundWorker"],
            "analysisQueue": readiness["analysisQueue"],
        },
        "readiness": readiness["status"],
    }


@router.get("/health/ml")
def ml_health(request: Request) -> dict[str, Any]:
    service = getattr(request.app.state, "sentiment_service", None)
    if service is None:
        return {
            "status": "degraded",
            "source": "huggingface",
            "tokenConfigured": False,
            "lastStatus": "not_called",
            "modelLoaded": False,
            "mlServiceReachable": False,
        }
    return service.get_ml_health()


async def _readiness_payload(request: Request) -> dict[str, Any]:
    database = await asyncio.to_thread(check_database_health)
    db_connected = database.get("status") == "connected"

    service = getattr(request.app.state, "sentiment_service", None)
    if service is None:
        hf = {
            "status": "degraded",
            "tokenConfigured": False,
            "lastStatus": "not_called",
            "lastError": "runtime_not_initialized",
        }
    else:
        provider = service.get_ml_health()
        hf = {
            "status": provider.get("status"),
            "provider": provider.get("provider"),
            "model": provider.get("modelName"),
            "tokenConfigured": bool(provider.get("tokenConfigured")),
            "lastCallAt": provider.get("lastCallAt"),
            "lastSuccessAt": provider.get("lastSuccessAt"),
            "lastStatus": provider.get("lastStatus"),
            "lastError": provider.get("lastError"),
            "lastLatencyMs": provider.get("lastLatencyMs"),
        }

    manager = getattr(request.app.state, "background_worker_manager", None)
    worker = getattr(manager, "worker", None)
    snapshot = getattr(worker, "snapshot", None)
    worker_enabled = bool(getattr(request.app.state, "hf_background_enabled", True))
    cutover_message_id = getattr(
        request.app.state,
        "hf_analysis_cutover_message_id",
        None,
    )
    cutover_configured = cutover_message_id is not None
    worker_running = bool(manager and manager.is_running)
    heartbeat_at = getattr(snapshot, "heartbeat_at", None)
    heartbeat_fresh = _heartbeat_is_fresh(heartbeat_at) if worker_enabled else None
    worker_payload = {
        "enabled": worker_enabled,
        "status": (
            "disabled"
            if not worker_enabled
            else "misconfigured"
            if not cutover_configured
            else "running"
            if worker_running and heartbeat_fresh
            else "stalled"
            if worker_running
            else "stopped"
        ),
        "heartbeatAt": heartbeat_at,
        "heartbeatFresh": heartbeat_fresh,
        "cutoverConfigured": cutover_configured,
        "cutoverMessageId": cutover_message_id,
        "lastError": (
            None
            if not worker_enabled
            else "missing_cutover_message_id"
            if not cutover_configured
            else getattr(snapshot, "last_error", None)
        ),
        "lastBatchSize": getattr(snapshot, "last_batch_size", 0),
        "totalCompleted": getattr(snapshot, "total_completed", 0),
    }

    repository = getattr(request.app.state, "sentiment_repository", None)
    if repository is None:
        queue_counts = {"available": False, "pending": None, "processing": None, "failed": None}
    else:
        try:
            counts = await asyncio.to_thread(repository.get_status_counts)
            queue_counts = {"available": True, **counts}
        except Exception:
            queue_counts = {"available": False, "pending": None, "processing": None, "failed": None}

    if not db_connected:
        readiness = "not_ready"
    elif (
        not hf.get("tokenConfigured")
        or (worker_enabled and not cutover_configured)
        or (worker_enabled and not worker_running)
        or (worker_enabled and not heartbeat_fresh)
        or (worker_enabled and not queue_counts["available"])
    ):
        readiness = "degraded"
    elif hf.get("lastStatus") != "ok" or (worker_enabled and worker_payload["lastError"]):
        readiness = "degraded"
    else:
        readiness = "ready"

    return {
        "success": readiness == "ready",
        "status": readiness,
        "service": "flic-fastapi-backend",
        "components": {
            "database": database,
            "huggingface": hf,
            "backgroundWorker": worker_payload,
        },
        "analysisQueue": queue_counts,
    }


def _heartbeat_is_fresh(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    settings = get_settings()
    request_budget = (
        float(settings.hf_timeout_seconds) * (int(settings.hf_max_retries) + 1)
        + sum(2**attempt for attempt in range(int(settings.hf_max_retries)))
    )
    waves = max(
        1,
        math.ceil(
            int(settings.hf_batch_size)
            / max(1, int(settings.hf_max_concurrency))
        ),
    )
    max_age_seconds = max(
        60.0,
        float(settings.hf_background_interval_seconds) * 3 + request_budget * waves,
    )
    age_seconds = (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds()
    return age_seconds <= max_age_seconds
