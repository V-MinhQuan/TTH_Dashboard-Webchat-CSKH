from __future__ import annotations

import asyncio
import inspect
import logging
import re
import unicodedata
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Iterable

import httpx
from aiohttp import ClientError as AioHttpClientError
from huggingface_hub import AsyncInferenceClient

from app.core.config import Settings, get_settings


logger = logging.getLogger(__name__)

DEFAULT_HF_MODEL = "wonrax/phobert-base-vietnamese-sentiment"
RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})
NON_RETRYABLE_STATUS_CODES = frozenset({400, 401, 403})
MAX_INPUT_CHARS = 1_000

_EMAIL_RE = re.compile(r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b")
_BEARER_RE = re.compile(r"(?i)\bbearer\s+[a-z0-9._~+/=-]{8,}")
_HF_TOKEN_RE = re.compile(r"\bhf_[A-Za-z0-9]{8,}\b")
_CREDENTIAL_RE = re.compile(
    r"(?i)\b(access[_\s-]?token|authorization|api[_\s-]?key|session[_\s-]?token|secret|token)"
    r"\s*[:=]\s*(?:bearer\s+)?(?:\"[^\"]*\"|'[^']*'|[^\s,;]+)"
)
_PASSWORD_RE = re.compile(
    r"(?i)\b(password|passwd|pwd|mat\s*khau|mật\s*khẩu)\s*[:=]\s*"
    r"(?:\"[^\"]*\"|'[^']*'|[^\s,;]+)"
)
_PHONE_RE = re.compile(r"(?<!\w)(?:\+?84|0)[\s.()-]*(?:\d[\s.()-]*){8,10}(?!\w)")
_STUDENT_ID_RE = re.compile(r"(?i)\b(?:mssv|ma\s*sinh\s*vien|mã\s*sinh\s*viên)\s*[:=]?\s*[A-Z0-9-]{6,20}\b")
_LONG_IDENTIFIER_RE = re.compile(r"(?<!\w)\d{8,16}(?!\w)")


class HuggingFaceClientError(RuntimeError):
    """Sanitized provider failure safe for logs, API responses, and SQL state."""

    def __init__(
        self,
        code: str,
        *,
        retryable: bool,
        status_code: int | None = None,
    ) -> None:
        self.code = code
        self.retryable = retryable
        self.status_code = status_code
        super().__init__(code)


@dataclass(frozen=True)
class SentimentPrediction:
    label: str
    confidence: float
    score: float
    raw_label: str


@dataclass(frozen=True)
class HuggingFaceHealthSnapshot:
    token_configured: bool
    model: str
    provider: str
    last_call_at: str | None = None
    last_success_at: str | None = None
    last_status: str = "not_called"
    last_error: str | None = None
    last_latency_ms: float | None = None


def _secret_value(value: Any) -> str:
    if hasattr(value, "get_secret_value"):
        value = value.get_secret_value()
    return str(value or "").strip()


def normalize_sentiment_input(value: Any) -> str:
    text = unicodedata.normalize("NFC", str(value or ""))
    text = "".join(" " if unicodedata.category(char).startswith("C") else char for char in text)
    text = _EMAIL_RE.sub("[EMAIL]", text)
    text = _BEARER_RE.sub("[ACCESS_TOKEN]", text)
    text = _HF_TOKEN_RE.sub("[ACCESS_TOKEN]", text)
    text = _CREDENTIAL_RE.sub(lambda match: f"{match.group(1)}=[CREDENTIAL]", text)
    text = _PASSWORD_RE.sub(lambda match: f"{match.group(1)}=[PASSWORD]", text)
    text = _PHONE_RE.sub("[PHONE]", text)
    text = _STUDENT_ID_RE.sub("MSSV=[STUDENT_ID]", text)
    text = _LONG_IDENTIFIER_RE.sub("[IDENTIFIER]", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        raise HuggingFaceClientError("empty_input", retryable=False)
    return text[:MAX_INPUT_CHARS]


class HuggingFaceSentimentClient:
    """Shared async HF client with bounded concurrency and sanitized failures."""

    def __init__(
        self,
        settings: Settings | Any | None = None,
        *,
        sdk_client: Any | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.settings = settings or get_settings()
        token_setting = getattr(
            self.settings,
            "effective_hf_token",
            getattr(self.settings, "hf_token", ""),
        )
        self.token = _secret_value(token_setting)
        self.model = str(self.settings.hf_model).strip()
        self.provider = str(self.settings.hf_provider).strip()
        self._sleep = sleep
        self._semaphore = asyncio.Semaphore(int(self.settings.hf_max_concurrency))
        self._request_attempt_count = 0
        self._client = sdk_client
        if self._client is None and self.token:
            self._client = AsyncInferenceClient(
                provider=self.provider,
                api_key=self.token,
                timeout=float(self.settings.hf_timeout_seconds),
            )
        self._health = HuggingFaceHealthSnapshot(
            token_configured=bool(self.token),
            model=self.model,
            provider=self.provider,
        )

    @property
    def configured(self) -> bool:
        return bool(self.token)

    @property
    def health_snapshot(self) -> HuggingFaceHealthSnapshot:
        return self._health

    @property
    def request_attempt_count(self) -> int:
        """Return actual provider attempts, including bounded retries."""
        return self._request_attempt_count

    async def predict(self, text: Any) -> SentimentPrediction:
        if not self.configured or self._client is None:
            error = HuggingFaceClientError("missing_token", retryable=False)
            self._record_failure(error, started_at=None)
            raise error

        cleaned = normalize_sentiment_input(text)
        started_at = datetime.now(timezone.utc)
        max_attempts = int(self.settings.hf_max_retries) + 1

        for attempt in range(max_attempts):
            try:
                async with self._semaphore:
                    self._request_attempt_count += 1
                    payload = await self._client.text_classification(
                        cleaned,
                        model=self.model,
                        top_k=None,
                    )
                prediction = _normalize_prediction(payload, model=self.model)
                self._record_success(started_at)
                return prediction
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                error = _normalize_exception(exc)
                is_last_attempt = attempt + 1 >= max_attempts
                if not error.retryable or is_last_attempt:
                    self._record_failure(error, started_at=started_at)
                    logger.warning(
                        "Hugging Face sentiment request failed code=%s status=%s attempts=%s model=%s",
                        error.code,
                        error.status_code,
                        attempt + 1,
                        self.model,
                    )
                    raise error from None
                delay = float(2**attempt)
                logger.info(
                    "Retrying Hugging Face sentiment request code=%s status=%s attempt=%s model=%s",
                    error.code,
                    error.status_code,
                    attempt + 1,
                    self.model,
                )
                await self._sleep(delay)

        raise HuggingFaceClientError("provider_error", retryable=True)  # pragma: no cover

    async def predict_batch(self, texts: Iterable[Any]) -> list[SentimentPrediction]:
        return list(await asyncio.gather(*(self.predict(text) for text in texts)))

    async def close(self) -> None:
        if self._client is None:
            return
        result = self._client.close()
        if inspect.isawaitable(result):
            await result

    def _record_success(self, started_at: datetime) -> None:
        now = datetime.now(timezone.utc)
        self._health = replace(
            self._health,
            last_call_at=now.isoformat(),
            last_success_at=now.isoformat(),
            last_status="ok",
            last_error=None,
            last_latency_ms=round((now - started_at).total_seconds() * 1_000, 2),
        )

    def _record_failure(
        self,
        error: HuggingFaceClientError,
        *,
        started_at: datetime | None,
    ) -> None:
        now = datetime.now(timezone.utc)
        latency = None if started_at is None else round((now - started_at).total_seconds() * 1_000, 2)
        self._health = replace(
            self._health,
            last_call_at=now.isoformat(),
            last_status="error",
            last_error=error.code,
            last_latency_ms=latency,
        )


def _normalize_exception(exc: Exception) -> HuggingFaceClientError:
    if isinstance(exc, HuggingFaceClientError):
        return exc
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, httpx.TimeoutException)):
        return HuggingFaceClientError("timeout", retryable=True)

    status_code = _status_code(exc)
    if status_code in RETRYABLE_STATUS_CODES:
        code = "rate_limited" if status_code == 429 else "provider_unavailable"
        return HuggingFaceClientError(code, retryable=True, status_code=status_code)
    if status_code in NON_RETRYABLE_STATUS_CODES:
        code = "invalid_request" if status_code == 400 else "authentication_failed"
        return HuggingFaceClientError(code, retryable=False, status_code=status_code)
    if status_code is not None:
        return HuggingFaceClientError("provider_rejected", retryable=False, status_code=status_code)
    if isinstance(exc, (AioHttpClientError, httpx.TransportError, ConnectionError, OSError)):
        return HuggingFaceClientError("network_error", retryable=True)
    if isinstance(exc, ValueError):
        return HuggingFaceClientError("invalid_response", retryable=False)
    return HuggingFaceClientError("provider_error", retryable=False)


def _status_code(exc: Exception) -> int | None:
    direct = getattr(exc, "status_code", None)
    response = getattr(exc, "response", None)
    value = direct if direct is not None else getattr(response, "status_code", None)
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _normalize_prediction(payload: Any, *, model: str) -> SentimentPrediction:
    items = _prediction_items(payload)
    candidates: list[tuple[str, str, float]] = []
    unknown_labels: list[str] = []
    for item in items:
        raw_label = str(item.get("label") or "").strip()
        label = _map_label(raw_label, model=model)
        if label is None:
            if raw_label:
                unknown_labels.append(raw_label)
            continue
        try:
            confidence = float(item.get("score"))
        except (TypeError, ValueError):
            raise HuggingFaceClientError("invalid_response", retryable=False) from None
        if not 0 <= confidence <= 1:
            raise HuggingFaceClientError("invalid_response", retryable=False)
        candidates.append((label, raw_label, confidence))

    if not candidates:
        code = "unknown_label" if unknown_labels else "invalid_response"
        raise HuggingFaceClientError(code, retryable=False)
    label, raw_label, confidence = max(candidates, key=lambda candidate: candidate[2])
    signed_score = confidence if label == "positive" else -confidence if label == "negative" else 0.0
    return SentimentPrediction(
        label=label,
        confidence=round(confidence, 4),
        score=round(signed_score, 4),
        raw_label=raw_label,
    )


def _prediction_items(payload: Any) -> list[dict[str, Any]]:
    current = payload
    if isinstance(current, dict) and "label" not in current:
        current = current.get("output", current.get("results"))
    while isinstance(current, list) and len(current) == 1 and isinstance(current[0], list):
        current = current[0]
    if isinstance(current, dict) and current.get("label") is not None:
        current = [current]
    if not isinstance(current, list) or not current:
        raise HuggingFaceClientError("invalid_response", retryable=False)
    if not all(isinstance(item, dict) for item in current):
        raise HuggingFaceClientError("invalid_response", retryable=False)
    return current


def _map_label(raw_label: str, *, model: str) -> str | None:
    normalized = raw_label.strip().upper()
    aliases = {
        "POS": "positive",
        "POSITIVE": "positive",
        "NEG": "negative",
        "NEGATIVE": "negative",
        "NEU": "neutral",
        "NEUTRAL": "neutral",
    }
    if normalized in aliases:
        return aliases[normalized]
    if model == DEFAULT_HF_MODEL:
        # Verified against the model's committed config.json: 0=NEG, 1=POS, 2=NEU.
        return {"LABEL_0": "negative", "LABEL_1": "positive", "LABEL_2": "neutral"}.get(normalized)
    return None
