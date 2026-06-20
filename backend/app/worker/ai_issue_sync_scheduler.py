from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta

from app.services.ai_issue_sync_service import sync_ai_issue_flags

logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid %s=%r, using %s", name, raw, default)
        return default


def _next_run_at(now: datetime, hour: int, minute: int) -> datetime:
    next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_run <= now:
        next_run += timedelta(days=1)
    return next_run


async def start_ai_issue_sync_scheduler():
    if not _env_bool("AI_ISSUE_SYNC_ENABLED", True):
        logger.info("AI issue sync scheduler disabled by AI_ISSUE_SYNC_ENABLED.")
        return

    hour = max(0, min(23, _env_int("AI_ISSUE_SYNC_HOUR", 2)))
    minute = max(0, min(59, _env_int("AI_ISSUE_SYNC_MINUTE", 0)))
    logger.info("AI issue sync scheduler started for %02d:%02d local time.", hour, minute)

    while True:
        now = datetime.now()
        next_run = _next_run_at(now, hour, minute)
        delay_seconds = max((next_run - now).total_seconds(), 0)
        logger.info("Next AI issue sync run at %s.", next_run.isoformat(timespec="seconds"))
        await asyncio.sleep(delay_seconds)

        try:
            result = await asyncio.to_thread(sync_ai_issue_flags, apply=True)
            logger.info(
                "AI issue sync completed: total=%s, updated=%s, inserted=%s, flagged=%s, counts=%s",
                result.total_ai_messages,
                result.updated_rows,
                result.inserted_rows,
                result.flagged_rows,
                result.issue_counts,
            )
        except Exception as exc:
            logger.exception("AI issue sync failed: %s", exc)

        await asyncio.sleep(60)
