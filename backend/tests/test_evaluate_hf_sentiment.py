from __future__ import annotations

import asyncio
import csv
import json
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.huggingface_sentiment_client import (  # noqa: E402
    HuggingFaceClientError,
    SentimentPrediction,
)
from scripts.evaluate_hf_sentiment import (  # noqa: E402
    EvaluationCase,
    EvaluationRunner,
    analyze_confidence_thresholds,
    analyze_coverage,
    apply_domain_post_processing,
    build_parser,
    calculate_metrics,
    calculate_group_metrics,
    classify_error,
    load_cases,
    manual_validation_blockers,
    prepare_evaluation_settings,
    resolve_request_cap,
    select_balanced_cases,
    select_cases_for_request_cap,
    validate_manual_review_csv,
    write_error_report,
    write_validation_report,
    _run_cli,
)
from app.core.config import Settings  # noqa: E402


def run(coro):
    return asyncio.run(coro)


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls: list[str] = []

    async def predict(self, text):
        self.calls.append(text)
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response


def prediction(label="positive", confidence=0.9):
    score = confidence if label == "positive" else -confidence if label == "negative" else 0.0
    return SentimentPrediction(label=label, confidence=confidence, score=score, raw_label=label)


def case(sample_id, text, expected_label=None, *, ambiguous=False):
    return EvaluationCase(
        sample_id=sample_id,
        message_text=text,
        expected_label=expected_label,
        ambiguous=ambiguous,
    )


def test_balanced_selection_is_deterministic_includes_priority_cases_and_fits_both_mode_cap():
    cases = []
    for label in ("POS", "NEG", "NEU"):
        for index in range(8):
            cases.append(
                EvaluationCase(
                    sample_id=f"{label}-{index}",
                    message_text=f"{label} case {index}",
                    expected_label=label,
                    priority=index in {6, 7},
                )
            )

    selected = select_balanced_cases(cases, per_label=5)

    assert len(selected) == 15
    assert {label: sum(item.expected_label == label for item in selected) for label in ("POS", "NEG", "NEU")} == {
        "POS": 5,
        "NEG": 5,
        "NEU": 5,
    }
    assert all(any(item.sample_id == f"{label}-{index}" for item in selected) for label in ("POS", "NEG", "NEU") for index in (6, 7))
    assert len(selected) * 2 == 30


def test_repository_flic_domain_fixture_is_balanced_and_keeps_five_priority_cases():
    fixture = Path(__file__).parent / "testdata" / "flic_sentiment_domain_cases.json"

    cases = load_cases(fixture)
    selected = select_balanced_cases(cases, per_label=5)

    assert len(cases) == 30
    assert {
        label: sum(item.expected_label == label for item in cases)
        for label in ("POS", "NEG", "NEU")
    } == {"POS": 10, "NEG": 10, "NEU": 10}
    assert sum(item.priority for item in cases) == 5
    assert not any(item.ambiguous for item in cases)
    assert len(selected) == 15
    assert {item.sample_id for item in cases if item.priority}.issubset(
        {item.sample_id for item in selected}
    )


def test_live_evaluation_settings_disable_hidden_retries_and_force_one_concurrent_call():
    configured = Settings(
        _env_file=None,
        HF_TOKEN="hf_unit_test_only",
        HF_MAX_RETRIES=5,
        HF_MAX_CONCURRENCY=9,
    )

    evaluation_settings = prepare_evaluation_settings(configured)

    assert evaluation_settings.hf_max_retries == 0
    assert evaluation_settings.hf_max_concurrency == 1
    assert configured.hf_max_retries == 5
    assert configured.hf_max_concurrency == 9


def test_environment_request_limit_is_a_hard_ceiling(monkeypatch):
    monkeypatch.delenv("HF_EVAL_MAX_REQUESTS", raising=False)
    assert resolve_request_cap(None) == 300

    monkeypatch.setenv("HF_EVAL_MAX_REQUESTS", "30")

    assert resolve_request_cap(None) == 30
    assert resolve_request_cap(12) == 12
    with pytest.raises(ValueError, match="HF_EVAL_MAX_REQUESTS"):
        resolve_request_cap(31)


