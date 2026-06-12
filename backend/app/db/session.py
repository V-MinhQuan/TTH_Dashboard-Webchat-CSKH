from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Dict, Iterable, Iterator, List, Optional

import pyodbc

from app.core.config import Settings, get_settings


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


@contextmanager
def get_connection(settings: Optional[Settings] = None) -> Iterator[pyodbc.Connection]:
    settings = settings or get_settings()
    conn = pyodbc.connect(
        build_connection_string(settings),
        timeout=settings.db_timeout_seconds,
    )
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

