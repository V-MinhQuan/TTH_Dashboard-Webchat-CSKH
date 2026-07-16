from __future__ import annotations

import asyncio
import logging

from app.worker.ai_analytics_worker import SentimentAnalysisWorker
from app.worker.dashboard_worker import DashboardPrecomputeWorker

logger = logging.getLogger(__name__)


class BackgroundWorkerManager:
    """Quản lý các tiến trình chạy ngầm (Background Workers) của Backend."""

    def __init__(self, sentiment_worker: SentimentAnalysisWorker, dashboard_worker: DashboardPrecomputeWorker) -> None:
        self.sentiment_worker = sentiment_worker
        self.dashboard_worker = dashboard_worker
        self._sentiment_task: asyncio.Task[None] | None = None
        self._dashboard_task: asyncio.Task[None] | None = None

    @property
    def is_running(self) -> bool:
        sentiment_running = self._sentiment_task is not None and not self._sentiment_task.done()
        dashboard_running = self._dashboard_task is not None and not self._dashboard_task.done()
        return sentiment_running or dashboard_running

    def start(self) -> None:
        if self._sentiment_task is None or self._sentiment_task.done():
            self._sentiment_task = asyncio.create_task(
                self.sentiment_worker.run_forever(),
                name="hf-sentiment-background-worker",
            )
            self._sentiment_task.add_done_callback(self._on_done)
            
        if self._dashboard_task is None or self._dashboard_task.done():
            self._dashboard_task = asyncio.create_task(
                self.dashboard_worker.run_forever(),
                name="dashboard-precompute-worker",
            )
            self._dashboard_task.add_done_callback(self._on_done)

    async def stop(self) -> None:
        tasks = []
        if self._sentiment_task and not self._sentiment_task.done():
            self._sentiment_task.cancel()
            tasks.append(self._sentiment_task)
            
        if self._dashboard_task and not self._dashboard_task.done():
            self.dashboard_worker.stop()
            self._dashboard_task.cancel()
            tasks.append(self._dashboard_task)
            
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
        self._sentiment_task = None
        self._dashboard_task = None

    @staticmethod
    def _on_done(task: asyncio.Task[None]) -> None:
        if task.cancelled():
            return
        error = task.exception()
        if error is not None:
            logger.error("Background worker stopped unexpectedly: %s", type(error).__name__)
