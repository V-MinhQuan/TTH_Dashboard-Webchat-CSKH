from __future__ import annotations

import html
import re
import unicodedata
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


_WHITESPACE_PATTERN = re.compile(r"\s+")
_UNSAFE_PATTERNS = (
    re.compile(r"<\s*/?\s*[a-z][^>]*>", re.IGNORECASE),
    re.compile(r"\bon[a-z]+\s*=", re.IGNORECASE),
    re.compile(r"\b(?:javascript|vbscript)\s*:", re.IGNORECASE),
    re.compile(r"\bdata\s*:\s*text/html", re.IGNORECASE),
)


class AiErrorGroup(str, Enum):
    HALLUCINATION_RISK = "AI có nguy cơ tự tạo thông tin"
    UNCERTAIN = "AI không chắc chắn"
    DATA_NOT_FOUND = "Không tìm thấy dữ liệu"
    OUT_OF_SCOPE = "Câu hỏi ngoài phạm vi"


class AiErrorKeywordStatus(str, Enum):
    active = "active"
    inactive = "inactive"


def normalize_safe_text(value: Any, *, field_name: str) -> str:
    text = unicodedata.normalize("NFC", str(value or ""))
    text = _WHITESPACE_PATTERN.sub(" ", text).strip()
    decoded = html.unescape(text)
    has_control_character = any(
        unicodedata.category(character).startswith("C")
        for character in decoded
    )
    if has_control_character or any(
        pattern.search(decoded) for pattern in _UNSAFE_PATTERNS
    ):
        raise ValueError(
            f"{field_name} chứa HTML hoặc nội dung không an toàn"
        )
    return text


def normalized_keyword_key(value: str) -> str:
    normalized = normalize_safe_text(value, field_name="keyword").casefold()
    return unicodedata.normalize("NFC", normalized)


class _AiErrorKeywordPayload(BaseModel):
    keyword: str = Field(min_length=1, max_length=200)
    error_group: AiErrorGroup
    topic: str | None = Field(default=None, min_length=1, max_length=100)
    care_hub: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    status: AiErrorKeywordStatus = AiErrorKeywordStatus.active

    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        use_enum_values=False,
    )

    @field_validator("keyword", mode="before")
    @classmethod
    def normalize_keyword(cls, value: Any) -> str:
        return normalize_safe_text(value, field_name="keyword")

    @field_validator("topic", "care_hub", "description", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Any, info):
        if value is None:
            return None
        return normalize_safe_text(value, field_name=info.field_name)

    @field_validator("error_group", "status", mode="before")
    @classmethod
    def normalize_enum_text(cls, value: Any):
        if isinstance(value, Enum):
            return value
        return normalize_safe_text(value, field_name="taxonomy")

    @model_validator(mode="after")
    def validate_taxonomy_target(self):
        if (self.topic is None) == (self.care_hub is None):
            raise ValueError("Phải cung cấp đúng một trong hai trường topic hoặc care_hub")
        return self


class AiErrorKeywordCreate(_AiErrorKeywordPayload):
    pass


class AiErrorKeywordUpdate(BaseModel):
    keyword: str | None = Field(default=None, min_length=1, max_length=200)
    error_group: AiErrorGroup | None = None
    topic: str | None = Field(default=None, min_length=1, max_length=100)
    care_hub: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    status: AiErrorKeywordStatus | None = None

    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        use_enum_values=False,
    )

    @field_validator("keyword", mode="before")
    @classmethod
    def normalize_keyword(cls, value: Any):
        if value is None:
            return None
        return normalize_safe_text(value, field_name="keyword")

    @field_validator("topic", "care_hub", "description", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Any, info):
        if value is None:
            return None
        return normalize_safe_text(value, field_name=info.field_name)

    @field_validator("error_group", "status", mode="before")
    @classmethod
    def normalize_enum_text(cls, value: Any):
        if value is None or isinstance(value, Enum):
            return value
        return normalize_safe_text(value, field_name="taxonomy")

    @model_validator(mode="after")
    def validate_update(self):
        if not self.model_fields_set:
            raise ValueError("Phải cung cấp ít nhất một trường cần cập nhật")
        if self.topic is not None and self.care_hub is not None:
            raise ValueError("Chỉ được cung cấp một trong hai trường topic hoặc care_hub")
        return self


class AiErrorKeywordRead(_AiErrorKeywordPayload):
    id: UUID
    creator: str = Field(min_length=1, max_length=100)
    created_at: datetime
    updated_at: datetime

    @field_validator("creator", mode="before")
    @classmethod
    def normalize_creator(cls, value: Any) -> str:
        return normalize_safe_text(value, field_name="creator")


class AiErrorKeywordList(BaseModel):
    items: tuple[AiErrorKeywordRead, ...]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)

    model_config = ConfigDict(extra="forbid", frozen=True)
