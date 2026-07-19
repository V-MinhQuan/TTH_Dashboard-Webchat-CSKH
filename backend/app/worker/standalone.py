from __future__ import annotations

import asyncio
import logging
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.repositories.sentiment_repository import SentimentRepository
from app.services.huggingface_sentiment_client import HuggingFaceSentimentClient
from app.worker.ai_analytics_worker import SentimentAnalysisWorker
from app.worker.ai_issue_sync_worker import AiIssueKeywordSyncWorker
from app.worker.dashboard_worker import DashboardPrecomputeWorker
from app.worker.manager import BackgroundWorkerManager


logger = logging.getLogger(__name__)
LOCK_FILE = Path(__file__).resolve().parents[3] / "logs" / "background-worker.lock"


@contextmanager
def single_instance_lock(path: Path = LOCK_FILE) -> Iterator[None]:
    """Prevent two scheduler services from running on the same host."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_file = path.open("a+b")
    acquired = False
    try:
        lock_file.seek(0, os.SEEK_END)
        if lock_file.tell() == 0:
            lock_file.write(b"0")
            lock_file.flush()
        lock_file.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            acquired = True
        except (OSError, BlockingIOError) as error:
            raise RuntimeError(
                "Another standalone background worker is already running on this host."
            ) from error

        yield
    finally:
        try:
            if acquired:
                lock_file.seek(0)
                if os.name == "nt":
                    import msvcrt

                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        finally:
            lock_file.close()


async def run() -> None:
    """Run exactly one persistent background-worker process."""
    configure_logging()
    settings = get_settings()
    if not settings.hf_background_enabled:
        raise RuntimeError(
            "HF_BACKGROUND_ENABLED must be true for the standalone worker service."
        )

    hf_client = HuggingFaceSentimentClient(settings)
    ai_issue_sync_worker = (
        AiIssueKeywordSyncWorker(settings)
        if settings.ai_analytics_sync_enabled
        else None
    )
    manager = BackgroundWorkerManager(
        SentimentAnalysisWorker(SentimentRepository(), hf_client, settings),
        DashboardPrecomputeWorker(interval_seconds=600),
        ai_issue_sync_worker,
    )
    manager.start()
    logger.info("Standalone background worker service started.")

    try:
        while True:
            await asyncio.sleep(30)
            if not manager.is_running:
                raise RuntimeError("A managed background worker stopped unexpectedly.")
    finally:
        await manager.stop()
        await hf_client.close()
        logger.info("Standalone background worker service stopped.")


def main() -> None:
    try:
        with single_instance_lock():
            asyncio.run(run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
