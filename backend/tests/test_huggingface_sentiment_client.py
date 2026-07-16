import asyncio
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.huggingface_sentiment_client import (  # noqa: E402
    HuggingFaceClientError,
    HuggingFaceSentimentClient,
    normalize_sentiment_input,
)
from app.core.config import Settings  # noqa: E402


DEFAULT_MODEL = "wonrax/phobert-base-vietnamese-sentiment"


def settings(**overrides):
    values = {
        "hf_token": "hf_test_secret_value",
        "hf_model": DEFAULT_MODEL,
        "hf_provider": "hf-inference",
        "hf_timeout_seconds": 0.1,
        "hf_max_retries": 2,
        "hf_max_concurrency": 2,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class FakeSdkClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0
        self.closed = False

    async def text_classification(self, _text, **_kwargs):
        self.calls += 1
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response

    async def close(self):
        self.closed = True


class FakeHttpError(Exception):
    def __init__(self, status_code, message="request failed"):
        self.response = SimpleNamespace(status_code=status_code)
        super().__init__(message)


def run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize(
    ("raw_label", "expected"),
    [
        ("POS", "positive"),
        ("NEG", "negative"),
        ("NEU", "neutral"),
        ("POSITIVE", "positive"),
        ("negative", "negative"),
        ("Neutral", "neutral"),
        ("LABEL_0", "negative"),
        ("LABEL_1", "positive"),
        ("LABEL_2", "neutral"),
    ],
)
def test_maps_supported_labels_for_verified_default_model(raw_label, expected):
    sdk = FakeSdkClient([[{"label": raw_label, "score": 0.91}]])
    client = HuggingFaceSentimentClient(settings(), sdk_client=sdk)

    result = run(client.predict("Dịch vụ tốt"))

    assert result.label == expected
    assert result.confidence == 0.91


def test_does_not_depend_on_label_order_and_accepts_nested_output():
    sdk = FakeSdkClient([[[
        {"label": "NEU", "score": 0.2},
        {"label": "NEG", "score": 0.7},
        {"label": "POS", "score": 0.1},
    ]]])
    client = HuggingFaceSentimentClient(settings(), sdk_client=sdk)

    result = run(client.predict("Không hài lòng"))

    assert result.label == "negative"
    assert result.score == -0.7


@pytest.mark.parametrize(
    "payload",
    [
        {"label": "POS", "score": 0.8},
        [{"label": "POS", "score": 0.8}],
        {"output": [{"label": "POS", "score": 0.8}]},
        {"results": [[{"label": "POS", "score": 0.8}]]},
    ],
)
def test_accepts_dict_top_label_and_missing_other_labels(payload):
    client = HuggingFaceSentimentClient(settings(), sdk_client=FakeSdkClient([payload]))

    result = run(client.predict("Tốt"))

    assert result.label == "positive"


@pytest.mark.parametrize("payload", [[], [[]], {}, {"unexpected": True}, "not-json"])
def test_rejects_empty_or_invalid_response_without_neutral_fallback(payload):
    client = HuggingFaceSentimentClient(settings(), sdk_client=FakeSdkClient([payload]))

    with pytest.raises(HuggingFaceClientError) as error:
        run(client.predict("Nội dung"))

    assert error.value.code == "invalid_response"
    assert error.value.retryable is False


def test_label_id_is_not_guessed_for_custom_model():
    client = HuggingFaceSentimentClient(
        settings(hf_model="organization/custom-model"),
        sdk_client=FakeSdkClient([[{"label": "LABEL_0", "score": 0.9}]]),
    )

    with pytest.raises(HuggingFaceClientError) as error:
        run(client.predict("Nội dung"))

    assert error.value.code == "unknown_label"


@pytest.mark.parametrize("status_code", [400, 401, 403])
def test_does_not_retry_non_retryable_http_errors(status_code):
    sdk = FakeSdkClient([FakeHttpError(status_code, "hf_test_secret_value")])
    client = HuggingFaceSentimentClient(settings(), sdk_client=sdk)

    with pytest.raises(HuggingFaceClientError) as error:
        run(client.predict("Nội dung"))

    assert sdk.calls == 1
    assert error.value.status_code == status_code
    assert error.value.retryable is False


@pytest.mark.parametrize("status_code", [429, 500, 502, 503, 504])
def test_retries_transient_http_errors_then_succeeds(status_code):
    sleeps = []

    async def fake_sleep(delay):
        sleeps.append(delay)

    sdk = FakeSdkClient([
        FakeHttpError(status_code),
        [{"label": "NEU", "score": 0.6}],
    ])
    client = HuggingFaceSentimentClient(settings(), sdk_client=sdk, sleep=fake_sleep)

    result = run(client.predict("Bình thường"))

    assert result.label == "neutral"
    assert sdk.calls == 2
    assert client.request_attempt_count == 2
    assert sleeps == [1.0]


def test_retries_timeout_until_budget_is_exhausted():
    sdk = FakeSdkClient([TimeoutError(), TimeoutError(), TimeoutError()])

    async def no_sleep(_delay):
        return None

    client = HuggingFaceSentimentClient(settings(), sdk_client=sdk, sleep=no_sleep)

    with pytest.raises(HuggingFaceClientError) as error:
        run(client.predict("Nội dung"))

    assert error.value.code == "timeout"
    assert error.value.retryable is True
    assert sdk.calls == 3
    assert client.request_attempt_count == 3


@pytest.mark.parametrize(
    ("status_code", "expected_code"),
    [(429, "rate_limited"), (503, "provider_unavailable")],
)
def test_transient_http_error_retry_budget_is_exhausted(status_code, expected_code):
    sleeps = []

    async def fake_sleep(delay):
        sleeps.append(delay)

    sdk = FakeSdkClient([FakeHttpError(status_code) for _ in range(3)])
    client = HuggingFaceSentimentClient(settings(), sdk_client=sdk, sleep=fake_sleep)

    with pytest.raises(HuggingFaceClientError) as error:
        run(client.predict("Ná»™i dung"))

    assert error.value.code == expected_code
    assert error.value.status_code == status_code
    assert error.value.retryable is True
    assert sdk.calls == 3
    assert sleeps == [1.0, 2.0]


def test_missing_token_is_controlled_and_does_not_create_sdk_client():
    client = HuggingFaceSentimentClient(settings(hf_token=""))

    with pytest.raises(HuggingFaceClientError) as error:
        run(client.predict("Nội dung"))

    assert error.value.code == "missing_token"
    assert client.health_snapshot.token_configured is False


def test_hf_token_has_priority_over_legacy_api_key(monkeypatch):
    monkeypatch.setenv("HF_TOKEN", "hf_primary")
    monkeypatch.setenv("HUGGINGFACE_API_KEY", "hf_fallback")

    configured = Settings(_env_file=None)

    assert configured.hf_token.get_secret_value() == "hf_primary"


def test_legacy_api_key_is_supported_when_hf_token_is_absent(monkeypatch):
    monkeypatch.delenv("HF_TOKEN", raising=False)
    monkeypatch.setenv("HUGGINGFACE_API_KEY", "hf_fallback")

    configured = Settings(_env_file=None)

    assert configured.effective_hf_token.get_secret_value() == "hf_fallback"


def test_legacy_api_key_is_supported_when_hf_token_is_blank(monkeypatch):
    monkeypatch.setenv("HF_TOKEN", "")
    monkeypatch.setenv("HUGGINGFACE_API_KEY", "hf_fallback")

    configured = Settings(_env_file=None)

    assert configured.effective_hf_token.get_secret_value() == "hf_fallback"


def test_token_never_appears_in_logs_or_public_error(caplog):
    token = "hf_test_secret_value"
    sdk = FakeSdkClient([FakeHttpError(401, f"Bearer {token}")])
    client = HuggingFaceSentimentClient(settings(hf_token=token), sdk_client=sdk)

    with caplog.at_level(logging.WARNING):
        with pytest.raises(HuggingFaceClientError) as error:
            run(client.predict("Nội dung riêng tư"))

    assert token not in caplog.text
    assert token not in str(error.value)
    assert "Nội dung riêng tư" not in caplog.text


def test_semaphore_limits_concurrency():
    class ConcurrentSdk:
        def __init__(self):
            self.active = 0
            self.max_active = 0

        async def text_classification(self, _text, **_kwargs):
            self.active += 1
            self.max_active = max(self.max_active, self.active)
            await asyncio.sleep(0.01)
            self.active -= 1
            return [{"label": "POS", "score": 0.9}]

        async def close(self):
            return None

    sdk = ConcurrentSdk()
    client = HuggingFaceSentimentClient(settings(hf_max_concurrency=2), sdk_client=sdk)

    async def scenario():
        await asyncio.gather(*[client.predict(f"message {index}") for index in range(6)])

    run(scenario())

    assert sdk.max_active == 2


def test_close_releases_shared_client():
    sdk = FakeSdkClient([[{"label": "POS", "score": 0.9}]])
    client = HuggingFaceSentimentClient(settings(), sdk_client=sdk)

    run(client.close())

    assert sdk.closed is True


def test_input_normalization_masks_sensitive_data_and_rejects_empty():
    cleaned = normalize_sentiment_input(
        "  Liên hệ test@example.com, 0901234567, MSSV: 21D123456, password=secret, "
        "access_token=payload.signature, api_key='provider secret', "
        "session_token=\"two part session\"\x00  "
    )

    assert "test@example.com" not in cleaned
    assert "0901234567" not in cleaned
    assert "21D123456" not in cleaned
    assert "secret" not in cleaned
    assert "payload.signature" not in cleaned
    assert "provider-secret" not in cleaned
    assert "provider secret" not in cleaned
    assert "two part session" not in cleaned
    assert cleaned.count("[CREDENTIAL]") == 3
    assert "\x00" not in cleaned
    with pytest.raises(HuggingFaceClientError):
        normalize_sentiment_input(" \x00\n ")
