from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnalyticsMetadata(BaseModel):
    issueMetadataAvailable: bool


class ChartAxis(str, Enum):
    date = "date"
    month = "month"
    channel = "channel"
    status = "status"
    topic = "topic"
    sentiment = "sentiment"


class ChartMetric(str, Enum):
    total_conversations = "total_conversations"
    total_messages = "total_messages"
    sentiment_count = "sentiment_count"
    positive_count = "positive_count"
    neutral_count = "neutral_count"
    negative_count = "negative_count"


class ChartType(str, Enum):
    bar = "bar"
    line = "line"
    area = "area"
    pie = "pie"
    donut = "donut"
    hbar = "hbar"


class CustomChartFilters(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_date: Optional[date] = Field(default=None, alias="fromDate")
    to_date: Optional[date] = Field(default=None, alias="toDate")
    channel: Optional[str] = Field(default=None, max_length=50)
    status: Optional[str] = Field(default=None, max_length=30)
    sentiment: Optional[str] = Field(default=None, max_length=20)
    topic: Optional[str] = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.from_date and self.to_date and self.from_date > self.to_date:
            raise ValueError("fromDate must be before or equal to toDate")
        return self


class CustomChartRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    x_axis: ChartAxis = Field(alias="xAxis")
    y_axis: ChartMetric = Field(alias="yAxis")
    chart_type: ChartType = Field(default=ChartType.bar, alias="chartType")
    filters: CustomChartFilters = Field(default_factory=CustomChartFilters)

