from app.repositories.schema_inspector import issue_metadata_available


def test_issue_metadata_available_false_when_any_column_missing():
    assert issue_metadata_available(
        {"issueFlag": True, "issueType": True, "issueReason": False, "issueConfidence": True}
    ) is False


def test_issue_metadata_available_true_when_all_columns_present():
    assert issue_metadata_available(
        {"issueFlag": True, "issueType": True, "issueReason": True, "issueConfidence": True}
    ) is True

