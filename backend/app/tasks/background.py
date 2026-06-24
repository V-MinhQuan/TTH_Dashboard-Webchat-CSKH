from __future__ import annotations

import asyncio
import logging
from typing import Callable, Coroutine, Any

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.worker.ai_analytics_worker import start_analytics_worker
from app.worker.ai_issue_sync_scheduler import start_ai_issue_sync_scheduler

logger = logging.getLogger(__name__)


AsyncWorker = Callable[[], Coroutine[Any, Any, None]]


def _run_async_worker(worker: AsyncWorker) -> None:
    asyncio.run(worker())


@celery_app.task(name="start_analytics_worker", ignore_result=True)
def start_analytics_worker_task() -> None:
    _run_async_worker(start_analytics_worker)


@celery_app.task(name="start_ai_issue_sync_scheduler", ignore_result=True)
def start_ai_issue_sync_scheduler_task() -> None:
    _run_async_worker(start_ai_issue_sync_scheduler)


def enqueue_background_workers() -> list[str]:
    settings = get_settings()
    if not settings.celery_enqueue_on_startup:
        logger.info("Celery startup enqueue disabled by CELERY_ENQUEUE_ON_STARTUP.")
        return []

    task_ids: list[str] = []
    try:
        for task in (start_analytics_worker_task, start_ai_issue_sync_scheduler_task):
            result = task.apply_async(queue=settings.celery_background_queue)
            task_ids.append(result.id)
        logger.info("Queued Celery background workers: %s", task_ids)
    except Exception as exc:
        logger.exception("Could not queue Celery background workers: %s", exc)
    return task_ids
