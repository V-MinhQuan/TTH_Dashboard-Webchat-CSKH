from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FeedbackCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    question: str = Field(min_length=1, max_length=2000)
    correct_answer: str = Field(alias="correctAnswer", min_length=1, max_length=5000)
    topic: str = Field(default="Chưa xác định", min_length=1, max_length=255)
    source: str = Field(default="Nhân viên đề xuất", min_length=1, max_length=255)
    risk: str = Field(default="Thấp", min_length=1, max_length=50)
    status: str = Field(default="Chờ xử lý", min_length=1, max_length=50)
    notes: str = Field(default="", max_length=5000)

    @field_validator("question", "correct_answer", "topic", "source", "risk", "status", "notes", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> str:
        return str(value or "").strip()


class FeedbackUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    question: str | None = Field(default=None, min_length=1, max_length=2000)
    correct_answer: str | None = Field(default=None, alias="correctAnswer", min_length=1, max_length=5000)
    topic: str | None = Field(default=None, min_length=1, max_length=255)
    source: str | None = Field(default=None, min_length=1, max_length=255)
    risk: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = Field(default=None, min_length=1, max_length=50)
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("question", "correct_answer", "topic", "source", "risk", "status", "notes", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> str | None:
        return None if value is None else str(value).strip()


class FeedbackStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(min_length=1, max_length=50)
    notes: str | None = Field(default=None, max_length=5000)


class FeedbackMergeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reviewer: str | None = Field(default=None, max_length=255)

