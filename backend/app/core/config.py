from pathlib import Path
from typing import List

from pydantic import AliasChoices, Field, SecretStr
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

    hf_token: SecretStr = Field(
        default=SecretStr(""),
        validation_alias="HF_TOKEN",
    )
    huggingface_api_key: SecretStr = Field(
        default=SecretStr(""),
        validation_alias="HUGGINGFACE_API_KEY",
    )
    hf_model: str = Field(
        default="wonrax/phobert-base-vietnamese-sentiment",
        validation_alias="HF_MODEL",
    )
    hf_provider: str = Field(default="hf-inference", validation_alias="HF_PROVIDER")
    hf_timeout_seconds: float = Field(
        default=15.0,
        ge=1.0,
        le=120.0,
        validation_alias="HF_TIMEOUT_SECONDS",
    )
    hf_max_retries: int = Field(default=2, ge=0, le=10, validation_alias="HF_MAX_RETRIES")
    hf_max_concurrency: int = Field(default=3, ge=1, le=20, validation_alias="HF_MAX_CONCURRENCY")
    hf_eval_max_requests: int = Field(
        default=300,
        ge=1,
        validation_alias="HF_EVAL_MAX_REQUESTS",
    )
    hf_batch_size: int = Field(default=10, ge=1, le=100, validation_alias="HF_BATCH_SIZE")
    hf_background_enabled: bool = Field(
        default=False,
        validation_alias="HF_BACKGROUND_ENABLED",
    )
    hf_analysis_cutover_message_id: int | None = Field(
        default=None,
        ge=0,
        validation_alias="HF_ANALYSIS_CUTOVER_MESSAGE_ID",
    )
    hf_pilot_max_records: int = Field(
        default=3,
        ge=1,
        le=3,
        validation_alias="HF_PILOT_MAX_RECORDS",
    )
    hf_pilot_environment: str = Field(
        default="",
        validation_alias="HF_PILOT_ENVIRONMENT",
    )
    hf_pilot_backup_verified: bool = Field(
        default=False,
        validation_alias="HF_PILOT_BACKUP_VERIFIED",
    )
    hf_background_interval_seconds: float = Field(
        default=10.0,
        ge=0.1,
        le=3600.0,
        validation_alias="HF_BACKGROUND_INTERVAL_SECONDS",
    )
    hf_processing_stale_minutes: int = Field(
        default=10,
        ge=1,
        le=1440,
        validation_alias="HF_PROCESSING_STALE_MINUTES",
    )
    hf_predict_rate_limit_per_minute: int = Field(
        default=30,
        ge=1,
        le=1000,
        validation_alias="HF_PREDICT_RATE_LIMIT_PER_MINUTE",
    )
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
    ai_analytics_sync_enabled: bool = Field(
        default=False,
        validation_alias="AI_ANALYTICS_SYNC_ENABLED",
    )
    ai_analytics_sync_interval_seconds: int = Field(
        default=1800,
        ge=300,
        le=86400,
        validation_alias="AI_ANALYTICS_SYNC_INTERVAL_SECONDS",
    )
    ai_analytics_sync_lookback_hours: int = Field(
        default=48,
        ge=1,
        le=720,
        validation_alias="AI_ANALYTICS_SYNC_LOOKBACK_HOURS",
    )
    ai_analytics_sync_startup_delay_seconds: int = Field(
        default=120,
        ge=0,
        le=3600,
        validation_alias="AI_ANALYTICS_SYNC_STARTUP_DELAY_SECONDS",
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
    def effective_hf_token(self) -> SecretStr:
        """Prefer a non-empty HF_TOKEN, then use the compatibility API key."""
        if self.hf_token.get_secret_value().strip():
            return self.hf_token
        return self.huggingface_api_key

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


