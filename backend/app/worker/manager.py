from __future__ import annotations

import asyncio
import logging

from app.worker.ai_analytics_worker import SentimentAnalysisWorker


logger = logging.getLogger(__name__)


class BackgroundWorkerManager:
    """Own exactly one in-process sentiment loop for this Backend process."""

    def __init__(self, worker: SentimentAnalysisWorker) -> None:
        self.worker = worker
        self._task: asyncio.Task[None] | None = None

    @property
    def task(self) -> asyncio.Task[None] | None:
        return self._task

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self) -> asyncio.Task[None]:
        if self._task is not None and not self._task.done():
            return self._task
        self._task = asyncio.create_task(
            self.worker.run_forever(),
            name="hf-sentiment-background-worker",
        )
        self._task.add_done_callback(self._on_done)
        return self._task

    async def stop(self) -> None:
        task = self._task
        if task is None:
            return
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        self._task = None

    @staticmethod
    def _on_done(task: asyncio.Task[None]) -> None:
        if task.cancelled():
            return
        error = task.exception()
        if error is not None:
            logger.error("Background sentiment worker stopped unexpectedly: %s", type(error).__name__)

