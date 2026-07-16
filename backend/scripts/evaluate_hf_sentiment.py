from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import math
import os
import re
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import Settings  # noqa: E402
from app.services.huggingface_sentiment_client import (  # noqa: E402
    HuggingFaceClientError,
    HuggingFaceSentimentClient,
    normalize_sentiment_input,
)


LABELS = ("POS", "NEG", "NEU")
MODES = ("raw", "segmented", "both")
DEFAULT_MAX_REQUESTS = 300
MANUAL_REVIEW_COLUMNS = (
    "sample_id",
    "message_text",
    "channel",
    "topic",
    "current_label",
    "human_label",
    "review_note",
    "include_in_evaluation",
)
CONFIDENCE_THRESHOLDS = (0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95)
ERROR_TYPES = (
    "NEG_TO_NEU",
    "NEG_TO_POS",
    "NEU_TO_NEG",
    "NEU_TO_POS",
    "POS_TO_NEU",
    "POS_TO_NEG",
)

_NEGATIVE_PHRASES = (
    "bị lỗi",
    "không thể",
    "không đăng nhập được",
    "không nhận được",
    "chưa nhận được",
    "chờ rất lâu",
    "đợi rất lâu",
    "sai thông tin",
    "không tìm thấy dữ liệu",
    "thất vọng",
    "khiếu nại",
)
_POSITIVE_PHRASES = (
    "cảm ơn",
    "đã được giải quyết",
    "được giải quyết",
    "hỗ trợ nhanh",
    "rất hài lòng",
    "hoạt động tốt",
    "trả lời đúng",
)
_INFORMATIONAL_PHRASES = (
    "tôi muốn biết",
    "cho tôi hỏi",
    "xin cho biết",
    "lịch thi",
    "tra cứu",
    "khi nào",
    "ở đâu",
    "bao giờ",
    "cách đăng ký",
    "thông tin về",
)


# Keep these evaluation-only rules readable and reviewable. They never consume
# expected/human labels and do not affect the production sentiment service.
_NEGATIVE_PHRASES = (
    "bị lỗi",
    "không thể đăng nhập",
    "không đăng nhập được",
    "không xem được",
    "không nhận được kết quả",
    "chưa nhận được kết quả",
    "chờ rất lâu",
    "đợi rất lâu",
    "trả lời sai",
    "sai thông tin",
    "không tìm thấy dữ liệu",
    "không thực hiện được",
    "thất vọng",
    "khiếu nại",
)
_UNRESOLVED_NEGATIVE_PHRASES = (
    "vẫn chưa",
    "chưa được giải quyết",
    "không nhận được kết quả",
    "chưa nhận được kết quả",
    "không thể đăng nhập",
    "không đăng nhập được",
    "không xem được",
    "chờ rất lâu",
    "đợi rất lâu",
    "không thực hiện được",
)
_POSITIVE_PHRASES = (
    "cảm ơn",
    "đã được giải quyết",
    "được giải quyết",
    "hỗ trợ nhanh",
    "rất hài lòng",
    "hoạt động tốt",
    "trả lời đúng",
    "trả lời chính xác",
)
_RESOLVED_PHRASES = ("đã được giải quyết", "nay đã được giải quyết", "vấn đề đã xong")
_INFORMATIONAL_PHRASES = (
    "tôi muốn biết",
    "cho tôi hỏi",
    "xin cho biết",
    "lịch thi",
    "tra cứu điểm",
    "tra cứu",
    "thời gian thi",
    "đăng ký như thế nào",
    "khi nào",
    "ở đâu",
    "bao giờ",
    "cách đăng ký",
    "thông tin về",
)
_PII_PATTERNS = {
    "authorization": re.compile(r"(?i)\bauthorization\s*[:=]|\bbearer\s+[A-Za-z0-9._~+/=-]{8,}"),
    "token": re.compile(r"\bhf_[A-Za-z0-9]{8,}\b|\b(?:access[_ -]?token|api[_ -]?key)\s*[:=]", re.I),
    "password": re.compile(r"\b(?:password|passwd|pwd|mật\s*khẩu)\s*[:=]", re.I),
    "email": re.compile(r"\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b", re.I),
    "phone": re.compile(r"(?<!\w)(?:\+?84|0)[\s.()-]*(?:\d[\s.()-]*){8,10}(?!\w)"),
    "student_id": re.compile(r"\b(?:mssv|mã\s*sinh\s*viên)\s*[:=]?\s*[A-Z0-9-]{6,20}\b", re.I),
}


@dataclass(frozen=True)
class EvaluationCase:
    sample_id: str
    message_text: str
    expected_label: str | None = None
    channel: str = ""
    topic: str = ""
    ambiguous: bool = False
    include_in_evaluation: bool = True
    priority: bool = False
    review_note: str = ""


@dataclass(frozen=True)
class EvaluationReport:
    results: list[dict[str, Any]]
    metrics: dict[str, dict[str, Any] | None]
    actual_requests: int
    max_requests: int
    concurrency: int
    request_limit_reached: bool = False
    halted_reason: str | None = None
    dry_run: bool = False
    coverage: dict[str, Any] | None = None
    group_metrics: dict[str, Any] | None = None
    confidence_thresholds: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "metadata": {
                "actual_live_requests": self.actual_requests,
                "max_requests": self.max_requests,
                "concurrency": self.concurrency,
                "request_limit_reached": self.request_limit_reached,
                "halted_reason": self.halted_reason,
                "dry_run": self.dry_run,
            },
            "metrics": self.metrics,
            "coverage": self.coverage,
            "group_metrics": self.group_metrics,
            "confidence_thresholds": self.confidence_thresholds,
            "results": self.results,
        }


