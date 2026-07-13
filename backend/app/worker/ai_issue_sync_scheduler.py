from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta

from app.services.ai_issue_sync_service import sync_ai_issue_flags
from app.services.message_keyword_sync_service import sync_customer_message_keywords

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
            keyword_total = 0
            checkpoint = None
            while True:
                keyword_result = await asyncio.to_thread(
                    sync_customer_message_keywords,
                    apply=True,
                    batch_size=1000,
                    after_id=checkpoint,
                )
                keyword_total += keyword_result.updated_rows
                checkpoint = keyword_result.last_message_id
                if keyword_result.scanned_rows < 1000:
                    break
            ai_total_updated = 0
            ai_total_inserted = 0
            ai_checkpoint = None
            while True:
                result = await asyncio.to_thread(
                    sync_ai_issue_flags,
                    apply=True,
                    batch_size=1000,
                    after_message_id=ai_checkpoint,
                )
                ai_total_updated += result.updated_rows
                ai_total_inserted += result.inserted_rows
                ai_checkpoint = result.last_message_id
                if result.total_ai_messages < 1000:
                    break
            logger.info(
                "AI issue sync completed: total=%s, updated=%s, inserted=%s, flagged=%s, counts=%s",
                result.total_ai_messages,
                result.updated_rows,
                result.inserted_rows,
                result.flagged_rows,
                result.issue_counts,
            )
            logger.info("Nightly AI analytics totals updated=%s inserted=%s.", ai_total_updated, ai_total_inserted)
            logger.info("Nightly customer keyword sync updated=%s.", keyword_total)
        except Exception as exc:
            logger.exception("AI issue sync failed: %s", exc)

        await asyncio.sleep(60)