def test_settings_loads_eval_request_cap_from_env_file(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("HF_EVAL_MAX_REQUESTS=17\n", encoding="utf-8")

    settings = Settings(_env_file=env_file)

    assert settings.hf_eval_max_requests == 17
    assert resolve_request_cap(None, hard_limit=settings.hf_eval_max_requests) == 17


def test_load_cases_supports_json_and_csv_and_normalizes_labels(tmp_path):
    json_path = tmp_path / "cases.json"
    json_path.write_text(
        json.dumps(
            {
                "cases": [
                    {
                        "sample_id": "j1",
                        "message_text": "Cảm ơn bạn",
                        "expected_label": "positive",
                        "ambiguous": False,
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    csv_path = tmp_path / "cases.csv"
    csv_path.write_text(
        "sample_id,message_text,expected_label,ambiguous,include_in_evaluation\n"
        "c1,Hệ thống bị lỗi,negative,false,true\n"
        "c2,Cho tôi hỏi lịch thi,,true,false\n",
        encoding="utf-8",
    )

    json_cases = load_cases(json_path)
    csv_cases = load_cases(csv_path)

    assert json_cases[0].expected_label == "POS"
    assert csv_cases[0].expected_label == "NEG"
    assert csv_cases[1].expected_label is None
    assert csv_cases[1].ambiguous is True
    assert csv_cases[1].include_in_evaluation is False


def test_load_cases_rejects_unknown_label(tmp_path):
    path = tmp_path / "cases.json"
    path.write_text(
        json.dumps([{"sample_id": "1", "message_text": "Nội dung", "expected_label": "HAPPY"}]),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="expected_label"):
        load_cases(path)


def test_metrics_confusion_and_domain_error_counts_exclude_ambiguous():
    results = [
        {"expected_label": "POS", "raw_model_label": "POS", "success": True, "ambiguous": False, "latency_ms": 100},
        {"expected_label": "NEG", "raw_model_label": "NEG", "success": True, "ambiguous": False, "latency_ms": 200},
        {"expected_label": "NEU", "raw_model_label": "POS", "success": True, "ambiguous": False, "latency_ms": 300},
        {"expected_label": "NEG", "raw_model_label": "NEU", "success": True, "ambiguous": False, "latency_ms": 400},
        {"expected_label": "POS", "raw_model_label": "NEG", "success": True, "ambiguous": True, "latency_ms": 500},
    ]

    metrics = calculate_metrics(results, prediction_field="raw_model_label")

    assert metrics is not None
    assert metrics["evaluated_cases"] == 4
    assert metrics["accuracy"] == 0.5
    assert metrics["macro_precision"] == 0.5
    assert metrics["macro_recall"] == 0.5
    assert metrics["macro_f1"] == pytest.approx(4 / 9, abs=1e-4)
    assert metrics["per_class"]["NEG"]["recall"] == 0.5
    assert metrics["negative_recall"] == 0.5
    assert metrics["negative_as_neutral"] == 1
    assert metrics["neutral_as_positive"] == 1
    assert metrics["confusion_matrix"]["NEG"] == {"POS": 0, "NEG": 1, "NEU": 1, "ERROR": 0}
    assert metrics["mean_latency_ms"] == 250.0
    assert metrics["p95_latency_ms"] == 400.0
    assert metrics["api_failure_rate"] == 0.0


def test_metrics_count_api_failure_without_fabricating_a_neutral_label():
    results = [
        {"expected_label": "NEG", "raw_model_label": None, "success": False, "ambiguous": False, "latency_ms": 50},
        {"expected_label": "NEG", "raw_model_label": "NEG", "success": True, "ambiguous": False, "latency_ms": 100},
    ]

    metrics = calculate_metrics(results, prediction_field="raw_model_label")

    assert metrics["accuracy"] == 0.5
    assert metrics["negative_recall"] == 0.5
    assert metrics["confusion_matrix"]["NEG"]["ERROR"] == 1
    assert metrics["api_failure_rate"] == 0.5


def test_metrics_are_not_created_without_ground_truth():
    results = [
        {"expected_label": None, "raw_model_label": "POS", "success": True, "ambiguous": False, "latency_ms": 10}
    ]

    assert calculate_metrics(results, prediction_field="raw_model_label") is None


def test_domain_post_processing_preserves_raw_output_and_records_reason():
    negative = apply_domain_post_processing("Tôi chờ rất lâu nhưng vẫn chưa nhận được kết quả", "NEU", 0.4)
    positive = apply_domain_post_processing("Cảm ơn bạn, vấn đề đã được giải quyết", "NEU", 0.51)
    neutral = apply_domain_post_processing("Tôi muốn biết lịch thi TOEIC tháng này", "POS", 0.84)

    assert negative == ("NEG", True, "explicit_negative_domain_phrase")
    assert positive == ("POS", True, "explicit_positive_resolution_phrase")
    assert neutral == ("NEU", True, "informational_request_without_sentiment")


def test_runner_never_exceeds_request_cap_and_runs_sequentially():
    client = FakeClient([prediction(), prediction()])
    runner = EvaluationRunner(client=client, max_requests=2, concurrency=1)
    cases = [case(str(index), f"message {index}", "POS") for index in range(4)]

    report = run(runner.evaluate(cases, mode="raw"))

    assert report.actual_requests == 2
    assert len(client.calls) == 2
    assert len(report.results) == 2
    assert report.request_limit_reached is True


def test_ambiguous_cases_do_not_consume_live_request_budget():
    client = FakeClient([prediction("neutral")])
    runner = EvaluationRunner(client=client, max_requests=1, concurrency=1)

    report = run(
        runner.evaluate(
            [case("ambiguous", "Có lẽ cũng được", "NEU", ambiguous=True), case("clear", "Lịch thi khi nào?", "NEU")],
            mode="raw",
        )
    )

    assert report.actual_requests == 1
    assert len(report.results) == 1
    assert report.results[0]["sample_id"] == "clear"


def test_both_mode_uses_injected_segmenter_without_duplicate_hidden_calls():
    client = FakeClient([prediction(), prediction("neutral")])
    runner = EvaluationRunner(
        client=client,
        max_requests=2,
        concurrency=1,
        segmenter=lambda text: text.replace("đăng nhập", "đăng_nhập"),
    )

    report = run(runner.evaluate([case("1", "Tôi muốn đăng nhập", "NEU")], mode="both"))

    assert report.actual_requests == 2
    assert client.calls == ["Tôi muốn đăng nhập", "Tôi muốn đăng_nhập"]
    assert [result["mode"] for result in report.results] == ["raw", "segmented"]


def test_dry_run_makes_no_request_and_masks_output_data():
    client = FakeClient([])
    runner = EvaluationRunner(client=client, max_requests=30, concurrency=1)

    report = run(
        runner.evaluate(
            [case("1", "Email test@example.com, số 0901234567", "NEU")],
            mode="raw",
            dry_run=True,
        )
    )

    assert report.actual_requests == 0
    assert client.calls == []
    assert "test@example.com" not in report.results[0]["message_text"]
    assert "0901234567" not in report.results[0]["message_text"]


def test_runner_stops_after_auth_or_rate_limit_failure():
    for error in (
        HuggingFaceClientError("authentication_failed", retryable=False, status_code=401),
        HuggingFaceClientError("rate_limited", retryable=True, status_code=429),
    ):
        client = FakeClient([error, prediction()])
        runner = EvaluationRunner(client=client, max_requests=5, concurrency=1)

        report = run(runner.evaluate([case("1", "one", "NEU"), case("2", "two", "POS")]))

        assert report.actual_requests == 1
        assert len(client.calls) == 1
        assert report.halted_reason == error.code
        assert report.results[0]["raw_model_label"] is None
        assert report.results[0]["final_label"] is None


def test_secret_is_never_logged_or_stored_when_client_error_contains_it(caplog, capsys):
    secret = "hf_evaluation_secret_should_not_appear"
    client = FakeClient([RuntimeError(secret)])
    runner = EvaluationRunner(client=client, max_requests=1, concurrency=1)

    with caplog.at_level(logging.INFO):
        report = run(runner.evaluate([case("1", "Nội dung", "NEU")]))

    captured = capsys.readouterr()
    serialized = json.dumps(report.to_dict(), ensure_ascii=False)
    assert secret not in caplog.text
    assert secret not in captured.out
    assert secret not in captured.err
    assert secret not in serialized
    assert report.results[0]["error"] == "provider_error"


def test_runner_rejects_non_sequential_concurrency():
    with pytest.raises(ValueError, match="concurrency"):
        EvaluationRunner(client=SimpleNamespace(), max_requests=30, concurrency=2)


def test_manual_csv_uses_only_human_label_and_filters_invalid_or_excluded_rows(tmp_path):
    path = tmp_path / "manual.csv"
    path.write_text(
        "sample_id,message_text,channel,topic,current_label,human_label,review_note,include_in_evaluation\n"
        "1,Cảm ơn,web,other,NEG,  pos  ,, true \n"
        "2,Bị lỗi,web,login,POS,,,true\n"
        "3,Lịch thi,web,toeic,POS,NEU,,false\n"
        "4,Không thể đăng nhập,web,login,POS,HAPPY,,true\n",
        encoding="utf-8",
    )

    cases = load_cases(path)

    assert cases[0].expected_label == "POS"
    assert cases[0].include_in_evaluation is True
    assert cases[1].expected_label is None
    assert cases[1].include_in_evaluation is False
    assert cases[2].expected_label == "NEU"
    assert cases[2].include_in_evaluation is False
    assert cases[3].expected_label is None
    assert cases[3].include_in_evaluation is False
    assert all(item.expected_label != "NEG" for item in cases)


def test_manual_validation_reports_duplicate_invalid_empty_pii_and_label_warning_safely(tmp_path):
    path = tmp_path / "manual.csv"
    path.write_text(
        "sample_id,message_text,channel,topic,current_label,human_label,review_note,include_in_evaluation\n"
        "dup,Cảm ơn bạn,web,other,,NEG,,true\n"
        "dup,Liên hệ student@example.com,web,other,,NEU,,true\n"
        ",,web,other,,HAPPY,,true\n"
        "excluded,Lịch thi,web,toeic,,NEU,,false\n",
        encoding="utf-8",
    )

    report = validate_manual_review_csv(path)

    assert report["total_rows"] == 4
    assert report["included_rows"] == 2
    assert report["excluded_rows"] == 2
    assert report["valid_labels"] == 3
    assert report["invalid_labels"][0]["row_number"] == 4
    assert report["duplicate_sample_ids"] == ["dup"]
    assert report["empty_messages"][0]["row_number"] == 4
    assert report["pii_warnings"][0]["types"] == ["email"]
    assert report["label_review_warnings"][0]["sample_id"] == "dup"
    assert report["label_distribution"] == {"POS": 0, "NEG": 1, "NEU": 1}
    serialized = json.dumps(report, ensure_ascii=False)
    assert "student@example.com" not in serialized

    output = tmp_path / "validation.json"
    write_validation_report(report, output)
    assert json.loads(output.read_text(encoding="utf-8"))["total_rows"] == 4


def test_manual_validation_rejects_missing_required_columns(tmp_path):
    path = tmp_path / "manual.csv"
    path.write_text("sample_id,message_text\n1,hello\n", encoding="utf-8")

    with pytest.raises(ValueError, match="missing required columns"):
        validate_manual_review_csv(path)


def test_manual_validation_blocks_non_utf8_and_outer_quoted_single_field_rows(tmp_path):
    path = tmp_path / "malformed.csv"
    header = "sample_id,message_text,channel,topic,current_label,human_label,review_note,include_in_evaluation\n"
    malformed = '"1,Cam on,web,other,,POS,,true"\n'
    path.write_bytes((header + malformed + "Ghi chú\n").encode("cp1258"))

    report = validate_manual_review_csv(path)

    assert report["malformed_rows"]
    assert report["encoding_warnings"] == ["decoded_as_cp1258_not_utf8"]
    assert "malformed_rows" in manual_validation_blockers(report)
    assert "encoding_warnings" in manual_validation_blockers(report)
    with pytest.raises(ValueError, match="Malformed CSV rows"):
        load_cases(path)


def test_invalid_manual_csv_exits_before_settings_or_hf_client(tmp_path, monkeypatch):
    path = tmp_path / "manual.csv"
    header = "sample_id,message_text,channel,topic,current_label,human_label,review_note,include_in_evaluation\n"
    path.write_text(header + '"1,Cam on,web,other,,POS,,true"\n', encoding="utf-8")
    validation_output = tmp_path / "validation.json"
    output = tmp_path / "evaluation.json"

    def forbidden(*_args, **_kwargs):
        raise AssertionError("Settings/client must not initialize for invalid manual CSV")

    monkeypatch.setattr("scripts.evaluate_hf_sentiment.Settings", forbidden)
    monkeypatch.setattr("scripts.evaluate_hf_sentiment.HuggingFaceSentimentClient", forbidden)
    args = build_parser().parse_args(
        [
            str(path),
            "--validation-output",
            str(validation_output),
            "--output",
            str(output),
        ]
    )

    assert run(_run_cli(args)) == 4
    assert validation_output.exists()
    assert not output.exists()


def test_duplicate_sensitive_sample_id_is_masked_in_validation_report(tmp_path):
    path = tmp_path / "manual.csv"
    path.write_text(
        "sample_id,message_text,channel,topic,current_label,human_label,review_note,include_in_evaluation\n"
        "student@example.com,Cam on,web,other,,POS,,true\n"
        "student@example.com,Lich thi,web,toeic,,NEU,,true\n",
        encoding="utf-8",
    )

    report = validate_manual_review_csv(path)
    serialized = json.dumps(report, ensure_ascii=False)

    assert "student@example.com" not in serialized
    assert report["duplicate_sample_ids"] == ["row-3"]


def test_metrics_include_weighting_directed_errors_latency_and_confidence():
    results = [
        {"expected_label": "POS", "raw_model_label": "POS", "raw_model_score": 0.9, "success": True, "latency_ms": 100},
        {"expected_label": "NEG", "raw_model_label": "NEU", "raw_model_score": 0.8, "success": True, "latency_ms": 200},
        {"expected_label": "NEU", "raw_model_label": "POS", "raw_model_score": 0.7, "success": True, "latency_ms": 300},
        {"expected_label": "NEG", "raw_model_label": "NEG", "raw_model_score": 0.6, "success": True, "latency_ms": 400},
    ]

    metrics = calculate_metrics(results, prediction_field="raw_model_label")

    assert metrics["weighted_f1"] == 0.5
    assert metrics["negative_precision"] == 1.0
    assert metrics["directed_errors"] == {
        "NEG_TO_NEU": 1,
        "NEG_TO_POS": 0,
        "NEU_TO_NEG": 0,
        "NEU_TO_POS": 1,
        "POS_TO_NEU": 0,
        "POS_TO_NEG": 0,
    }
    assert metrics["median_latency_ms"] == 250.0
    assert metrics["average_confidence"] == 0.75
    assert metrics["correct_prediction_confidence"] == 0.75
    assert metrics["incorrect_prediction_confidence"] == 0.75


def test_domain_rules_prioritize_unresolved_problem_in_mixed_message_without_ground_truth():
    assert apply_domain_post_processing(
        "Cảm ơn nhưng tôi vẫn chưa nhận được kết quả", "POS", 0.95
    ) == ("NEG", True, "unresolved_negative_domain_phrase")
    assert apply_domain_post_processing(
        "Hệ thống từng bị lỗi nhưng nay đã được giải quyết, cảm ơn bạn", "NEG", 0.8
    ) == ("POS", True, "explicit_positive_resolution_phrase")


def test_domain_rules_reject_missing_raw_label_instead_of_fabricating_neutral():
    with pytest.raises(ValueError, match="raw_label is required"):
        apply_domain_post_processing("Cho tôi hỏi lịch thi", "", 0.0)


def test_group_metrics_require_five_samples_and_keep_modes_separate():
    results = []
    for index in range(6):
        results.append(
            {
                "expected_label": "NEG" if index < 3 else "NEU",
                "raw_model_label": "NEG" if index < 3 else "NEU",
                "final_label": "NEG" if index < 3 else "NEU",
                "success": True,
                "topic": "login",
                "channel": "web",
            }
        )
    results.append({**results[0], "topic": "toeic", "channel": "mobile"})

    grouped = calculate_group_metrics(results, minimum_samples=5)

    assert grouped["topic"]["login"]["BASELINE_RAW"]["evaluated_cases"] == 6
    assert "toeic" not in grouped["topic"]
    assert grouped["channel"]["web"]["DOMAIN_POST_PROCESSING"]["accuracy"] == 1.0
    assert "mobile" not in grouped["channel"]


def test_threshold_analysis_counts_captured_errors_and_correct_reviews():
    results = [
        {"expected_label": "POS", "raw_model_label": "POS", "raw_model_score": 0.55, "success": True},
        {"expected_label": "NEG", "raw_model_label": "NEU", "raw_model_score": 0.65, "success": True},
        {"expected_label": "NEG", "raw_model_label": "NEG", "raw_model_score": 0.90, "success": True},
        {"expected_label": "NEU", "raw_model_label": "POS", "raw_model_score": 0.96, "success": True},
    ]

    analysis = analyze_confidence_thresholds(results, prediction_field="raw_model_label")

    at_070 = next(item for item in analysis if item["threshold"] == 0.7)
    assert at_070["review_count"] == 2
    assert at_070["errors_captured"] == 1
    assert at_070["correct_cases_reviewed"] == 1
    assert at_070["auto_accepted_accuracy"] == 0.5
    assert at_070["auto_accepted_negative_recall"] == 1.0


def test_error_report_masks_pii_and_classifies_rule_corrections_and_regressions(tmp_path):
    rows = [
        {
            "sample_id": "1", "message_text": "Email a@example.com, bị lỗi", "channel": "web", "topic": "login",
            "expected_label": "NEG", "raw_model_label": "NEU", "raw_model_score": 0.7,
            "final_label": "NEG", "rule_applied": True, "rule_reason": "explicit_negative_domain_phrase",
            "review_note": "phone 0901234567",
        },
        {
            "sample_id": "2", "message_text": "Lịch thi", "channel": "web", "topic": "toeic",
            "expected_label": "NEU", "raw_model_label": "NEU", "raw_model_score": 0.9,
            "final_label": "NEG", "rule_applied": True, "rule_reason": "bad_rule", "review_note": "",
        },
    ]
    output = tmp_path / "errors.csv"

    summary = write_error_report(rows, output)

    with output.open(encoding="utf-8-sig", newline="") as handle:
        saved = list(csv.DictReader(handle))
    assert "a@example.com" not in saved[0]["masked_message_text"]
    assert "0901234567" not in saved[0]["review_note"]
    assert saved[0]["error_type"] == "NEG_TO_NEU"
    assert summary["rules_corrected"] == 1
    assert summary["rules_introduced_errors"] == 1
    assert classify_error("NEU", "POS") == "NEU_TO_POS"


def test_coverage_and_capped_selection_are_deterministic_balanced_and_diverse():
    cases = [
        EvaluationCase(str(index), f"message {label} {index}", label, channel=f"c{index % 2}", topic=f"t{index % 3}")
        for label in ("POS", "NEG", "NEU")
        for index in range(6)
    ]

    selected = select_cases_for_request_cap(cases, max_requests=9)
    repeated = select_cases_for_request_cap(cases, max_requests=9)
    coverage = analyze_coverage(selected)

    assert [item.sample_id + item.expected_label for item in selected] == [
        item.sample_id + item.expected_label for item in repeated
    ]
    assert {label: sum(item.expected_label == label for item in selected) for label in ("POS", "NEG", "NEU")} == {
        "POS": 3, "NEG": 3, "NEU": 3
    }
    assert {item.topic for item in selected} == {"t0", "t1", "t2"}
    assert coverage["label_distribution"] == {"POS": 3, "NEG": 3, "NEU": 3}
    assert coverage["channel_distribution"] == {"c0": 6, "c1": 3}
