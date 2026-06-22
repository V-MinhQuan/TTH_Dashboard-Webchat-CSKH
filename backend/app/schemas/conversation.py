from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, PositiveInt, field_validator, model_validator


class ConversationStatus(str, Enum):
    pending = "pending"
    open = "open"
    closed = "closed"


class ConversationSentiment(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class ConversationFilters(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    date_range: Literal[
        "all_time", "today", "last7days", "thisMonth", "thisQuarter", "custom"
    ] | None = Field(default=None, alias="dateRange")
    from_date: str | None = Field(default=None, alias="fromDate")
    to_date: str | None = Field(default=None, alias="toDate")
    start_date: str | None = Field(default=None, alias="startDate")
    end_date: str | None = Field(default=None, alias="endDate")
    channel: str | None = Field(default=None, max_length=50)
    source: str | None = Field(default=None, max_length=50)
    search: str | None = Field(default=None, max_length=100)
    status: ConversationStatus | None = None
    conversation_status: ConversationStatus | None = Field(
        default=None,
        alias="conversationStatus",
    )
    sentiment: ConversationSentiment | None = None
    topic: str | None = Field(default=None, max_length=100)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, alias="pageSize", ge=1, le=100)

    @field_validator("channel", "source", "search", "topic", mode="before")
    @classmethod
    def validate_text_filter(cls, value: Any):
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        if any(ord(character) < 32 for character in text):
            raise ValueError("Bộ lọc chứa ký tự điều khiển không hợp lệ.")
        return text

    @model_validator(mode="after")
    def validate_status_aliases(self):
        if (
            self.status is not None
            and self.conversation_status is not None
            and self.status != self.conversation_status
        ):
            raise ValueError("status và conversationStatus không được mâu thuẫn.")
        return self

    def to_repository_filters(self) -> dict[str, Any]:
        values = self.model_dump(by_alias=True, exclude_none=True, mode="json")
        if "conversationStatus" in values and "status" not in values:
            values["status"] = values["conversationStatus"]
        return values


class BulkCloseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    conversation_ids: tuple[PositiveInt, ...] = Field(
        alias="conversationIds",
        min_length=1,
        max_length=100,
    )

    @field_validator("conversation_ids")
    @classmethod
    def reject_duplicate_ids(cls, values: tuple[int, ...]):
        if len(set(values)) != len(values):
            raise ValueError("conversationIds không được chứa ID trùng lặp.")
        return values


class CloseConversationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    conversation_id: PositiveInt | None = Field(default=None, alias="conversationId")
    customer_id: str | None = Field(default=None, alias="customerId", max_length=255)
    source: str | None = Field(default=None, max_length=50)

    @field_validator("customer_id", "source", mode="before")
    @classmethod
    def normalize_scope_text(cls, value: Any):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @model_validator(mode="after")
    def require_one_explicit_scope(self):
        has_pair = self.customer_id is not None or self.source is not None
        if self.conversation_id is not None and has_pair:
            raise ValueError("Chỉ được dùng conversationId hoặc cặp customerId/source.")
        if self.conversation_id is None and not (self.customer_id and self.source):
            raise ValueError("Cần conversationId hoặc đầy đủ customerId và source.")
        return self


class ConversationListItem(BaseModel):
    id: int
    customer_id: str | None = None
    customer_name: str | None = None
    customer_reference: str | None = None
    customer_display_name: str = Field(alias="customerDisplayName")
    phone_number: str | None = Field(default=None, alias="phoneNumber")
    status: str | None = None
    source: str | None = None
