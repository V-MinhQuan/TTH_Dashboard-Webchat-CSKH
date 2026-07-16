from types import SimpleNamespace

import pytest

from app.core import legacy_db


def db_settings(password="db-password"):
    return SimpleNamespace(
        db_server="sql.internal",
        db_port=1433,
        db_name="flic",
        db_user="flic_user",
        db_password=password,
        db_timeout_seconds=7,
    )


def test_legacy_db_uses_centralized_settings(monkeypatch):
    configured = db_settings()
    sentinel = object()
    calls = []

    monkeypatch.setattr(legacy_db, "get_settings", lambda: configured)

    def fake_connect(**kwargs):
        calls.append(kwargs)
        return sentinel

    monkeypatch.setattr(legacy_db.pymssql, "connect", fake_connect)

    assert legacy_db.get_db_connection() is sentinel
    assert calls == [
        {
            "server": "sql.internal",
            "user": "flic_user",
            "password": "db-password",
            "database": "flic",
            "port": 1433,
            "tds_version": "7.0",
            "timeout": 7,
            "login_timeout": 7,
        }
    ]


def test_legacy_db_redacts_driver_error_secrets(monkeypatch, capsys):
    secret = "do-not-leak-this-password"
    configured = db_settings(password=secret)
    monkeypatch.setattr(legacy_db, "get_settings", lambda: configured)

    def fail_connect(**_kwargs):
        raise RuntimeError(f"login failed password={secret}")

    monkeypatch.setattr(legacy_db.pymssql, "connect", fail_connect)

    with pytest.raises(RuntimeError, match="Database connection failed") as caught:
        legacy_db.get_db_connection()

    output = capsys.readouterr()
    exposed = "\n".join((str(caught.value), output.out, output.err))
    assert secret not in exposed
    assert "password=" not in exposed.lower()
