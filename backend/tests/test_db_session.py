import sys
import logging
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pyodbc

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.health import check_database_health
from app.db.session import (
    _connect_with_pymssql,
    _connect_with_pyodbc,
    execute_all,
    execute_one,
    get_connection,
)


class FakeCursor:
    def __init__(self):
        self.timeout = None
        self.description = [("value",)]
        self.executed = None

    def execute(self, query, params):
        self.executed = (query, params)

    def fetchone(self):
        return (1,)

    def fetchall(self):
        return [(1,)]


class FakeConnection:
    def __init__(self):
        self.last_cursor = None

    def cursor(self):
        self.last_cursor = FakeCursor()
        return self.last_cursor


def test_execute_one_uses_minimum_query_timeout():
    conn = FakeConnection()
    with patch("app.db.session.get_settings", return_value=SimpleNamespace(db_timeout_seconds=5)):
        assert execute_one(conn, "SELECT ?", [1]) == {"value": 1}

    assert conn.last_cursor.timeout == 30


def test_execute_all_uses_configured_query_timeout_when_higher():
    conn = FakeConnection()
    with patch("app.db.session.get_settings", return_value=SimpleNamespace(db_timeout_seconds=45)):
        assert execute_all(conn, "SELECT ?", [1]) == [{"value": 1}]

    assert conn.last_cursor.timeout == 45


def test_pyodbc_connection_uses_short_login_timeout_and_longer_query_timeout():
    fake_conn = SimpleNamespace(timeout=None)
    settings = SimpleNamespace(
        db_driver="ODBC Driver 17 for SQL Server",
        db_server="localhost",
        db_port=1433,
        db_name="db",
        db_user="user",
        db_password="pw",
        db_encrypt=False,
        db_trust_server_certificate=True,
        db_timeout_seconds=5,
    )

    with patch("app.db.session.pyodbc.connect", return_value=fake_conn) as connect:
        assert _connect_with_pyodbc(settings) is fake_conn

    assert connect.call_args.kwargs["timeout"] == 5
    assert fake_conn.timeout == 30


def test_pymssql_connection_uses_short_login_timeout_and_longer_query_timeout():
    fake_raw_conn = object()
    settings = SimpleNamespace(
        db_server="localhost",
        db_user="user",
        db_password="pw",
        db_name="db",
        db_port=1433,
        db_timeout_seconds=5,
    )

    with patch("app.db.session.pymssql.connect", return_value=fake_raw_conn) as connect:
        wrapped = _connect_with_pymssql(settings)

    assert wrapped._connection is fake_raw_conn
    assert connect.call_args.kwargs["timeout"] == 30
    assert connect.call_args.kwargs["login_timeout"] == 5


def test_pyodbc_fallback_log_redacts_driver_error_details(caplog):
    secret = "password=do-not-log"
    fallback = SimpleNamespace(close=lambda: None)

    with (
        patch("app.db.session._connect_with_pyodbc", side_effect=pyodbc.Error(secret)),
        patch("app.db.session._connect_with_pymssql", return_value=fallback),
        caplog.at_level(logging.WARNING),
    ):
        with get_connection(SimpleNamespace()):
            pass

    assert secret not in caplog.text


def test_database_health_log_redacts_query_error_details(caplog):
    secret = "password=do-not-log"

    with (
        patch("app.db.health.get_connection", side_effect=RuntimeError(secret)),
        caplog.at_level(logging.WARNING),
    ):
        result = check_database_health()

    assert result == {"status": "disconnected", "error": "database_unavailable"}
    assert secret not in caplog.text
