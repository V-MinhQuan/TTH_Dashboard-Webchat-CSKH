from types import SimpleNamespace

import pytest

from scripts.pilot_hf_db_flow import (
    PilotSafetyError,
    mask_message_id,
    parse_message_ids,
    run_pilot,
    validate_pilot_safety,
)


def pilot_settings(**overrides):
    values = {
        "app_env": "staging",
        "db_name": "Dashboard_ChatBot_Staging",
        "hf_background_enabled": False,
        "hf_pilot_environment": "staging",
        "hf_pilot_backup_verified": True,
        "hf_analysis_cutover_message_id": 100,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_message_ids_are_explicit_deduplicated_and_capped_at_three():
    assert parse_message_ids(["103,101", "101", "102"], max_records=3) == [103, 101, 102]

    with pytest.raises(PilotSafetyError, match="at_most_3"):
        parse_message_ids(["1,2,3,4"], max_records=3)


def test_message_ids_reject_empty_invalid_and_non_positive_values():
    for values in ([], ["abc"], ["0"], ["-1"]):
        with pytest.raises(PilotSafetyError):
            parse_message_ids(values, max_records=3)


def test_run_pilot_cannot_bypass_the_three_record_cap():
    with pytest.raises(PilotSafetyError, match="at_most_3"):
        __import__("asyncio").run(
            run_pilot(
                pilot_settings(hf_pilot_max_records=3),
                [101, 102, 103, 104],
                dry_run=True,
            )
        )


@pytest.mark.parametrize(
    "overrides,code",
    [
        ({"hf_background_enabled": True}, "background_must_be_disabled"),
        ({"hf_pilot_environment": "production"}, "unsafe_environment"),
        ({"hf_pilot_environment": ""}, "unsafe_environment"),
        ({"hf_pilot_backup_verified": False}, "backup_not_verified"),
        ({"hf_analysis_cutover_message_id": None}, "cutover_not_configured"),
        ({"db_name": "Dashboard_ChatBot_Production"}, "production_database_name"),
    ],
)
def test_pilot_fails_closed_when_safety_preconditions_are_missing(overrides, code):
    with pytest.raises(PilotSafetyError, match=code):
        validate_pilot_safety(pilot_settings(**overrides))


def test_pilot_accepts_explicit_safe_environment_with_backup():
    validate_pilot_safety(pilot_settings())


def test_report_masks_database_message_ids():
    masked = mask_message_id(123456)
    assert masked.startswith("msg_")
    assert "123456" not in masked
