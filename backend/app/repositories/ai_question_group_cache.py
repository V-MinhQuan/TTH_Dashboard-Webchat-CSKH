import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.db.session import execute_one, get_connection

logger = logging.getLogger(__name__)


class AiQuestionGroupCacheRepository:
    def __init__(self, connection_factory: Callable = get_connection):
        self._connection_factory = connection_factory

    def get(self, cache_key: str, *, allow_expired: bool = False) -> dict[str, Any] | None:
        try:
            with self._connection_factory() as conn:
                row = execute_one(
                    conn,
                    """
                    SELECT TOP 1
                        CacheKey AS cache_key,
                        Status AS status,
                        SourceFromDate AS source_from_date,
                        SourceToDate AS source_to_date,
                        SourceFiltersJson AS source_filters_json,
                        SourceRowCount AS source_row_count,
                        GeneratedAt AS generated_at,
                        ExpiresAt AS expires_at,
                        Provider AS provider,
                        Model AS model,
                        PromptVersion AS prompt_version,
                        ResultJson AS result_json,
                        ValidationJson AS validation_json,
                        ErrorMessage AS error_message,
                        UpdatedAt AS updated_at
                    FROM dbo.AiQuestionGroupCache
                    WHERE CacheKey = ? AND IsActive = 1
                    ORDER BY UpdatedAt DESC
                    """,
                    (cache_key,),
                )
        except Exception as exc:
            if _is_missing_cache_table(exc):
                logger.info("AI question group DB cache table is not available yet.")
                return None
            logger.warning("Could not read AI question group DB cache: %s", exc)
            return None

        if not row:
            return None

        expires_at = _as_utc(row.get("expires_at"))
        is_expired = bool(expires_at and expires_at <= _utcnow())
        if is_expired and not allow_expired:
            return None

        try:
            result_payload = json.loads(str(row.get("result_json") or "{}"))
            validation_payload = json.loads(str(row.get("validation_json") or "{}"))
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("AI question group DB cache contains invalid JSON: %s", exc)
            return None

        rows = result_payload.get("rows")
        if not isinstance(rows, list):
            return None

        return {
            "value": (
                rows,
                result_payload.get("status") or row.get("status") or "ok",
                result_payload.get("message") or "",
            ),
            "is_expired": is_expired,
            "validation": validation_payload,
            "provider": row.get("provider"),
            "model": row.get("model"),
            "generated_at": row.get("generated_at"),
            "expires_at": row.get("expires_at"),
            "source_row_count": row.get("source_row_count") or 0,
        }

    def upsert(
        self,
        cache_key: str,
        value: tuple[list[dict[str, Any]], str, str],
        *,
        source_from_date: str | None = None,
        source_to_date: str | None = None,
        source_filters: dict[str, Any] | None = None,
        source_row_count: int = 0,
        provider: str | None = None,
        model: str | None = None,
        prompt_version: str = "dashboard-top-questions-v1",
        validation: dict[str, Any] | None = None,
        error_message: str | None = None,
        ttl_seconds: int = 3600,
    ) -> None:
        rows, status, message = value
        if status != "ok" or not rows:
            return

        now = _utcnow()
        expires_at = now + timedelta(seconds=max(int(ttl_seconds or 0), 60))
        result_json = json.dumps(
            {"rows": rows, "status": status, "message": message},
            ensure_ascii=False,
            default=str,
        )
        validation_json = json.dumps(validation or {}, ensure_ascii=False, default=str)
        filters_json = json.dumps(source_filters or {}, ensure_ascii=False, sort_keys=True, default=str)

        try:
            with self._connection_factory() as conn:
                existing = execute_one(
                    conn,
                    "SELECT Id AS id FROM dbo.AiQuestionGroupCache WHERE CacheKey = ?",
                    (cache_key,),
                )
                cursor = conn.cursor()
                if existing:
                    cursor.execute(
                        """
                        UPDATE dbo.AiQuestionGroupCache
                        SET Status = ?,
                            SourceFromDate = ?,
                            SourceToDate = ?,
                            SourceFiltersJson = ?,
                            SourceRowCount = ?,
                            GeneratedAt = ?,
                            ExpiresAt = ?,
                            Provider = ?,
                            Model = ?,
                            PromptVersion = ?,
                            ResultJson = ?,
                            ValidationJson = ?,
                            ErrorMessage = ?,
                            UpdatedAt = SYSUTCDATETIME(),
                            IsActive = 1
                        WHERE CacheKey = ?
                        """,
                        (
                            status,
                            source_from_date,
                            source_to_date,
                            filters_json,
                            int(source_row_count or 0),
                            now,
                            expires_at,
                            provider,
                            model,
                            prompt_version,
                            result_json,
                            validation_json,
                            error_message,
                            cache_key,
                        ),
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO dbo.AiQuestionGroupCache
                            (CacheKey, Status, SourceFromDate, SourceToDate,
                             SourceFiltersJson, SourceRowCount, GeneratedAt, ExpiresAt,
                             Provider, Model, PromptVersion, ResultJson,
                             ValidationJson, ErrorMessage)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            cache_key,
                            status,
                            source_from_date,
                            source_to_date,
                            filters_json,
                            int(source_row_count or 0),
                            now,
                            expires_at,
                            provider,
                            model,
                            prompt_version,
                            result_json,
                            validation_json,
                            error_message,
                        ),
                    )
                conn.commit()
        except Exception as exc:
            if _is_missing_cache_table(exc):
                logger.info("AI question group DB cache table is not available yet.")
                return
            logger.warning("Could not write AI question group DB cache: %s", exc)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _is_missing_cache_table(exc: Exception) -> bool:
    details = " ".join(str(item) for item in getattr(exc, "args", ())) or str(exc)
    return "AiQuestionGroupCache" in details and (
        "Invalid object name" in details
        or "208" in details
    )
