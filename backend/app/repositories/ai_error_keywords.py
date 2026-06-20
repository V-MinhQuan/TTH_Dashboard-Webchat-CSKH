from __future__ import annotations

from typing import Any, Callable
from uuid import UUID

import pyodbc

from app.db.session import execute_all, execute_one, get_connection
from app.schemas.ai_error_keywords import (
    AiErrorGroup,
    AiErrorKeywordCreate,
    AiErrorKeywordStatus,
)


_SELECT_COLUMNS = """
    Id AS id,
    Keyword AS keyword,
    ErrorGroup AS error_group,
    Topic AS topic,
    CareHub AS care_hub,
    Description AS description,
    Status AS status,
    CreatedBy AS creator,
    CreatedAt AS created_at,
    UpdatedAt AS updated_at
"""

_OUTPUT_COLUMNS = """
    INSERTED.Id AS id,
    INSERTED.Keyword AS keyword,
    INSERTED.ErrorGroup AS error_group,
    INSERTED.Topic AS topic,
    INSERTED.CareHub AS care_hub,
    INSERTED.Description AS description,
    INSERTED.Status AS status,
    INSERTED.CreatedBy AS creator,
    INSERTED.CreatedAt AS created_at,
    INSERTED.UpdatedAt AS updated_at
"""


class DuplicateAiErrorKeywordRecordError(RuntimeError):
    pass


def _is_unique_keyword_violation(exc: pyodbc.IntegrityError) -> bool:
    details = " ".join(str(item) for item in exc.args)
    return any(
        marker in details
        for marker in (
            "2601",
            "2627",
            "UX_AiErrorKeywords_KeywordNormalized",
        )
    )


def _build_filter_clause(
    *,
    status: AiErrorKeywordStatus | None,
    error_group: AiErrorGroup | None,
    topic: str | None,
    care_hub: str | None,
) -> tuple[str, tuple[Any, ...]]:
    filters = tuple(
        (column, value)
        for column, value in (
            ("Status", status.value if status else None),
            ("ErrorGroup", error_group.value if error_group else None),
            ("Topic", topic),
            ("CareHub", care_hub),
        )
        if value is not None
    )
    where_clause = (
        f"WHERE {' AND '.join(f'{column} = ?' for column, _ in filters)}"
        if filters
        else ""
    )
    return where_clause, tuple(value for _, value in filters)


class AiErrorKeywordRepository:
    def __init__(self, connection_factory: Callable = get_connection):
        self._connection_factory = connection_factory

    def list(
        self,
        *,
        status: AiErrorKeywordStatus | None = None,
        error_group: AiErrorGroup | None = None,
        topic: str | None = None,
        care_hub: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        where_clause, filter_params = _build_filter_clause(
            status=status,
            error_group=error_group,
            topic=topic,
            care_hub=care_hub,
        )
        params = (*filter_params, offset, limit)
        query = f"""
            SELECT {_SELECT_COLUMNS}
            FROM dbo.AiErrorKeywords
            {where_clause}
            ORDER BY UpdatedAt DESC, Id
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """
        with self._connection_factory() as conn:
            return execute_all(conn, query, params)

    def count(
        self,
        *,
        status: AiErrorKeywordStatus | None = None,
        error_group: AiErrorGroup | None = None,
        topic: str | None = None,
        care_hub: str | None = None,
    ) -> int:
        where_clause, params = _build_filter_clause(
            status=status,
            error_group=error_group,
            topic=topic,
            care_hub=care_hub,
        )
        with self._connection_factory() as conn:
            row = execute_one(
                conn,
                f"SELECT COUNT_BIG(*) AS total FROM dbo.AiErrorKeywords {where_clause}",
                params,
            )
        return int(row.get("total") or 0)

    def get_by_id(self, keyword_id: UUID) -> dict[str, Any]:
        with self._connection_factory() as conn:
            return execute_one(
                conn,
                f"SELECT {_SELECT_COLUMNS} FROM dbo.AiErrorKeywords WHERE Id = ?",
                (keyword_id,),
            )

    def find_by_normalized_keyword(
        self,
        normalized_keyword: str,
        *,
        exclude_id: UUID | None = None,
    ) -> dict[str, Any]:
        exclusion = " AND Id <> ?" if exclude_id else ""
        params: tuple[Any, ...] = (
            (normalized_keyword, exclude_id)
            if exclude_id
            else (normalized_keyword,)
        )
        with self._connection_factory() as conn:
            return execute_one(
                conn,
                f"""
                    SELECT {_SELECT_COLUMNS}
                    FROM dbo.AiErrorKeywords
                    WHERE KeywordNormalized = ?{exclusion}
                """,
                params,
            )

    def create(
        self,
        payload: AiErrorKeywordCreate,
        *,
        normalized_keyword: str,
        creator: str,
    ) -> dict[str, Any]:
        try:
            with self._connection_factory() as conn:
                row = execute_one(
                    conn,
                    f"""
                        INSERT INTO dbo.AiErrorKeywords
                            (Keyword, KeywordNormalized, ErrorGroup, Topic, CareHub,
                             Description, Status, CreatedBy)
                        OUTPUT {_OUTPUT_COLUMNS}
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        payload.keyword,
                        normalized_keyword,
                        payload.error_group.value,
                        payload.topic,
                        payload.care_hub,
                        payload.description,
                        payload.status.value,
                        creator,
                    ),
                )
                conn.commit()
                return row
        except pyodbc.IntegrityError as exc:
            if _is_unique_keyword_violation(exc):
                raise DuplicateAiErrorKeywordRecordError from exc
            raise

    def update(
        self,
        keyword_id: UUID,
        payload: AiErrorKeywordCreate,
        *,
        normalized_keyword: str,
    ) -> dict[str, Any]:
        try:
            with self._connection_factory() as conn:
                row = execute_one(
                    conn,
                    f"""
                        UPDATE dbo.AiErrorKeywords
                        SET Keyword = ?,
                            KeywordNormalized = ?,
                            ErrorGroup = ?,
                            Topic = ?,
                            CareHub = ?,
                            Description = ?,
                            Status = ?,
                            UpdatedAt = SYSUTCDATETIME()
                        OUTPUT {_OUTPUT_COLUMNS}
                        WHERE Id = ?
                    """,
                    (
                        payload.keyword,
                        normalized_keyword,
                        payload.error_group.value,
                        payload.topic,
                        payload.care_hub,
                        payload.description,
                        payload.status.value,
                        keyword_id,
                    ),
                )
                conn.commit()
                return row
        except pyodbc.IntegrityError as exc:
            if _is_unique_keyword_violation(exc):
                raise DuplicateAiErrorKeywordRecordError from exc
            raise
