from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List

from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.schema_inspector import issue_metadata_available


TOPIC_LABELS = {
    "registration": "Dang ky",
    "schedule": "Lich thi",
    "fee": "Le phi",
    "certificate": "Chung chi",
    "document": "Ho so",
    "technical": "Ky thuat",
    "other": "Khac",
    "Khac": "Khac",
}


class AnalyticsService:
    def __init__(self, repository: AnalyticsRepository | None = None):
        self.repository = repository or AnalyticsRepository()

    def get_sentiment_summary(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        payload = self.repository.get_sentiment_summary(filters)
        row = payload.get("row") or {}
        optional_columns = payload.get("optionalColumns") or {}
        summary = {
            "positive": int(row.get("positive") or 0),
            "neutral": int(row.get("neutral") or 0),
            "negative": int(row.get("negative") or 0),
            "total": int(row.get("total") or 0),
        }
        return {
            "summary": summary,
            "avgScores": {
                "positive": _round(row.get("avgPositive")),
                "neutral": _round(row.get("avgNeutral")),
                "negative": _round(row.get("avgNegative")),
            },
            "total": summary["total"],
            "positive": summary["positive"],
            "neutral": summary["neutral"],
            "negative": summary["negative"],
            "issueFlag": int(row.get("issueFlag") or 0),
            "needStaffReview": int(row.get("needStaffReview") or 0),
            "avgSatisfaction": _round(row.get("avgSatisfaction")),
            "analyzerVersionDistribution": [
                {
                    "sentimentSource": item.get("sentimentSource"),
                    "analyzerVersion": item.get("analyzerVersion"),
                    "sentimentLabel": item.get("sentimentLabel") or "neutral",
                    "total": int(item.get("total") or 0),
                }
                for item in payload.get("analyzerVersionDistribution", [])
            ],
            "metadata": {
                "issueMetadataAvailable": issue_metadata_available(optional_columns),
                "optionalColumns": optional_columns,
            },
        }

    def get_sentiment_trend(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        payload = self.repository.get_sentiment_trend(filters)
        return [
            {
                "date": _date_str(row.get("date")),
                "positive": int(row.get("positive") or 0),
                "neutral": int(row.get("neutral") or 0),
                "negative": int(row.get("negative") or 0),
                "issueFlag": int(row.get("issueFlag") or 0),
                "needStaffReview": int(row.get("needStaffReview") or 0),
            }
            for row in payload.get("rows", [])
        ]

    def get_satisfaction_summary(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        rows = self.repository.get_satisfaction_summary(filters)
        total = 0
        total_need_review = 0
        weighted_score = 0.0
        level_distribution: Dict[str, int] = {}
        for row in rows:
            count = int(row.get("levelCount") or 0)
            level = row.get("satisfactionLevel") or "neutral"
            avg = float(row.get("avgSatisfactionScore") or 0)
            total += count
            total_need_review += int(row.get("needReviewCount") or 0)
            weighted_score += avg * count
            level_distribution[level] = level_distribution.get(level, 0) + count
        return {
            "avgSatisfactionScore": round(weighted_score / total, 1) if total else 0,
            "totalMessages": total,
            "needReviewCount": total_need_review,
            "levelDistribution": level_distribution,
        }

    def get_satisfaction_trend(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {
                "date": _date_str(row.get("date")),
                "avgScore": round(float(row.get("avgScore") or 0), 1),
                "count": int(row.get("count") or 0),
                "needReviewCount": int(row.get("needReviewCount") or 0),
            }
            for row in self.repository.get_satisfaction_trend(filters)
        ]

    def get_topic_summary(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        topic_count: Dict[str, int] = {}
        for row in self.repository.get_topic_raw_data(filters):
            count = int(row.get("msgCount") or 1)
            for topic in _json_array(row.get("detectedTopics")):
                key = str(topic)
                topic_count[key] = topic_count.get(key, 0) + count
        return [
            {
                "topicKey": topic,
                "topicLabel": TOPIC_LABELS.get(topic, topic),
                "count": count,
            }
            for topic, count in sorted(topic_count.items(), key=lambda item: item[1], reverse=True)
        ]

    def get_keywords(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        payload = self.repository.get_keyword_raw_data(filters)
        keyword_count: Dict[str, int] = {}
        for row in payload.get("rows", []):
            count = int(row.get("msgCount") or 1)
            for keyword in _json_array(row.get("matchedNegativeKeywords")):
                key = str(keyword)
                keyword_count[key] = keyword_count.get(key, 0) + count
            issue_type = row.get("issueType")
            if issue_type and issue_type != "none":
                key = f"issue:{issue_type}"
                keyword_count[key] = keyword_count.get(key, 0) + count
        return [
            {"keyword": keyword, "count": count}
            for keyword, count in sorted(keyword_count.items(), key=lambda item: item[1], reverse=True)[:50]
        ]

    def get_need_review_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        payload = self.repository.get_need_review_conversations(filters)
        optional_columns = payload.get("optionalColumns") or {}
        return {
            "records": [_normalize_review_record(row) for row in payload.get("records", [])],
            "pagination": payload.get("pagination") or {"page": 1, "pageSize": 20, "total": 0},
            "metadata": {
                "issueMetadataAvailable": issue_metadata_available(optional_columns),
            },
        }


def _json_array(value: Any) -> Iterable[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(str(value))
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _normalize_review_record(row: Dict[str, Any]) -> Dict[str, Any]:
    item = dict(row)
    item["needStaffReview"] = _as_bool(item.get("needStaffReview"))
    item["issueFlag"] = None if item.get("issueFlag") is None else _as_bool(item.get("issueFlag"))
    item["issueType"] = item.get("issueType") or None
    item["issueReason"] = item.get("issueReason") or None
    item["issueConfidence"] = None if item.get("issueConfidence") is None else float(item.get("issueConfidence") or 0)
    item["detectedTopics"] = list(_json_array(item.get("detectedTopics")))
    item["matchedNegativeKeywords"] = list(_json_array(item.get("matchedNegativeKeywords")))
    item["messageAt"] = None if item.get("messageAt") is None else str(item.get("messageAt"))
    return item


def _as_bool(value: Any) -> bool:
    return value is True or value == 1 or value == "1" or value == "true"


def _round(value: Any, digits: int = 3) -> float:
    try:
        return round(float(value or 0), digits)
    except (TypeError, ValueError):
        return 0.0


def _date_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).split(" ")[0].split("T")[0]

