from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.services.ai_issue_sync_service import sync_ai_issue_flags


logger = logging.getLogger(__name__)


class AiIssueKeywordSyncWorker:
    """Periodically refresh AI issue flags, topics, and detected keywords."""

    def __init__(self, settings, *, sleep=asyncio.sleep):
        self.settings = settings
        self._sleep = sleep

    def _since(self) -> str:
        start = datetime.now(timezone.utc) - timedelta(
            hours=int(self.settings.ai_analytics_sync_lookback_hours)
        )
        return start.replace(tzinfo=None, microsecond=0).isoformat(sep=" ")

    async def run_once(self):
        since = self._since()
        result = await asyncio.to_thread(
            sync_ai_issue_flags,
            apply=True,
            since=since,
        )
        logger.info(
            "AI issue/keyword sync completed since=%s scanned=%d updated=%d flagged=%d",
            since,
            result.total_ai_messages,
            result.updated_rows,
            result.flagged_rows,
        )
        return result

    async def run_forever(self) -> None:
        logger.info(
            "AI issue/keyword sync worker started interval=%ds lookback=%dh startupDelay=%ds",
            int(self.settings.ai_analytics_sync_interval_seconds),
            int(self.settings.ai_analytics_sync_lookback_hours),
            int(self.settings.ai_analytics_sync_startup_delay_seconds),
        )
        startup_delay = int(self.settings.ai_analytics_sync_startup_delay_seconds)
        if startup_delay > 0:
            await self._sleep(startup_delay)
        while True:
            try:
                await self.run_once()
            except asyncio.CancelledError:
                logger.info("AI issue/keyword sync worker stopping.")
                raise
            except Exception as exc:
                logger.error(
                    "AI issue/keyword sync iteration failed error_type=%s; retrying next cycle.",
                    type(exc).__name__,
                )
            await self._sleep(int(self.settings.ai_analytics_sync_interval_seconds))
