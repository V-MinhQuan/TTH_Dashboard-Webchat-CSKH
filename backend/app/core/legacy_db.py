from __future__ import annotations

import logging

import pymssql

from app.core.config import get_settings


logger = logging.getLogger(__name__)


def get_db_connection():
    """Create a legacy-compatible pymssql connection from central settings."""
    settings = get_settings()
    try:
        return pymssql.connect(
            server=settings.db_server,
            user=settings.db_user,
            password=settings.db_password,
            database=settings.db_name,
            port=settings.db_port,
            tds_version="7.0",
            timeout=settings.db_timeout_seconds,
            login_timeout=settings.db_timeout_seconds,
        )
    except Exception as exc:
        logger.error(
            "Legacy database connection failed error_type=%s",
            type(exc).__name__,
        )
        raise RuntimeError("Database connection failed") from None
