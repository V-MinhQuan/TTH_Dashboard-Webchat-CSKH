from __future__ import annotations

from typing import Any, Dict

from app.services.customer_issue_detector import detect_customer_issue
from app.services.huggingface_sentiment_client import (
    HuggingFaceClientError,
    HuggingFaceSentimentClient,
)


class SentimentService:
    def __init__(self, client: HuggingFaceSentimentClient | None = None) -> None:
        self.client = client or HuggingFaceSentimentClient()

    async def predict(self, text: str) -> Dict[str, Any]:
        issue = detect_customer_issue(text)
        try:
            prediction = await self.client.predict(text)
        except HuggingFaceClientError as exc:
            return {
                "sentiment": {"label": None, "confidence": None},
                "sentimentScore": None,
                "issue": issue,
                "needStaffReview": bool(issue.get("issueFlag")),
                "analyzerVersion": self.client.model,
                "actualAnalyzerVersion": self.client.model,
                "source": "huggingface",
                "endpoint": "text-classification",
                "sentimentMode": "single-model",
                "analysisStatus": "pending" if exc.retryable or exc.code == "missing_token" else "failed",
                "analysisSource": "huggingface",
                "analysisError": exc.code,
            }

        return {
            "sentiment": {
                "label": prediction.label,
                "confidence": prediction.confidence,
            },
            "sentimentScore": prediction.score,
            "issue": issue,
            "needStaffReview": bool(issue.get("issueFlag")) or prediction.label == "negative",
            "analyzerVersion": self.client.model,
            "actualAnalyzerVersion": self.client.model,
            "source": "huggingface",
            "endpoint": "text-classification",
            "sentimentMode": "single-model",
            "phobert": None,
            "visobert": None,
            "rule": None,
            "analysisStatus": "completed",
            "analysisSource": "huggingface",
            "analysisError": None,
        }

    def get_ml_health(self) -> Dict[str, Any]:
        snapshot = self.client.health_snapshot
        provider_ok = snapshot.last_status == "ok"
        return {
            "status": "ok" if provider_ok else "degraded",
            "source": "huggingface",
            "provider": snapshot.provider,
            "modelName": snapshot.model,
            "tokenConfigured": snapshot.token_configured,
            "modelLoaded": provider_ok,
            "mlServiceReachable": provider_ok,
            "sentimentMode": "single-model",
            "phobertAvailable": False,
            "visobertAvailable": False,
            "issueDetectorAvailable": True,
            "actualAnalyzerVersion": snapshot.model,
            "lastCallAt": snapshot.last_call_at,
            "lastSuccessAt": snapshot.last_success_at,
            "lastStatus": snapshot.last_status,
            "lastError": snapshot.last_error,
            "lastLatencyMs": snapshot.last_latency_ms,
        }

