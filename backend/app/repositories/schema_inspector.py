from __future__ import annotations

from typing import Dict

from app.db.session import execute_one


OPTIONAL_ANALYTICS_COLUMNS = (
    "analyzerVersion",
    "sentimentSource",
    "issueFlag",
    "issueType",
    "issueReason",
    "issueConfidence",
    "standardizedQuestion",
)


def inspect_message_analytics_columns(conn) -> Dict[str, bool]:
    select_parts = [
        f"COL_LENGTH('dbo.WebChat_MessageAnalytics', '{column}') AS {column}Len"
        for column in OPTIONAL_ANALYTICS_COLUMNS
    ]
    row = execute_one(conn, "SELECT " + ", ".join(select_parts))
    return {
        column: row.get(f"{column}Len") is not None
        for column in OPTIONAL_ANALYTICS_COLUMNS
    }


def issue_metadata_available(columns: Dict[str, bool]) -> bool:
    return all(
        columns.get(column, False)
        for column in ("issueFlag", "issueType", "issueReason", "issueConfidence")
    )

