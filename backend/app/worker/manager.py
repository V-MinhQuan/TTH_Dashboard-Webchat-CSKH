from __future__ import annotations

import asyncio
import logging

from app.worker.ai_analytics_worker import SentimentAnalysisWorker
from app.worker.dashboard_worker import DashboardPrecomputeWorker
from app.worker.ai_issue_sync_worker import AiIssueKeywordSyncWorker

logger = logging.getLogger(__name__)


class BackgroundWorkerManager:
    """Quản lý các tiến trình chạy ngầm (Background Workers) của Backend."""

    def __init__(
        self,
        sentiment_worker: SentimentAnalysisWorker,
        dashboard_worker: DashboardPrecomputeWorker,
        ai_issue_sync_worker: AiIssueKeywordSyncWorker | None = None,
    ) -> None:
        self.sentiment_worker = sentiment_worker
        self.dashboard_worker = dashboard_worker
        self.ai_issue_sync_worker = ai_issue_sync_worker
        self._sentiment_task: asyncio.Task[None] | None = None
        self._dashboard_task: asyncio.Task[None] | None = None
        self._ai_issue_sync_task: asyncio.Task[None] | None = None

    @property
    def is_running(self) -> bool:
        sentiment_running = self._sentiment_task is not None and not self._sentiment_task.done()
        dashboard_running = self._dashboard_task is not None and not self._dashboard_task.done()
        sync_running = (
            self.ai_issue_sync_worker is None
            or (self._ai_issue_sync_task is not None and not self._ai_issue_sync_task.done())
        )
        return sentiment_running and dashboard_running and sync_running

    @property
    def worker(self) -> SentimentAnalysisWorker:
        """Backward-compatible health-check access to the sentiment snapshot."""
        return self.sentiment_worker

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

        if self.ai_issue_sync_worker is not None and (
            self._ai_issue_sync_task is None or self._ai_issue_sync_task.done()
        ):
            self._ai_issue_sync_task = asyncio.create_task(
                self.ai_issue_sync_worker.run_forever(),
                name="ai-issue-keyword-sync-worker",
            )
            self._ai_issue_sync_task.add_done_callback(self._on_done)

    async def stop(self) -> None:
        tasks = []
        if self._sentiment_task and not self._sentiment_task.done():
            self._sentiment_task.cancel()
            tasks.append(self._sentiment_task)
            
        if self._dashboard_task and not self._dashboard_task.done():
            self.dashboard_worker.stop()
            self._dashboard_task.cancel()
            tasks.append(self._dashboard_task)

        if self._ai_issue_sync_task and not self._ai_issue_sync_task.done():
            self._ai_issue_sync_task.cancel()
            tasks.append(self._ai_issue_sync_task)
            
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
        self._sentiment_task = None
        self._dashboard_task = None
        self._ai_issue_sync_task = None

    @staticmethod
    def _on_done(task: asyncio.Task[None]) -> None:
        if task.cancelled():
            return
        error = task.exception()
        if error is not None:
            logger.error("Background worker stopped unexpectedly: %s", type(error).__name__)
