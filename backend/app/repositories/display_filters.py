from __future__ import annotations


PLACEHOLDER_VALUES_SQL = (
    "(N'', N'unknown', N'Unknown', N'UNKNOWN', "
    "N'missing', N'Missing', N'MISSING', "
    "N'null', N'Null', N'NULL', "
    "N'none', N'None', N'NONE', "
    "N'n/a', N'N/A', N'na', N'NA', "
    "N'không xác định', N'Không xác định', N'KHÔNG XÁC ĐỊNH', "
    "N'khong xac dinh', N'Khong xac dinh', N'KHONG XAC DINH')"
)


def non_placeholder_text_condition(expression: str) -> str:
    return f"({expression} IS NOT NULL AND {expression} NOT IN {PLACEHOLDER_VALUES_SQL})"


def message_customer_expr(alias: str = "m") -> str:
    return f"CASE WHEN {alias}.FromHost = 1 THEN {alias}.ReceiverId ELSE {alias}.SenderId END"


def valid_message_condition(alias: str = "m") -> str:
    return " AND ".join(
        [
            non_placeholder_text_condition(f"{alias}.Source"),
            non_placeholder_text_condition(message_customer_expr(alias)),
        ]
    )


def valid_conversation_condition(alias: str = "c") -> str:
    return " AND ".join(
        [
            non_placeholder_text_condition(f"{alias}.CustomerId"),
            non_placeholder_text_condition(f"{alias}.Source"),
        ]
    )


def valid_conversation_status_condition(alias: str = "s") -> str:
    return " AND ".join(
        [
            non_placeholder_text_condition(f"{alias}.CustomerId"),
            non_placeholder_text_condition(f"{alias}.Source"),
        ]
    )


def valid_user_info_condition(alias: str = "u") -> str:
    return " AND ".join(
        [
            non_placeholder_text_condition(f"{alias}.SenderId"),
            non_placeholder_text_condition(f"{alias}.Source"),
        ]
    )


def valid_analytics_condition(alias: str = "a") -> str:
    return " AND ".join(
        [
            non_placeholder_text_condition(f"{alias}.customerId"),
            non_placeholder_text_condition(f"{alias}.source"),
        ]
    )


def conversation_status_case(conversation_alias: str = "c", status_alias: str = "s") -> str:
    return f"""
        CASE
          WHEN {status_alias}.NoResponseNeeded = 1
           AND ({status_alias}.MarkedAt IS NULL OR {conversation_alias}.LastCustomerMessageAt <= {status_alias}.MarkedAt)
            THEN 'closed'
          WHEN {conversation_alias}.LastHostMessageAt IS NULL
            OR {conversation_alias}.LastCustomerMessageAt > {conversation_alias}.LastHostMessageAt
            THEN 'pending'
          ELSE 'open'
        END
    """
