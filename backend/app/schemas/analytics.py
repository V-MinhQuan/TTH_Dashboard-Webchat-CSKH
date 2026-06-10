from pydantic import BaseModel


class AnalyticsMetadata(BaseModel):
    issueMetadataAvailable: bool

