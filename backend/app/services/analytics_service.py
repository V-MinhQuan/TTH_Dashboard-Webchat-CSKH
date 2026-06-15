from __future__ import annotations

import json
import unicodedata
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
        topic_stats: Dict[str, Dict[str, int]] = {}
        for row in self.repository.get_topic_raw_data(filters):
            count = int(row.get("msgCount") or 1)
            pos = int(row.get("positive") or 0)
            neu = int(row.get("neutral") or 0)
            neg = int(row.get("negative") or 0)
            for topic in _json_array(row.get("detectedTopics")):
                key = str(topic)
                if key not in topic_stats:
                    topic_stats[key] = {"count": 0, "positive": 0, "neutral": 0, "negative": 0}
                topic_stats[key]["count"] += count
                topic_stats[key]["positive"] += pos
                topic_stats[key]["neutral"] += neu
                topic_stats[key]["negative"] += neg
        return [
            {
                "topicKey": topic,
                "topicLabel": TOPIC_LABELS.get(topic, topic),
                "count": stats["count"],
                "positive": stats["positive"],
                "neutral": stats["neutral"],
                "negative": stats["negative"]
            }
            for topic, stats in sorted(topic_stats.items(), key=lambda item: item[1]["count"], reverse=True)
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

    def get_ai_quality_metrics(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        payload = self.repository.get_ai_quality_metrics(filters)
        row = payload.get("row") or {}
        total = int(row.get("total") or 0)
        failure = int(row.get("failure_count") or 0)
        success = total - failure if total > 0 else 0
        return {
            "total_messages": total,
            "success_rate": round(success / total * 100, 1) if total > 0 else 0.0,
            "failure_count": failure,
            "hallucination_count": int(row.get("hallucination_count") or 0),
            "avg_confidence": _round(row.get("avg_confidence")) * 100,
        }

    def get_staff_activity_metrics(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        payload = self.repository.get_staff_activity_metrics(filters)
        row = payload.get("row") or {}
        return {
            "reported_errors": int(row.get("reported_errors") or 0),
            "pending_review": int(row.get("pending_review") or 0),
        }

    def get_ai_failure_trend(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        payload = self.repository.get_ai_failure_trend(filters)
        return [
            {
                "date": _date_str(row.get("date")),
                "failure": int(row.get("failure") or 0),
                "hallucination": int(row.get("hallucination") or 0),
                "uncertain": int(row.get("uncertain") or 0),
            }
            for row in payload.get("rows", [])
        ]

    def get_ai_failure_by_topic(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        payload = self.repository.get_ai_failure_by_topic(filters)
        result_map = {}
        for row in payload.get("rows", []):
            topics = _json_array(row.get("detectedTopics"))
            for topic in topics:
                if not topic: continue
                if topic not in result_map:
                    result_map[topic] = {"topic": topic, "thieuDL": 0, "khongHieu": 0, "khongChac": 0, "ngoaiPhamVi": 0, "hallucination": 0}
                result_map[topic]["thieuDL"] += int(row.get("thieuDL") or 0)
                result_map[topic]["khongHieu"] += int(row.get("khongHieu") or 0)
                result_map[topic]["khongChac"] += int(row.get("khongChac") or 0)
                result_map[topic]["ngoaiPhamVi"] += int(row.get("ngoaiPhamVi") or 0)
                result_map[topic]["hallucination"] += int(row.get("hallucination") or 0)
        return list(result_map.values())

    def get_failed_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        payload = self.repository.get_failed_conversations(filters)
        return {
            "records": [_normalize_review_record(row) for row in payload.get("records", [])],
            "pagination": payload.get("pagination") or {"page": 1, "pageSize": 20, "total": 0},
        }

    def get_staff_reported_errors(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        payload = self.repository.get_staff_reported_errors(filters)
        return {
            "records": [_normalize_review_record(row) for row in payload.get("records", [])],
            "pagination": payload.get("pagination") or {"page": 1, "pageSize": 20, "total": 0},
        }

    def get_suggested_faqs(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        rows = self.repository.get_suggested_faqs(filters)
        res = []
        for row in rows:
            question = str(row.get("question") or "").strip()
            if not question:
                continue
            topics = list(_json_array(row.get("detectedTopics")))
            detected_topic = topics[0] if topics else "Khác"
            topic = _infer_keyword_topic(
                topics=topics,
                question=question,
                suggested_answer=str(row.get("suggestedAnswer") or ""),
            )
            freq = int(row.get("freq") or 0)
            res.append({
                "question": question,
                "suggestedAnswer": str(row.get("suggestedAnswer") or "").strip(),
                "topic": topic,
                "detectedTopic": detected_topic,
                "freq": freq,
                "priority": "Ưu tiên cao" if freq > 30 else ("Ưu tiên trung bình" if freq > 10 else "Ưu tiên thấp")
            })
        return sorted(res, key=lambda x: x["freq"], reverse=True)


def _normalize_topic_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", str(value or ""))
    without_diacritics = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    return " ".join(without_diacritics.lower().split())


def _infer_keyword_topic(topics: Iterable[Any], question: str, suggested_answer: str) -> str:
    raw_text = " ".join([*(str(topic) for topic in topics), question, suggested_answer])
    text = _normalize_topic_text(raw_text)
    if "toeic" in text:
        return "TOEIC"
    if "vstep" in text:
        return "VSTEP"
    if any(token in text for token in ("tin hoc", "mos", "ic3", "cntt", "sat hach")):
        return "Tin học / MOS / IC3"
    if any(token in text for token in ("chuan dau ra", "dau ra", "chung chi")):
        return "Chuẩn đầu ra / Chứng chỉ"
    topics_list = list(topics)
    return str(topics_list[0]) if topics_list else "Khác"

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

