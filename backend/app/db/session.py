from __future__ import annotations

from contextlib import contextmanager
import logging
from typing import Any, Dict, Iterable, Iterator, List, Optional

import pymssql
import pyodbc

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)
_prefer_pymssql = False


class _PymssqlCursor:
    """Small adapter so pymssql can run queries written with pyodbc '?' params."""

    def __init__(self, cursor: Any):
        self._cursor = cursor

    @staticmethod
    def _query(query: str) -> str:
        return query.replace("%", "%%").replace("?", "%s")

    def execute(self, query: str, params: Iterable[Any] = ()) -> Any:
        return self._cursor.execute(self._query(query), tuple(params))

    def executemany(self, query: str, params: Iterable[Iterable[Any]]) -> Any:
        return self._cursor.executemany(self._query(query), params)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._cursor, name)


class _PymssqlConnection:
    """Connection adapter matching the pyodbc surface used by repositories."""

    def __init__(self, connection: Any):
        self._connection = connection

    def cursor(self) -> _PymssqlCursor:
        return _PymssqlCursor(self._connection.cursor())

    def __getattr__(self, name: str) -> Any:
        return getattr(self._connection, name)


def build_connection_string(settings: Optional[Settings] = None) -> str:
    settings = settings or get_settings()
    encrypt = "yes" if settings.db_encrypt else "no"
    trust_cert = "yes" if settings.db_trust_server_certificate else "no"
    return ";".join(
        [
            f"DRIVER={{{settings.db_driver}}}",
            f"SERVER={settings.db_server},{settings.db_port}",
            f"DATABASE={settings.db_name}",
            f"UID={settings.db_user}",
            f"PWD={settings.db_password}",
            f"Encrypt={encrypt}",
            f"TrustServerCertificate={trust_cert}",
            "Connection Timeout=5",
        ]
    )


def _connect_with_pymssql(settings: Settings) -> _PymssqlConnection:
    conn = pymssql.connect(
        server=settings.db_server,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        port=settings.db_port,
        tds_version="7.0",
        timeout=max(settings.db_timeout_seconds, 5),
        login_timeout=max(settings.db_timeout_seconds, 5),
    )
    return _PymssqlConnection(conn)


def _connect_with_pyodbc(settings: Settings) -> Any:
    return pyodbc.connect(
        build_connection_string(settings),
        timeout=settings.db_timeout_seconds,
    )


@contextmanager
def get_connection(settings: Optional[Settings] = None) -> Iterator[Any]:
    global _prefer_pymssql
    settings = settings or get_settings()
    if _prefer_pymssql:
        conn = _connect_with_pymssql(settings)
    else:
        try:
            conn = _connect_with_pyodbc(settings)
        except pyodbc.Error as exc:
            logger.warning("pyodbc connection failed, falling back to pymssql: %s", exc)
            _prefer_pymssql = True
            conn = _connect_with_pymssql(settings)
    try:
        yield conn
    finally:
        conn.close()


def rows_to_dicts(cursor: pyodbc.Cursor) -> List[Dict[str, Any]]:
    columns = [column[0] for column in cursor.description or []]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def execute_all(conn: pyodbc.Connection, query: str, params: Iterable[Any] = ()) -> List[Dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute(query, tuple(params))
    return rows_to_dicts(cursor)


def execute_one(conn: pyodbc.Connection, query: str, params: Iterable[Any] = ()) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute(query, tuple(params))
    row = cursor.fetchone()
    if row is None:
        return {}
    columns = [column[0] for column in cursor.description or []]
    return dict(zip(columns, row))

