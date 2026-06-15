from functools import lru_cache
from typing import List

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    app_name: str = Field(default="FLIC FastAPI Backend", validation_alias="APP_NAME")
    app_version: str = Field(default="fastapi-v1", validation_alias="APP_VERSION")

    db_server: str = Field(default="localhost", validation_alias="DB_SERVER")
    db_port: int = Field(default=1433, validation_alias="DB_PORT")
    db_name: str = Field(default="", validation_alias=AliasChoices("DB_NAME", "DB_DATABASE"))
    db_user: str = Field(default="", validation_alias="DB_USER")
    db_password: str = Field(default="", validation_alias="DB_PASSWORD")
    db_driver: str = Field(default="ODBC Driver 17 for SQL Server", validation_alias="DB_DRIVER")
    db_encrypt: bool = Field(default=False, validation_alias="DB_ENCRYPT")
    db_trust_server_certificate: bool = Field(
        default=True,
        validation_alias="DB_TRUST_SERVER_CERTIFICATE",
    )
    db_timeout_seconds: int = Field(default=5, validation_alias="DB_TIMEOUT_SECONDS")
    chart_query_timeout_seconds: int = Field(
        default=15,
        ge=1,
        le=120,
        validation_alias="CHART_QUERY_TIMEOUT_SECONDS",
    )

    ml_service_url: str = Field(default="http://localhost:8001", validation_alias="ML_SERVICE_URL")
    ml_timeout_seconds: float = Field(default=15.0, validation_alias="ML_TIMEOUT_SECONDS")

    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_origin_list(self) -> List[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