def normalize_label(value: Any, *, field_name: str = "label") -> str | None:
    text = str(value or "").strip().upper()
    if not text:
        return None
    aliases = {
        "POS": "POS",
        "POSITIVE": "POS",
        "NEG": "NEG",
        "NEGATIVE": "NEG",
        "NEU": "NEU",
        "NEUTRAL": "NEU",
    }
    normalized = aliases.get(text)
    if normalized is None:
        raise ValueError(f"Unsupported {field_name}: {text}")
    return normalized


def normalize_human_label(value: Any) -> str | None:
    text = str(value or "").strip().upper()
    if not text:
        return None
    if text not in LABELS:
        raise ValueError(f"Unsupported human_label: {text}")
    return text


def _parse_bool(value: Any, *, default: bool) -> bool:
    if value is None or str(value).strip() == "":
        return default
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y"}:
        return True
    if normalized in {"0", "false", "no", "n"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def _read_text_with_encoding_detection(path: Path) -> tuple[str, str | None]:
    payload = path.read_bytes()
    try:
        return payload.decode("utf-8-sig"), None
    except UnicodeDecodeError:
        try:
            return payload.decode("cp1258"), "decoded_as_cp1258_not_utf8"
        except UnicodeDecodeError as error:
            raise ValueError("CSV must be UTF-8 or valid Windows-1258 Vietnamese text") from error


def _read_csv_rows(path: Path) -> tuple[list[str], list[tuple[int, list[str]]], str | None]:
    text, encoding_warning = _read_text_with_encoding_detection(path)
    parsed = list(csv.reader(io.StringIO(text, newline="")))
    first_nonempty = next((index for index, row in enumerate(parsed) if any(cell.strip() for cell in row)), None)
    if first_nonempty is None:
        raise ValueError("Evaluation CSV is empty")
    header = [cell.strip() for cell in parsed[first_nonempty]]
    data = [
        (row_index + 1, row)
        for row_index, row in enumerate(parsed[first_nonempty + 1 :], start=first_nonempty + 1)
        if any(cell.strip() for cell in row)
    ]
    return header, data, encoding_warning


def _mapping_from_row(header: Sequence[str], row: Sequence[str]) -> dict[str, str]:
    return {name: row[index] if index < len(row) else "" for index, name in enumerate(header)}


def _case_from_mapping(item: dict[str, Any], index: int) -> EvaluationCase:
    is_manual_review = "human_label" in item
    raw_message = item.get("message_text", item.get("text", ""))
    try:
        message = normalize_sentiment_input(raw_message)
    except HuggingFaceClientError:
        if not is_manual_review:
            raise
        message = ""

    raw_label = item.get("human_label") if is_manual_review else item.get("expected_label")
    try:
        expected_label = (
            normalize_human_label(raw_label)
            if is_manual_review
            else normalize_label(raw_label, field_name="expected_label")
        )
    except ValueError:
        if not is_manual_review:
            raise
        expected_label = None
    requested_include = _parse_bool(item.get("include_in_evaluation"), default=True)
    include = requested_include and bool(expected_label) and bool(message) if is_manual_review else requested_include
    return EvaluationCase(
        sample_id=str(item.get("sample_id") or item.get("id") or index),
        message_text=message,
        expected_label=expected_label,
        channel=str(item.get("channel") or ""),
        topic=str(item.get("topic") or ""),
        ambiguous=_parse_bool(item.get("ambiguous"), default=False),
        include_in_evaluation=include,
        priority=_parse_bool(item.get("priority", item.get("smoke_test")), default=False),
        review_note=normalize_sentiment_input(item.get("review_note")) if str(item.get("review_note") or "").strip() else "",
    )


def load_cases(path: str | Path) -> list[EvaluationCase]:
    input_path = Path(path)
    suffix = input_path.suffix.lower()
    if suffix == ".json":
        payload = json.loads(input_path.read_text(encoding="utf-8-sig"))
        items = payload.get("cases") if isinstance(payload, dict) else payload
        if not isinstance(items, list):
            raise ValueError("JSON input must be a list or an object containing a 'cases' list")
    elif suffix == ".csv":
        header, rows, _encoding_warning = _read_csv_rows(input_path)
        malformed = [row_number for row_number, row in rows if len(row) != len(header)]
        if malformed:
            raise ValueError(f"Malformed CSV rows have wrong column count: {malformed}")
        items = [_mapping_from_row(header, row) for _row_number, row in rows]
    else:
        raise ValueError("Input must be a .json or .csv file")

    cases = [_case_from_mapping(item, index) for index, item in enumerate(items, start=1)]
    if not cases:
        raise ValueError("Evaluation input is empty")
    return cases


def _detect_pii_types(value: Any) -> list[str]:
    text = str(value or "")
    return sorted(name for name, pattern in _PII_PATTERNS.items() if pattern.search(text))


def _safe_sample_id(value: Any, row_number: int) -> str:
    text = str(value or "").strip()
    if not text:
        return f"row-{row_number}"
    if len(text) > 100 or "," in text or _detect_pii_types(text):
        return f"row-{row_number}"
    return text[:100]


def _label_review_warning(message: str, label: str) -> str | None:
    text = message.casefold()
    has_unresolved = any(phrase in text for phrase in _UNRESOLVED_NEGATIVE_PHRASES)
    has_negative = any(phrase in text for phrase in _NEGATIVE_PHRASES)
    has_positive = any(phrase in text for phrase in _POSITIVE_PHRASES)
    has_resolved = any(phrase in text for phrase in _RESOLVED_PHRASES)
    if label == "NEU" and has_unresolved:
        return "neutral_label_with_explicit_unresolved_problem"
    if label == "NEU" and has_positive and not has_negative:
        return "neutral_label_with_explicit_positive_signal"
    if label == "POS" and has_unresolved:
        return "positive_label_with_explicit_unresolved_problem"
    if label == "NEG" and has_positive and not has_negative:
        return "negative_label_with_explicit_resolution"
    return None


def validate_manual_review_csv(path: str | Path) -> dict[str, Any]:
    input_path = Path(path)
    header, rows, encoding_warning = _read_csv_rows(input_path)
    missing = sorted(set(MANUAL_REVIEW_COLUMNS) - set(header))
    if missing:
        raise ValueError(f"Manual review CSV missing required columns: {', '.join(missing)}")

    seen_ids: dict[str, int] = {}
    duplicate_ids: set[str] = set()
    invalid_labels: list[dict[str, Any]] = []
    empty_messages: list[dict[str, Any]] = []
    empty_sample_ids: list[dict[str, Any]] = []
    pii_warnings: list[dict[str, Any]] = []
    label_review_warnings: list[dict[str, Any]] = []
    malformed_rows: list[dict[str, Any]] = []
    invalid_include_values: list[dict[str, Any]] = []
    distribution = {label: 0 for label in LABELS}
    valid_label_count = 0
    included_rows = 0

    for row_number, raw_row in rows:
        if len(raw_row) != len(header):
            malformed_rows.append(
                {"row_number": row_number, "actual_columns": len(raw_row), "expected_columns": len(header)}
            )
        row = _mapping_from_row(header, raw_row)
        sample_id = str(row.get("sample_id") or "").strip()
        safe_id = _safe_sample_id(sample_id, row_number)
        if not sample_id:
            empty_sample_ids.append({"row_number": row_number})
        elif sample_id in seen_ids:
            duplicate_ids.add(safe_id)
        else:
            seen_ids[sample_id] = row_number

        raw_message = str(row.get("message_text") or "").strip()
        if not raw_message:
            empty_messages.append({"row_number": row_number, "sample_id": safe_id})

        raw_label = str(row.get("human_label") or "").strip()
        try:
            label = normalize_human_label(raw_label)
        except ValueError:
            label = None
            invalid_labels.append({"row_number": row_number, "sample_id": safe_id})
        if label:
            valid_label_count += 1

        try:
            requested_include = _parse_bool(row.get("include_in_evaluation"), default=False)
        except ValueError:
            requested_include = False
            invalid_include_values.append({"row_number": row_number, "sample_id": safe_id})
        included = requested_include and bool(label) and bool(raw_message) and bool(sample_id)
        if included:
            included_rows += 1
            distribution[label] += 1

        pii_types = sorted(
            set(_detect_pii_types(raw_message))
            | set(_detect_pii_types(row.get("review_note")))
            | set(_detect_pii_types(sample_id))
        )
        if pii_types:
            pii_warnings.append({"row_number": row_number, "sample_id": safe_id, "types": pii_types})
        if included and label:
            warning = _label_review_warning(raw_message, label)
            if warning:
                label_review_warnings.append(
                    {"row_number": row_number, "sample_id": safe_id, "human_label": label, "warning": warning}
                )

    return {
        "total_rows": len(rows),
        "included_rows": included_rows,
        "excluded_rows": len(rows) - included_rows,
        "valid_labels": valid_label_count,
        "invalid_labels": invalid_labels,
        "duplicate_sample_ids": sorted(duplicate_ids),
        "empty_sample_ids": empty_sample_ids,
        "empty_messages": empty_messages,
        "pii_warnings": pii_warnings,
        "label_review_warnings": label_review_warnings,
        "label_distribution": distribution,
        "malformed_rows": malformed_rows,
        "encoding_warnings": [encoding_warning] if encoding_warning else [],
        "invalid_include_values": invalid_include_values,
    }


def write_validation_report(report: dict[str, Any], output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def manual_validation_blockers(report: dict[str, Any]) -> list[str]:
    blockers = []
    for key in (
        "invalid_labels",
        "duplicate_sample_ids",
        "empty_sample_ids",
        "empty_messages",
        "pii_warnings",
        "malformed_rows",
        "encoding_warnings",
        "invalid_include_values",
    ):
        if report.get(key):
            blockers.append(key)
    if not report.get("included_rows"):
        blockers.append("no_included_valid_rows")
    return blockers


def select_balanced_cases(
    cases: Sequence[EvaluationCase],
    *,
    per_label: int,
) -> list[EvaluationCase]:
    if per_label < 1:
        raise ValueError("per_label must be at least 1")

    indexed = list(enumerate(cases))
    selected_indices: set[int] = set()
    for label in LABELS:
        candidates = [
            (index, item)
            for index, item in indexed
            if item.include_in_evaluation and not item.ambiguous and item.expected_label == label
        ]
        if len(candidates) < per_label:
            raise ValueError(
                f"Balanced selection needs {per_label} {label} cases, found {len(candidates)}"
            )
        ordered = [*filter(lambda pair: pair[1].priority, candidates), *filter(lambda pair: not pair[1].priority, candidates)]
        selected_indices.update(index for index, _item in ordered[:per_label])

    return [item for index, item in indexed if index in selected_indices]


def select_cases_for_request_cap(
    cases: Sequence[EvaluationCase],
    *,
    max_requests: int,
) -> list[EvaluationCase]:
    """Select deterministically without consulting predictions.

    Labels are round-robin balanced while unseen topics/channels and priority
    cases are preferred within each label.
    """
    if max_requests < 1:
        raise ValueError("max_requests must be at least 1")
    eligible = [
        (index, item)
        for index, item in enumerate(cases)
        if item.include_in_evaluation and not item.ambiguous and item.expected_label in LABELS
    ]
    if len(eligible) <= max_requests:
        return [item for _index, item in eligible]

    buckets = {label: [(index, item) for index, item in eligible if item.expected_label == label] for label in LABELS}
    selected: list[EvaluationCase] = []
    used_topics: set[str] = set()
    used_channels: set[str] = set()
    while len(selected) < max_requests and any(buckets.values()):
        for label in LABELS:
            if len(selected) >= max_requests or not buckets[label]:
                continue
            candidates = buckets[label]
            chosen = max(
                candidates,
                key=lambda pair: (
                    int(pair[1].priority),
                    int(bool(pair[1].topic) and pair[1].topic not in used_topics),
                    int(bool(pair[1].channel) and pair[1].channel not in used_channels),
                    -pair[0],
                ),
            )
            candidates.remove(chosen)
            item = chosen[1]
            selected.append(item)
            if item.topic:
                used_topics.add(item.topic)
            if item.channel:
                used_channels.add(item.channel)
    return selected


def analyze_coverage(cases: Sequence[EvaluationCase]) -> dict[str, Any]:
    included = [item for item in cases if item.include_in_evaluation and item.expected_label in LABELS]
    label_distribution = {label: sum(item.expected_label == label for item in included) for label in LABELS}
    channel_distribution = _value_counts(item.channel or "(blank)" for item in included)
    topic_distribution = _value_counts(item.topic or "(blank)" for item in included)
    length_distribution = {
        "short_0_49": sum(len(item.message_text) < 50 for item in included),
        "medium_50_149": sum(50 <= len(item.message_text) < 150 for item in included),
        "long_150_plus": sum(len(item.message_text) >= 150 for item in included),
    }
    categories = {
        "negation": sum(bool(re.search(r"\b(?:không|chưa|chẳng)\b", item.message_text.casefold())) for item in included),
        "informational_question": sum(any(phrase in item.message_text.casefold() for phrase in _INFORMATIONAL_PHRASES) for item in included),
        "system_error": sum("lỗi" in item.message_text.casefold() for item in included),
        "thanks": sum("cảm ơn" in item.message_text.casefold() for item in included),
        "complaint_or_wait": sum(any(phrase in item.message_text.casefold() for phrase in ("khiếu nại", "chờ", "đợi", "thất vọng")) for item in included),
        "multi_intent": sum(any(token in item.message_text.casefold() for token in (" nhưng ", " tuy nhiên ", ";")) for item in included),
    }
    return {
        "total_included": len(included),
        "label_distribution": label_distribution,
        "channel_distribution": channel_distribution,
        "topic_distribution": topic_distribution,
        "message_length_distribution": length_distribution,
        "category_distribution": categories,
    }


def _value_counts(values: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def apply_domain_post_processing(
    message_text: str,
    raw_label: str,
    raw_score: float,
) -> tuple[str, bool, str | None]:
    del raw_score  # Kept in the signature so future threshold rules remain explicit.
    label = normalize_label(raw_label)
    if label is None:
        raise ValueError("raw_label is required for domain post-processing")
    text = normalize_sentiment_input(message_text).casefold()

    has_unresolved = any(phrase in text for phrase in _UNRESOLVED_NEGATIVE_PHRASES)
    has_resolved = any(phrase in text for phrase in _RESOLVED_PHRASES)
    has_positive = any(phrase in text for phrase in _POSITIVE_PHRASES)
    if has_unresolved and has_positive:
        if label != "NEG":
            return "NEG", True, "unresolved_negative_domain_phrase"
        return label, False, None
    if has_resolved and has_positive:
        if label != "POS":
            return "POS", True, "explicit_positive_resolution_phrase"
        return label, False, None
    if any(phrase in text for phrase in _NEGATIVE_PHRASES):
        if label != "NEG":
            return "NEG", True, "explicit_negative_domain_phrase"
        return label, False, None
    if has_positive:
        if label != "POS":
            return "POS", True, "explicit_positive_resolution_phrase"
        return label, False, None
    if any(phrase in text for phrase in _INFORMATIONAL_PHRASES) and label == "POS":
        return "NEU", True, "informational_request_without_sentiment"
    return label, False, None


def calculate_metrics(
    results: Sequence[dict[str, Any]],
    *,
    prediction_field: str,
) -> dict[str, Any] | None:
    evaluated = [
        result
        for result in results
        if result.get("expected_label")
        and not _parse_bool(result.get("ambiguous"), default=False)
        and _parse_bool(result.get("include_in_evaluation"), default=True)
    ]
    if not evaluated:
        return None

    confusion = {
        expected: {predicted: 0 for predicted in (*LABELS, "ERROR")}
        for expected in LABELS
    }
    correct = 0
    failures = 0
    latencies: list[float] = []
    confidences: list[float] = []
    correct_confidences: list[float] = []
    incorrect_confidences: list[float] = []
    for result in evaluated:
        expected = normalize_label(result.get("expected_label"), field_name="expected_label")
        predicted_value = result.get(prediction_field)
        predicted = normalize_label(predicted_value, field_name=prediction_field) if predicted_value else None
        output = predicted or "ERROR"
        confusion[expected][output] += 1
        correct += int(expected == predicted)
        failures += int(not result.get("success", False))
        confidence = result.get("raw_model_score")
        if isinstance(confidence, (int, float)):
            confidences.append(float(confidence))
            (correct_confidences if expected == predicted else incorrect_confidences).append(float(confidence))
        latency = result.get("latency_ms")
        if isinstance(latency, (int, float)):
            latencies.append(float(latency))

    per_class: dict[str, dict[str, float | int]] = {}
    for label in LABELS:
        true_positive = confusion[label][label]
        false_positive = sum(confusion[other][label] for other in LABELS if other != label)
        false_negative = sum(confusion[label][other] for other in (*LABELS, "ERROR") if other != label)
        precision = _safe_ratio(true_positive, true_positive + false_positive)
        recall = _safe_ratio(true_positive, true_positive + false_negative)
        f1 = _safe_ratio(2 * precision * recall, precision + recall)
        per_class[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": sum(confusion[label].values()),
        }

    weighted_f1 = _safe_ratio(
        sum(float(item["f1"]) * int(item["support"]) for item in per_class.values()),
        len(evaluated),
    )
    directed_errors = {
        f"{expected}_TO_{predicted}": confusion[expected][predicted]
        for expected in LABELS
        for predicted in LABELS
        if expected != predicted
    }
    return {
        "evaluated_cases": len(evaluated),
        "accuracy": _safe_ratio(correct, len(evaluated)),
        "macro_precision": _round_metric(statistics.mean(float(item["precision"]) for item in per_class.values())),
        "macro_recall": _round_metric(statistics.mean(float(item["recall"]) for item in per_class.values())),
        "macro_f1": _round_metric(statistics.mean(float(item["f1"]) for item in per_class.values())),
        "weighted_f1": weighted_f1,
        "per_class": per_class,
        "negative_recall": per_class["NEG"]["recall"],
        "negative_precision": per_class["NEG"]["precision"],
        "negative_as_neutral": confusion["NEG"]["NEU"],
        "neutral_as_positive": confusion["NEU"]["POS"],
        "directed_errors": directed_errors,
        "confusion_matrix": confusion,
        "mean_latency_ms": round(statistics.mean(latencies), 2) if latencies else None,
        "median_latency_ms": round(statistics.median(latencies), 2) if latencies else None,
        "p95_latency_ms": round(_nearest_rank_percentile(latencies, 0.95), 2) if latencies else None,
        "average_confidence": round(statistics.mean(confidences), 4) if confidences else None,
        "correct_prediction_confidence": round(statistics.mean(correct_confidences), 4) if correct_confidences else None,
        "incorrect_prediction_confidence": round(statistics.mean(incorrect_confidences), 4) if incorrect_confidences else None,
        "api_success_rate": _safe_ratio(len(evaluated) - failures, len(evaluated)),
        "api_failure_rate": _safe_ratio(failures, len(evaluated)),
    }


def _safe_ratio(numerator: float, denominator: float) -> float:
    return _round_metric(numerator / denominator) if denominator else 0.0


def _round_metric(value: float) -> float:
    return round(value, 4)


def _nearest_rank_percentile(values: Sequence[float], percentile: float) -> float:
    ordered = sorted(values)
    rank = max(1, math.ceil(percentile * len(ordered)))
    return ordered[rank - 1]


def calculate_group_metrics(
    results: Sequence[dict[str, Any]],
    *,
    minimum_samples: int = 5,
) -> dict[str, dict[str, dict[str, dict[str, Any] | None]]]:
    grouped: dict[str, dict[str, dict[str, dict[str, Any] | None]]] = {"topic": {}, "channel": {}}
    for dimension in grouped:
        values = sorted({str(item.get(dimension) or "").strip() for item in results} - {""})
        for value in values:
            members = [item for item in results if str(item.get(dimension) or "").strip() == value]
            eligible = [item for item in members if item.get("expected_label") and item.get("include_in_evaluation", True)]
            if len(eligible) < minimum_samples:
                continue
            grouped[dimension][value] = {
                "BASELINE_RAW": calculate_metrics(members, prediction_field="raw_model_label"),
                "DOMAIN_POST_PROCESSING": calculate_metrics(members, prediction_field="final_label"),
            }
    return grouped


def analyze_confidence_thresholds(
    results: Sequence[dict[str, Any]],
    *,
    prediction_field: str,
    thresholds: Sequence[float] = CONFIDENCE_THRESHOLDS,
) -> list[dict[str, Any]]:
    evaluated = [
        item
        for item in results
        if item.get("expected_label") in LABELS
        and item.get(prediction_field) in LABELS
        and isinstance(item.get("raw_model_score"), (int, float))
        and item.get("include_in_evaluation", True)
        and not item.get("ambiguous", False)
    ]
    total_errors = sum(item["expected_label"] != item[prediction_field] for item in evaluated)
    analysis: list[dict[str, Any]] = []
    for threshold in thresholds:
        reviewed = [item for item in evaluated if float(item["raw_model_score"]) < threshold]
        accepted = [item for item in evaluated if float(item["raw_model_score"]) >= threshold]
        captured = sum(item["expected_label"] != item[prediction_field] for item in reviewed)
        correct_reviewed = len(reviewed) - captured
        accepted_metrics = calculate_metrics(accepted, prediction_field=prediction_field)
        analysis.append(
            {
                "threshold": round(float(threshold), 2),
                "review_count": len(reviewed),
                "review_rate": _safe_ratio(len(reviewed), len(evaluated)),
                "errors_captured": captured,
                "error_capture_rate": _safe_ratio(captured, total_errors),
                "correct_cases_reviewed": correct_reviewed,
                "auto_accepted_accuracy": accepted_metrics["accuracy"] if accepted_metrics else None,
                "auto_accepted_negative_recall": accepted_metrics["negative_recall"] if accepted_metrics else None,
            }
        )
    return analysis


def classify_error(expected_label: Any, predicted_label: Any) -> str:
    expected = normalize_label(expected_label, field_name="expected_label")
    predicted = normalize_label(predicted_label, field_name="predicted_label") if predicted_label else None
    if expected == predicted:
        return "CORRECT"
    if predicted is None:
        return "API_ERROR"
    return f"{expected}_TO_{predicted}"


def _mask_optional_text(value: Any) -> str:
    if not str(value or "").strip():
        return ""
    try:
        return normalize_sentiment_input(value)
    except HuggingFaceClientError:
        return ""


def write_error_report(results: Sequence[dict[str, Any]], output_path: str | Path) -> dict[str, int]:
    fieldnames = (
        "sample_id",
        "masked_message_text",
        "channel",
        "topic",
        "human_label",
        "raw_model_label",
        "raw_model_score",
        "final_label",
        "rule_applied",
        "rule_reason",
        "error_type",
        "review_note",
    )
    rows: list[dict[str, Any]] = []
    rules_corrected = 0
    rules_introduced_errors = 0
    for index, result in enumerate(results, start=1):
        expected = normalize_label(result.get("expected_label"), field_name="human_label")
        raw = result.get("raw_model_label")
        final = result.get("final_label")
        raw_correct = raw == expected
        final_correct = final == expected
        rules_corrected += int(bool(result.get("rule_applied")) and not raw_correct and final_correct)
        rules_introduced_errors += int(bool(result.get("rule_applied")) and raw_correct and not final_correct)
        rows.append(
            {
                "sample_id": _safe_sample_id(result.get("sample_id"), index),
                "masked_message_text": _mask_optional_text(result.get("message_text")),
                "channel": str(result.get("channel") or "")[:100],
                "topic": str(result.get("topic") or "")[:100],
                "human_label": expected,
                "raw_model_label": raw,
                "raw_model_score": result.get("raw_model_score"),
                "final_label": final,
                "rule_applied": bool(result.get("rule_applied")),
                "rule_reason": str(result.get("rule_reason") or "")[:200],
                "error_type": classify_error(expected, raw),
                "review_note": _mask_optional_text(result.get("review_note")),
            }
        )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return {
        "total_rows": len(rows),
        "rules_corrected": rules_corrected,
        "rules_introduced_errors": rules_introduced_errors,
    }


class EvaluationRunner:
    def __init__(
        self,
        *,
        client: Any,
        max_requests: int,
        concurrency: int = 1,
        segmenter: Callable[[str], str] | None = None,
    ) -> None:
        if max_requests < 1:
            raise ValueError("max_requests must be at least 1")
        if concurrency != 1:
            raise ValueError("concurrency must be 1 for controlled evaluation")
        self.client = client
        self.max_requests = max_requests
        self.concurrency = concurrency
        self.segmenter = segmenter

    async def evaluate(
        self,
        cases: Iterable[EvaluationCase],
        *,
        mode: str = "raw",
        dry_run: bool = False,
    ) -> EvaluationReport:
        if mode not in MODES:
            raise ValueError(f"mode must be one of: {', '.join(MODES)}")
        requested_modes = ("raw", "segmented") if mode == "both" else (mode,)
        if "segmented" in requested_modes and self.segmenter is None:
            raise ValueError("segmented mode requires a trusted word segmenter")

        planned = [
            (evaluation_case, current_mode)
            for evaluation_case in cases
            if evaluation_case.include_in_evaluation and not evaluation_case.ambiguous
            for current_mode in requested_modes
        ]
        results: list[dict[str, Any]] = []
        actual_requests = 0
        halted_reason: str | None = None
        request_limit_reached = False

        for evaluation_case, current_mode in planned:
            clean_text = normalize_sentiment_input(evaluation_case.message_text)
            provider_input = clean_text
            if current_mode == "segmented":
                provider_input = normalize_sentiment_input(self.segmenter(clean_text))

            if dry_run:
                results.append(self._dry_run_result(evaluation_case, current_mode, clean_text, provider_input))
                continue
            if actual_requests >= self.max_requests:
                request_limit_reached = True
                break

            actual_requests += 1
            started_at = time.perf_counter()
            try:
                prediction = await self.client.predict(provider_input)
                latency_ms = round((time.perf_counter() - started_at) * 1_000, 2)
                raw_label = normalize_label(prediction.label)
                final_label, rule_applied, rule_reason = apply_domain_post_processing(
                    clean_text,
                    raw_label,
                    float(prediction.confidence),
                )
                results.append(
                    self._success_result(
                        evaluation_case,
                        current_mode,
                        clean_text,
                        provider_input,
                        raw_label,
                        float(prediction.confidence),
                        final_label,
                        rule_applied,
                        rule_reason,
                        latency_ms,
                    )
                )
            except asyncio.CancelledError:
                raise
            except HuggingFaceClientError as error:
                latency_ms = round((time.perf_counter() - started_at) * 1_000, 2)
                results.append(
                    self._failure_result(
                        evaluation_case,
                        current_mode,
                        clean_text,
                        provider_input,
                        error.code,
                        error.status_code,
                        latency_ms,
                    )
                )
                if error.status_code in {401, 403, 429}:
                    halted_reason = error.code
                    break
            except Exception:
                latency_ms = round((time.perf_counter() - started_at) * 1_000, 2)
                results.append(
                    self._failure_result(
                        evaluation_case,
                        current_mode,
                        clean_text,
                        provider_input,
                        "provider_error",
                        None,
                        latency_ms,
                    )
                )

        if not dry_run and actual_requests >= self.max_requests and len(results) < len(planned):
            request_limit_reached = True
        metrics = _build_mode_metrics(results)
        return EvaluationReport(
            results=results,
            metrics=metrics,
            actual_requests=actual_requests,
            max_requests=self.max_requests,
            concurrency=self.concurrency,
            request_limit_reached=request_limit_reached,
            halted_reason=halted_reason,
            dry_run=dry_run,
            coverage=analyze_coverage([item for item, _mode in planned]),
            group_metrics=calculate_group_metrics(results),
            confidence_thresholds={
                "BASELINE_RAW": analyze_confidence_thresholds(results, prediction_field="raw_model_label"),
                "DOMAIN_POST_PROCESSING": analyze_confidence_thresholds(results, prediction_field="final_label"),
            },
        )

    @staticmethod
    def _common_result(
        evaluation_case: EvaluationCase,
        mode: str,
        clean_text: str,
        provider_input: str,
    ) -> dict[str, Any]:
        return {
            **asdict(evaluation_case),
            "message_text": clean_text,
            "provider_input": provider_input,
            "mode": mode,
        }

    def _dry_run_result(self, evaluation_case, mode, clean_text, provider_input):
        return {
            **self._common_result(evaluation_case, mode, clean_text, provider_input),
            "success": False,
            "http_status": None,
            "raw_model_label": None,
            "raw_model_score": None,
            "final_label": None,
            "rule_applied": False,
            "rule_reason": None,
            "latency_ms": None,
            "error": "dry_run",
        }

    def _success_result(
        self,
        evaluation_case,
        mode,
        clean_text,
        provider_input,
        raw_label,
        raw_score,
        final_label,
        rule_applied,
        rule_reason,
        latency_ms,
    ):
        return {
            **self._common_result(evaluation_case, mode, clean_text, provider_input),
            "success": True,
            "http_status": None,
            "raw_model_label": raw_label,
            "raw_model_score": round(raw_score, 4),
            "final_label": final_label,
            "rule_applied": rule_applied,
            "rule_reason": rule_reason,
            "latency_ms": latency_ms,
            "error": None,
        }

    def _failure_result(
        self,
        evaluation_case,
        mode,
        clean_text,
        provider_input,
        code,
        status_code,
        latency_ms,
    ):
        return {
            **self._common_result(evaluation_case, mode, clean_text, provider_input),
            "success": False,
            "http_status": status_code,
            "raw_model_label": None,
            "raw_model_score": None,
            "final_label": None,
            "rule_applied": False,
            "rule_reason": None,
            "latency_ms": latency_ms,
            "error": code,
        }


def _build_mode_metrics(results: list[dict[str, Any]]) -> dict[str, dict[str, Any] | None]:
    raw_results = [result for result in results if result["mode"] == "raw"]
    segmented_results = [result for result in results if result["mode"] == "segmented"]
    return {
        "BASELINE_RAW": calculate_metrics(raw_results, prediction_field="raw_model_label"),
        "WORD_SEGMENTED": calculate_metrics(segmented_results, prediction_field="raw_model_label"),
        "DOMAIN_POST_PROCESSING": calculate_metrics(raw_results, prediction_field="final_label"),
    }


def load_word_segmenter(name: str = "auto") -> Callable[[str], str]:
    errors: list[str] = []
    if name in {"auto", "underthesea"}:
        try:
            from underthesea import word_tokenize

            return lambda text: str(word_tokenize(text, format="text"))
        except ImportError:
            errors.append("underthesea")
    if name in {"auto", "pyvi"}:
        try:
            from pyvi import ViTokenizer

            return lambda text: str(ViTokenizer.tokenize(text))
        except ImportError:
            errors.append("pyvi")
    missing = ", ".join(errors or [name])
    raise RuntimeError(f"No trusted word segmenter is installed ({missing})")


def write_report(report: EvaluationReport, output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".json":
        path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        return
    if path.suffix.lower() != ".csv":
        raise ValueError("Output must use .json or .csv")
    fieldnames = list(report.results[0].keys()) if report.results else []
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(report.results)


def _max_requests_from_environment() -> int:
    raw = os.environ.get("HF_EVAL_MAX_REQUESTS", str(DEFAULT_MAX_REQUESTS)).strip()
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError("HF_EVAL_MAX_REQUESTS must be an integer") from error
    if value < 1:
        raise ValueError("HF_EVAL_MAX_REQUESTS must be at least 1")
    return value


def resolve_request_cap(requested: int | None, *, hard_limit: int | None = None) -> int:
    ceiling = hard_limit if hard_limit is not None else _max_requests_from_environment()
    if ceiling < 1:
        raise ValueError("HF_EVAL_MAX_REQUESTS must be at least 1")
    if requested is None:
        return ceiling
    if requested < 1:
        raise ValueError("--max-requests must be at least 1")
    if requested > ceiling:
        raise ValueError("--max-requests cannot exceed HF_EVAL_MAX_REQUESTS")
    return requested


def prepare_evaluation_settings(settings: Settings) -> Settings:
    """Make one logical evaluation call equal exactly one provider request."""
    return settings.model_copy(update={"hf_max_retries": 0, "hf_max_concurrency": 1})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Controlled Hugging Face sentiment evaluator")
    parser.add_argument("input", type=Path, help="JSON or CSV evaluation cases")
    parser.add_argument("--output", type=Path, help="Result .json or .csv path")
    parser.add_argument("--validation-output", type=Path, help="Sanitized manual-label validation JSON")
    parser.add_argument("--errors-output", type=Path, help="Masked row-level error analysis CSV")
    parser.add_argument("--max-requests", type=int)
    parser.add_argument("--mode", choices=MODES, default="raw")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--concurrency", type=int, choices=(1,), default=1)
    parser.add_argument("--segmenter", choices=("auto", "underthesea", "pyvi"), default="auto")
    parser.add_argument(
        "--per-label",
        type=int,
        help="Select this many non-ambiguous cases per label, prioritizing priority=true",
    )
    return parser


async def _run_cli(args: argparse.Namespace) -> int:
    manual_validation: dict[str, Any] | None = None
    if args.input.suffix.lower() == ".csv":
        header, _rows, _encoding_warning = _read_csv_rows(args.input)
        if "human_label" in header:
            manual_validation = validate_manual_review_csv(args.input)
            validation_output = args.validation_output or (
                BACKEND_ROOT / "reports" / "hf_manual_label_validation_20260715.json"
            )
            write_validation_report(manual_validation, validation_output)
            blockers = manual_validation_blockers(manual_validation)
            if blockers:
                print("Manual dataset validation: BLOCKED_INVALID_DATASET")
                print(f"Validation blockers: {', '.join(blockers)}")
                return 4

    cases = load_cases(args.input)
    settings = Settings()
    max_requests = resolve_request_cap(
        args.max_requests,
        hard_limit=settings.hf_eval_max_requests,
    )
    if args.per_label is not None:
        cases = select_balanced_cases(cases, per_label=args.per_label)
        calls_per_case = 2 if args.mode == "both" else 1
        if len(cases) * calls_per_case > max_requests:
            raise ValueError("Balanced selection exceeds --max-requests")
    else:
        calls_per_case = 2 if args.mode == "both" else 1
        cases = select_cases_for_request_cap(cases, max_requests=max(1, max_requests // calls_per_case))
    segmenter = load_word_segmenter(args.segmenter) if args.mode in {"segmented", "both"} else None
    settings = prepare_evaluation_settings(settings)
    client = HuggingFaceSentimentClient(settings)
    if not args.dry_run and not client.configured:
        print("HF_TOKEN configured: NO")
        return 2

    runner = EvaluationRunner(
        client=client,
        max_requests=max_requests,
        concurrency=args.concurrency,
        segmenter=segmenter,
    )
    output = args.output or args.input.with_name(f"{args.input.stem}_hf_evaluation.json")
    try:
        report = await runner.evaluate(cases, mode=args.mode, dry_run=args.dry_run)
        write_report(report, output)
        if args.errors_output:
            write_error_report(report.results, args.errors_output)
    finally:
        await client.close()

    print(f"Evaluation complete: requests={report.actual_requests}/{report.max_requests}, output={output}")
    if report.halted_reason:
        print(f"Evaluation halted: {report.halted_reason}")
        return 3
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return asyncio.run(_run_cli(args))


if __name__ == "__main__":
    raise SystemExit(main())
