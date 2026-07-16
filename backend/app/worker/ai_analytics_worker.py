from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from app.core.config import Settings, get_settings
from app.core.topic_taxonomy import canonical_topic_labels, extract_all_keywords
from app.repositories.sentiment_repository import SentimentRepository
from app.services.ai_issue_classifier import classify_ai_issue
from app.services.customer_message_resolver import (
    CustomerMessageResolutionError,
    resolve_customer_message_for_analysis,
)
from app.services.huggingface_sentiment_client import (
    HuggingFaceClientError,
    HuggingFaceSentimentClient,
)


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WorkerSnapshot:
    started_at: str | None = None
    heartbeat_at: str | None = None
    last_error: str | None = None
    last_batch_size: int = 0
    total_completed: int = 0
    iterations: int = 0


class SentimentAnalysisWorker:
    def __init__(
        self,
        repository: SentimentRepository,
        client: HuggingFaceSentimentClient,
        settings: Settings | Any | None = None,
        *,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.repository = repository
        self.client = client
        self.settings = settings or get_settings()
        self._sleep = sleep
        self._snapshot = WorkerSnapshot()

    @property
    def snapshot(self) -> WorkerSnapshot:
        return self._snapshot

    async def run_once(self) -> int:
        cutover_message_id = getattr(
            self.settings,
            "hf_analysis_cutover_message_id",
            None,
        )
        if cutover_message_id is None:
            self._heartbeat(
                last_error="missing_cutover_message_id",
                batch_size=0,
                completed=0,
            )
            return 0

        await asyncio.to_thread(
            self.repository.recover_stale_jobs,
            int(self.settings.hf_processing_stale_minutes),
            int(self.settings.hf_max_retries),
            int(cutover_message_id),
        )
        await asyncio.to_thread(
            self.repository.discover_pending_jobs,
            int(self.settings.hf_batch_size),
            int(cutover_message_id),
        )
        if not self.client.configured:
            self._heartbeat(last_error="missing_token", batch_size=0, completed=0)
            return 0

        jobs = await asyncio.to_thread(
            self.repository.claim_pending_batch,
            int(self.settings.hf_batch_size),
            int(cutover_message_id),
        )
        if not jobs:
            self._heartbeat(last_error=None, batch_size=0, completed=0)
            return 0

        results = await asyncio.gather(*(self._process_job(job) for job in jobs))
        completed = sum(1 for result in results if result)
        self._heartbeat(last_error=None, batch_size=len(jobs), completed=completed)
        return completed

    async def run_forever(self) -> None:
        started_at = _utc_now()
        self._snapshot = replace(self._snapshot, started_at=started_at, heartbeat_at=started_at)
        logger.info("SQL-backed Hugging Face sentiment worker started.")
        while True:
            try:
                await self.run_once()
            except asyncio.CancelledError:
                logger.info("SQL-backed Hugging Face sentiment worker stopping.")
                raise
            except Exception as exc:
                self._heartbeat(last_error="worker_iteration_failed", batch_size=0, completed=0)
                logger.error(
                    "Sentiment worker iteration failed error_type=%s; the loop will continue.",
                    type(exc).__name__,
                )
            await self._sleep(float(self.settings.hf_background_interval_seconds))

    async def _process_job(self, job: dict[str, Any]) -> bool:
        message_id = job.get("messageId")
        try:
            customer_message = resolve_customer_message_for_analysis(job)
            enriched_job = {
                **_enrich_job(
                    {
                        **job,
                        "messageId": customer_message.customer_message_id,
                        "CustomerText": customer_message.customer_text,
                        "conversationId": customer_message.conversation_id,
                        "channel": customer_message.channel,
                        "topic": customer_message.topic,
                        "createdAt": customer_message.created_at,
                    }
                ),
                "analysisModel": getattr(self.client, "model", "huggingface-api"),
            }
            prediction = await self.client.predict(customer_message.customer_text)
            await asyncio.to_thread(self.repository.complete_job, enriched_job, prediction)
            return True
        except asyncio.CancelledError:
            raise
        except CustomerMessageResolutionError as exc:
            if message_id is not None:
                await asyncio.to_thread(
                    self.repository.record_failure,
                    message_id,
                    str(exc),
                    False,
                    int(self.settings.hf_max_retries),
                )
            return False
        except HuggingFaceClientError as exc:
            await asyncio.to_thread(
                self.repository.record_failure,
                message_id,
                exc.code,
                exc.retryable,
                int(self.settings.hf_max_retries),
            )
            return False
        except Exception as exc:
            logger.error(
                "Sentiment job failed message_id=%s error_type=%s",
                message_id,
                type(exc).__name__,
            )
            await asyncio.to_thread(
                self.repository.record_failure,
                message_id,
                "processing_error",
                True,
                int(self.settings.hf_max_retries),
            )
            return False

    def _heartbeat(self, *, last_error: str | None, batch_size: int, completed: int) -> None:
        self._snapshot = replace(
            self._snapshot,
            heartbeat_at=_utc_now(),
            last_error=last_error,
            last_batch_size=batch_size,
            total_completed=self._snapshot.total_completed + completed,
            iterations=self._snapshot.iterations + 1,
        )


def _enrich_job(job: dict[str, Any]) -> dict[str, Any]:
    customer_text = job.get("CustomerText") or ""
    assistant_text = job.get("AssistantText") or ""
    issue = classify_ai_issue(assistant_text) if assistant_text else None
    return {
        **job,
        # Customer sentiment and assistant-response quality are separate axes.
        # NULL means no assistant response was evaluated for this customer row.
        "issueFlag": issue.issue_flag if issue else None,
        "issueType": issue.issue_type if issue else None,
        "issueReason": issue.issue_reason if issue else None,
        "issueConfidence": issue.issue_confidence if issue else None,
        "detectedTopics": json.dumps(
            canonical_topic_labels(customer_text, assistant_text),
            ensure_ascii=False,
        ),
        "detectedKeywords": json.dumps(
            extract_all_keywords(customer_text, assistant_text),
            ensure_ascii=False,
        ),
    }


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
