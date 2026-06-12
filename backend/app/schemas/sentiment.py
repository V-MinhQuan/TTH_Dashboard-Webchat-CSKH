from pydantic import BaseModel, Field


class SentimentPredictRequest(BaseModel):
    text: str = Field(min_length=1)

