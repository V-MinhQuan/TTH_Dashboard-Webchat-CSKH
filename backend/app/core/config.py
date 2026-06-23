from pathlib import Path
from typing import List

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    app_name: str = Field(default="FLIC FastAPI Backend", validation_alias="APP_NAME")
    app_version: str = Field(default="fastapi-v1", validation_alias="APP_VERSION")
    app_auth_secret: str = Field(default="", validation_alias="APP_AUTH_SECRET")
    app_auth_ttl_seconds: int = Field(
        default=3600,
        ge=60,
        le=86400,
        validation_alias="APP_AUTH_TTL_SECONDS",
    )
    manager_usernames: str = Field(
        default="test,thuynt",
        validation_alias="MANAGER_USERNAMES",
    )

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
    gemini_api_keys: str = Field(
        default="",
        validation_alias="GEMINI_API_KEYS",
    )
    gemini_api_key: str = Field(default="", validation_alias="GEMINI_API_KEY")
    openai_api_keys: str = Field(
        default="",
        validation_alias="OPENAI_API_KEYS",
    )
    openai_api_key_single: str = Field(default="", validation_alias="OPENAI_API_KEY")
    ai_question_timeout_seconds: float = Field(
        default=4.0,
        ge=1.0,
        le=30.0,
        validation_alias="AI_QUESTION_TIMEOUT_SECONDS",
    )

    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="CORS_ORIGINS",
    )

    smtp_server: str = Field(default="smtp.gmail.com", validation_alias="SMTP_SERVER")
    smtp_port: int = Field(default=587, validation_alias="SMTP_PORT")
    smtp_username: str = Field(default="", validation_alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", validation_alias="SMTP_PASSWORD")
    smtp_sender: str = Field(default="", validation_alias="SMTP_SENDER")

    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(REPO_ROOT / "backend" / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_origin_list(self) -> List[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def manager_username_list(self) -> List[str]:
        return [
            username.strip().lower()
            for username in self.manager_usernames.split(",")
            if username.strip()
        ]

    @property
    def gemini_api_key_list(self) -> List[str]:
        raw_keys = self.gemini_api_keys or self.gemini_api_key
        return [
            key.strip().strip('"').strip("'")
            for key in raw_keys.split(",")
            if key.strip().strip('"').strip("'")
        ]

    @property
    def openai_api_key(self) -> str:
        keys = self.openai_api_key_list
        return keys[0] if keys else ""

    @property
    def openai_api_key_list(self) -> List[str]:
        raw_keys = self.openai_api_keys or self.openai_api_key_single
        return [
            key.strip().strip('"').strip("'")
            for key in raw_keys.split(",")
            if key.strip().strip('"').strip("'")
        ]


# Not using lru_cache so env changes are picked up without restarting the process
_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


