from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import json
from typing import Iterable, Mapping

from app.core.text_matching import find_keyword_matches
from app.core.topic_taxonomy import TOPIC_GROUP_BY_ID, TOPIC_NAME_BY_ID, match_topic_keywords


CLASSIFIER_VERSION = "topic-keyword-v3"
MAX_CONTEXT_MESSAGES = 5
MAX_CONTEXT_AGE = timedelta(minutes=30)


@dataclass(frozen=True)
class TopicResolution:
    primary_topic_id: str | None
    detected_topic_ids: tuple[str, ...]
    matched_keywords: tuple[str, ...]
    confidence: float
    source: str
    context_message_id: int | None = None
    context_distance: int | None = None
    classifier_version: str = CLASSIFIER_VERSION

    @property
    def labels(self) -> list[str]:
        if self.primary_topic_id:
            return [TOPIC_NAME_BY_ID[self.primary_topic_id]]
        return [TOPIC_NAME_BY_ID[item] for item in self.detected_topic_ids]


def build_topic_keyword_catalog(custom_keywords: Iterable[Mapping] = ()) -> dict[str, list[str]]:
    catalog = {
        topic_id: list(TOPIC_GROUP_BY_ID[topic_id].get("scope_terms", []))
        for topic_id in ("toeic", "mos", "sat_hach_cntt", "hoc_tieng_anh", "hoc_tin_hoc")
    }
    for item in custom_keywords:
        topic_id = str(item.get("groupId") or "")
        word = str(item.get("word") or "").strip()
        if item.get("status") == "active" and topic_id in catalog and word:
            catalog[topic_id].append(word)
    return {topic_id: list(dict.fromkeys(words)) for topic_id, words in catalog.items()}


def keyword_classifier_version(catalog: Mapping[str, Iterable[str]]) -> str:
    payload = json.dumps(
        {key: list(values) for key, values in sorted(catalog.items())},
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")
    return f"{CLASSIFIER_VERSION}-{hashlib.sha256(payload).hexdigest()[:12]}"


def _match_catalog(text: object, catalog: Mapping[str, Iterable[str]] | None):
    if catalog is None:
        return match_topic_keywords(text)
    return {
        topic_id: matches
        for topic_id, words in catalog.items()
        if (matches := find_keyword_matches(text, words))
    }


def _resolve_direct(text: object, *, source: str, distance: int | None = None,
                    message_id: int | None = None,
                    keyword_catalog: Mapping[str, Iterable[str]] | None = None,
                    classifier_version: str = CLASSIFIER_VERSION) -> TopicResolution | None:
    matches = _match_catalog(text, keyword_catalog)
    if not matches:
        return None
    topic_ids = tuple(matches)
    keywords = tuple(dict.fromkeys(match.keyword for values in matches.values() for match in values))
    # Multiple explicit topics are retained as ambiguous instead of choosing by taxonomy order.
    if len(topic_ids) != 1:
        return TopicResolution(None, topic_ids, keywords, 0.0, "ambiguous", classifier_version=classifier_version)
    topic_id = topic_ids[0]
    factor = max(match.confidence_factor for match in matches[topic_id])
    distance_factor = 1.0 if distance is None else max(0.8, 1.0 - (0.04 * distance))
    return TopicResolution(
        topic_id,
        topic_ids,
        keywords,
        round(factor * distance_factor, 4),
        source,
        context_message_id=message_id if source == "context" else None,
        context_distance=distance if source == "context" else None,
        classifier_version=classifier_version,
    )


def resolve_topic(current_customer_text: object, context_messages: Iterable[Mapping] = (),
                  *, current_time: datetime | None = None,
                  keyword_catalog: Mapping[str, Iterable[str]] | None = None,
                  classifier_version: str = CLASSIFIER_VERSION) -> TopicResolution:
    direct = _resolve_direct(current_customer_text, source="direct", keyword_catalog=keyword_catalog, classifier_version=classifier_version)
    if direct:
        return direct

    for distance, message in enumerate(context_messages, start=1):
        if distance > MAX_CONTEXT_MESSAGES:
            break
        sent_at = message.get("sentAt") or message.get("SentAt")
        if current_time and isinstance(sent_at, datetime) and current_time - sent_at > MAX_CONTEXT_AGE:
            break
        resolved = _resolve_direct(
            message.get("textContent") or message.get("TextContent") or "",
            source="context",
            distance=distance,
            message_id=message.get("messageId") or message.get("id_webchat_messageLogs"),
            keyword_catalog=keyword_catalog,
            classifier_version=classifier_version,
        )
        if resolved:
            return resolved
    return TopicResolution(None, (), (), 0.0, "unknown", classifier_version=classifier_version)
