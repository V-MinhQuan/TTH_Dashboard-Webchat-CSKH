import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.tasks import background


def test_enqueue_background_workers_skips_unreachable_redis(monkeypatch):
    class Settings:
        celery_enqueue_on_startup = True
        celery_broker_url = "redis://localhost:6379/0"
        celery_background_queue = "background"

    def fail_apply_async(*_args, **_kwargs):
        raise AssertionError("Celery should not be called when Redis is unreachable")

    monkeypatch.setattr(background, "get_settings", lambda: Settings())
    monkeypatch.setattr(background, "_redis_broker_is_reachable", lambda _url: False)
    monkeypatch.setattr(background.start_analytics_worker_task, "apply_async", fail_apply_async)
    monkeypatch.setattr(background.start_ai_issue_sync_scheduler_task, "apply_async", fail_apply_async)

    assert background.enqueue_background_workers() == []
