from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


class CustomerMessageResolutionError(ValueError):
    """Raised when a claimed analytics job is not a verified customer message."""


@dataclass(frozen=True)
class CustomerMessageForAnalysis:
    customer_message_id: int
    customer_text: str
    conversation_id: int | None
    channel: str | None
    topic: str | None
    created_at: Any


def resolve_customer_message_for_analysis(
    job: Mapping[str, Any],
) -> CustomerMessageForAnalysis:
    """Return the immutable customer-message contract used by sentiment inference.

    ``FromHost=0`` is the persisted WebChat direction for customer messages. The
    repository also enforces this condition, while this resolver provides a
    fail-closed boundary before any text is sent to Hugging Face.
    """

    if job.get("FromHost") not in (0, False):
        raise CustomerMessageResolutionError("not_customer_message")

    customer_text = str(job.get("CustomerText") or "").strip()
    if not customer_text:
        raise CustomerMessageResolutionError("empty_customer_message")

    try:
        customer_message_id = int(job["messageId"])
    except (KeyError, TypeError, ValueError):
        raise CustomerMessageResolutionError("invalid_customer_message_id") from None

    conversation_id = _optional_int(job.get("conversationId"))
    channel = _optional_text(job.get("channel") or job.get("Source"))
    topic = _optional_text(job.get("topic") or job.get("detectedTopics") or job.get("primaryTopicId"))
    created_at = job.get("createdAt") or job.get("SentAt") or job.get("messageAt")

    return CustomerMessageForAnalysis(
        customer_message_id=customer_message_id,
        customer_text=customer_text,
        conversation_id=conversation_id,
        channel=channel,
        topic=topic,
        created_at=created_at,
    )


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
