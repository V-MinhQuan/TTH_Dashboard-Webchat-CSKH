from __future__ import annotations

from typing import Any


def identity_text(value: Any) -> str:
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        return ""
    normalized = str(value).strip()
    return "" if not normalized or normalized == "[object Object]" else normalized


def customer_display_name(
    customer_name: Any = None,
    customer_id: Any = None,
    phone_number: Any = None,
) -> str:
    return (
        identity_text(customer_name)
        or identity_text(customer_id)
        or identity_text(phone_number)
        or "Không xác định"
    )
