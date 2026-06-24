import os

from celery import Celery

from app.core.config import get_settings


settings = get_settings()

celery_app = Celery(
    "flic_fastapi_backend",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.background"],
)

celery_config = {
    "accept_content": ["json"],
    "broker_connection_retry_on_startup": True,
    "broker_connection_timeout": 2,
    "result_serializer": "json",
    "task_default_queue": settings.celery_background_queue,
    "task_serializer": "json",
    "task_track_started": True,
    "timezone": "Asia/Ho_Chi_Minh",
    "worker_prefetch_multiplier": 1,
}

if os.name == "nt":
    celery_config.update(
        worker_concurrency=2,
        worker_pool="threads",
    )

celery_app.conf.update(**celery_config)
