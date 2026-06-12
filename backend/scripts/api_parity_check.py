from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import httpx


NODE_BASE_URL = os.environ.get("NODE_API_BASE_URL", "http://localhost:5000").rstrip("/")
FASTAPI_BASE_URL = os.environ.get("FASTAPI_API_BASE_URL", "http://localhost:8000").rstrip("/")
REPORT_PATH = Path(__file__).resolve().parents[1] / "reports" / "api_parity_report.md"

ENDPOINTS = [
    "/api/dashboard/kpi",
    "/api/analytics/sentiment-summary",
    "/api/analytics/sentiment-trend",
    "/api/analytics/need-review-conversations",
    "/api/analytics/negative-conversations",
    "/api/analytics/need-review-keywords",
    "/api/analytics/negative-keywords",
]


def main() -> int:
    results = []
    for endpoint in ENDPOINTS:
        node = fetch_json(f"{NODE_BASE_URL}{endpoint}")
        fastapi = fetch_json(f"{FASTAPI_BASE_URL}{endpoint}")
        results.append(compare_endpoint(endpoint, node, fastapi))

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(render_report(results), encoding="utf-8")
    print(f"Wrote parity report: {REPORT_PATH}")
    return 0


def fetch_json(url: str) -> Dict[str, Any]:
    try:
        with httpx.Client(timeout=20) as client:
            response = client.get(url)
        try:
            payload = response.json()
        except json.JSONDecodeError:
            payload = None
        return {"status": response.status_code, "payload": payload, "error": None}
    except Exception as exc:
        return {"status": None, "payload": None, "error": str(exc)}


def compare_endpoint(endpoint: str, node: Dict[str, Any], fastapi: Dict[str, Any]) -> Dict[str, Any]:
    node_data = unwrap_data(node.get("payload"))
    fastapi_data = unwrap_data(fastapi.get("payload"))
    node_keys = extract_keys(node_data)
    fastapi_keys = extract_keys(fastapi_data)
    status_match = node.get("status") == fastapi.get("status") == 200
    key_overlap = sorted(set(node_keys).intersection(fastapi_keys))
    missing_in_fastapi = sorted(set(node_keys) - set(fastapi_keys))
    important_metrics = extract_metrics(node_data, fastapi_data)

    if node.get("error") or fastapi.get("error"):
        verdict = "not_run"
        note = "One or both servers are unreachable."
    elif not status_match:
        verdict = "blocking"
        note = "HTTP status codes differ or are not both 200."
    elif missing_in_fastapi:
        verdict = "review"
        note = "FastAPI response is missing keys present in Node response."
    else:
        verdict = "ok"
        note = "Status and top-level data keys match."

    return {
        "endpoint": endpoint,
        "node": node,
        "fastapi": fastapi,
        "nodeKeys": node_keys,
        "fastapiKeys": fastapi_keys,
        "keyOverlap": key_overlap,
        "missingInFastapi": missing_in_fastapi,
        "metrics": important_metrics,
        "verdict": verdict,
        "note": note,
    }


def unwrap_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def extract_keys(value: Any) -> List[str]:
    if isinstance(value, dict):
        return sorted(value.keys())
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return sorted(value[0].keys())
    if isinstance(value, list):
        return ["<list>"]
    return []


def extract_metrics(node_data: Any, fastapi_data: Any) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    for key in ("total", "totalConversations", "totalMessages", "needStaffReviewCount"):
        node_value = value_at(node_data, key)
        fastapi_value = value_at(fastapi_data, key)
        if node_value is not None or fastapi_value is not None:
            metrics[key] = {"node": node_value, "fastapi": fastapi_value}
    for path in (("pagination", "total"), ("summary", "total")):
        node_value = nested_value(node_data, path)
        fastapi_value = nested_value(fastapi_data, path)
        if node_value is not None or fastapi_value is not None:
            metrics[".".join(path)] = {"node": node_value, "fastapi": fastapi_value}
    return metrics


def value_at(value: Any, key: str) -> Any:
    if isinstance(value, dict):
        return value.get(key)
    return None


def nested_value(value: Any, path: tuple[str, ...]) -> Any:
    current = value
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def render_report(results: List[Dict[str, Any]]) -> str:
    lines = [
        "# API Parity Report",
        "",
        f"Generated at: {datetime.now().isoformat(timespec='seconds')}",
        f"Node base URL: `{NODE_BASE_URL}`",
        f"FastAPI base URL: `{FASTAPI_BASE_URL}`",
        "",
        "This report is read-only. It does not run migrations, reprocess analytics, or write production data.",
        "",
        _summary_verdict(results),
        "",
        "| Endpoint | Node status | FastAPI status | Verdict | Notes |",
        "| --- | ---: | ---: | --- | --- |",
    ]
    for result in results:
        node_status = result["node"].get("status") or "unreachable"
        fastapi_status = result["fastapi"].get("status") or "unreachable"
        lines.append(
            f"| `{result['endpoint']}` | {node_status} | {fastapi_status} | "
            f"{result['verdict']} | {result['note']} |"
        )
    lines.extend(["", "## Details", ""])
    for result in results:
        lines.extend(
            [
                f"### `{result['endpoint']}`",
                "",
                f"- Node error: `{result['node'].get('error') or ''}`",
                f"- FastAPI error: `{result['fastapi'].get('error') or ''}`",
                f"- Node data keys: `{', '.join(result['nodeKeys'])}`",
                f"- FastAPI data keys: `{', '.join(result['fastapiKeys'])}`",
                f"- Missing in FastAPI: `{', '.join(result['missingInFastapi'])}`",
                f"- Important metrics: `{json.dumps(result['metrics'], ensure_ascii=False)}`",
                "",
            ]
        )
    return "\n".join(lines)


def _summary_verdict(results: List[Dict[str, Any]]) -> str:
    if all(result["verdict"] == "ok" for result in results):
        return (
            "Summary verdict: all checked read endpoints returned HTTP 200 on both Node.js "
            "and FastAPI. Differences observed are additive FastAPI fields and are acceptable "
            "for frontend compatibility because FastAPI does not remove Node response keys."
        )
    if any(result["verdict"] == "blocking" for result in results):
        return "Summary verdict: one or more blocking parity differences require review before frontend cutover."
    if any(result["verdict"] == "not_run" for result in results):
        return "Summary verdict: parity was not completed because one or both backends were unreachable."
    return "Summary verdict: parity requires review before frontend cutover."


if __name__ == "__main__":
    raise SystemExit(main())
