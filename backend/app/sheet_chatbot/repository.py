import json
import os
import re
from copy import deepcopy
from datetime import datetime


DATA_FILE_PATH = os.getenv(
    "SHEET_CHATBOT_JSON_FILE",
    os.path.join(os.path.dirname(__file__), "../data/sheet_chatbot.json"),
)
STORAGE_MODE = os.getenv("SHEET_CHATBOT_STORAGE", "auto").lower()
SQL_TABLE_NAME = os.getenv("SHEET_CHATBOT_TABLE", "dbo.WebChat_SheetChatbot")

DEFAULT_ROWS = []


class SheetChatbotRepository:
    def __init__(self, file_path=None):
        self.file_path = file_path or DATA_FILE_PATH
        self.storage_mode = STORAGE_MODE
        self.table_object_name, self.table_sql_name = self._normalize_table_name(SQL_TABLE_NAME)
        self._sql_available = None

    def get_all(self):
        if self._should_use_sql():
            try:
                self._ensure_sql_table()
                return self._get_all_sql()
            except Exception as exc:
                raise Exception("Không thể kết nối được cơ sở dữ liệu: " + str(exc))

        return self._get_all_json()

    def save_all(self, rows):
        if self._should_use_sql():
            try:
                self._ensure_sql_table()
                self._save_all_sql(rows)
                return
            except Exception as exc:
                raise Exception("Không thể kết nối được cơ sở dữ liệu: " + str(exc))

        self._save_all_json(rows)

    def now_iso(self):
        return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    def _get_all_json(self):
        self._ensure_json_file()
        try:
            with open(self.file_path, "r", encoding="utf-8-sig") as f:
                content = f.read().strip()
                return json.loads(content) if content else []
        except Exception as exc:
            print("Error reading sheet_chatbot.json:", exc)
            return []

    def _save_all_json(self, rows):
        dir_name = os.path.dirname(self.file_path)
        os.makedirs(dir_name, exist_ok=True)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)

    def _ensure_json_file(self):
        if os.path.exists(self.file_path):
            return
        dir_name = os.path.dirname(self.file_path)
        os.makedirs(dir_name, exist_ok=True)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(deepcopy(DEFAULT_ROWS), f, ensure_ascii=False, indent=2)

    def _should_use_sql(self):
        if self.storage_mode == "json":
            return False
        if self._sql_available is False and self.storage_mode != "sql":
            return False
        if self.storage_mode == "sql":
            return True
        if os.getenv("SHEET_CHATBOT_JSON_FILE"):
            return False
        return all([
            os.getenv("DB_USER"),
            os.getenv("DB_PASSWORD"),
            os.getenv("DB_DATABASE") or os.getenv("DB_NAME"),
        ])

    def _ensure_sql_table(self):
        if self._sql_available is True:
            return

        conn = self._get_db_connection()
        try:
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(f"""
                    IF OBJECT_ID(N'{self.table_object_name}', N'U') IS NULL
                    BEGIN
                        CREATE TABLE {self.table_sql_name} (
                            Id NVARCHAR(32) NOT NULL PRIMARY KEY,
                            AddedAt DATETIME2 NOT NULL,
                            AddedBy NVARCHAR(255) NOT NULL,
                            Question NVARCHAR(MAX) NOT NULL,
                            CorrectAnswer NVARCHAR(MAX) NOT NULL,
                            Topic NVARCHAR(255) NULL,
                            Source NVARCHAR(255) NULL,
                            Risk NVARCHAR(50) NULL,
                            Status NVARCHAR(100) NULL,
                            Notes NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL,
                            UpdatedAt DATETIME2 NOT NULL,
                            ReviewedAt DATETIME2 NULL,
                            ReviewedBy NVARCHAR(255) NULL
                        )
                    END
                """)
            conn.commit()
            self._sql_available = True
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _get_all_sql(self):
        conn = self._get_db_connection()
        try:
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(f"""
                    SELECT
                        Id AS id,
                        AddedAt AS addedAt,
                        AddedBy AS addedBy,
                        Question AS question,
                        CorrectAnswer AS correctAnswer,
                        Topic AS topic,
                        Source AS source,
                        Risk AS risk,
                        Status AS status,
                        Notes AS notes,
                        CreatedAt AS createdAt,
                        UpdatedAt AS updatedAt,
                        ReviewedAt AS reviewedAt,
                        ReviewedBy AS reviewedBy
                    FROM {self.table_sql_name}
                """)
                return [self._row_from_sql(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def _save_all_sql(self, rows):
        conn = self._get_db_connection()
        try:
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(f"DELETE FROM {self.table_sql_name}")
                for row in rows:
                    self._insert_sql_row(cursor, row)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _insert_sql_row(self, cursor, row):
        now = self.now_iso()
        cursor.execute(
            f"""
            INSERT INTO {self.table_sql_name}
                (Id, AddedAt, AddedBy, Question, CorrectAnswer, Topic, Source, Risk, Status, Notes, CreatedAt, UpdatedAt, ReviewedAt, ReviewedBy)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                row.get("id"),
                self._parse_datetime(row.get("addedAt") or row.get("createdAt") or now),
                row.get("addedBy") or "Admin FLIC",
                row.get("question") or "",
                row.get("correctAnswer") or "",
                row.get("topic") or "Khác",
                row.get("source") or "Nhân viên đề xuất",
                row.get("risk") or "Thấp",
                row.get("status") or "Chờ xử lý",
                row.get("notes") or "",
                self._parse_datetime(row.get("createdAt") or row.get("addedAt") or now),
                self._parse_datetime(row.get("updatedAt") or now),
                self._parse_datetime(row.get("reviewedAt")) if row.get("reviewedAt") else None,
                row.get("reviewedBy"),
            ),
        )

    def _row_from_sql(self, row):
        parsed = dict(row)
        for key in ("addedAt", "createdAt", "updatedAt", "reviewedAt"):
            if parsed.get(key):
                parsed[key] = self._datetime_to_iso(parsed[key])
        parsed["notes"] = parsed.get("notes") or ""
        return parsed

    def _get_db_connection(self):
        from app.core.legacy_db import get_db_connection

        return get_db_connection()

    def _parse_datetime(self, value):
        if isinstance(value, datetime):
            return value.replace(tzinfo=None)
        try:
            return datetime.fromisoformat(self._normalize_datetime_string(value).replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return datetime.utcnow().replace(microsecond=0)

    def _datetime_to_iso(self, value):
        if isinstance(value, datetime):
            return value.replace(microsecond=0).isoformat() + "Z"
        try:
            parsed = datetime.fromisoformat(self._normalize_datetime_string(value).replace("Z", "+00:00")).replace(tzinfo=None)
            return parsed.replace(microsecond=0).isoformat() + "Z"
        except Exception:
            return str(value)

    def _normalize_datetime_string(self, value):
        raw = str(value).strip().replace(" ", "T", 1)
        if "." not in raw:
            return raw

        head, tail = raw.split(".", 1)
        match = re.match(r"^(\d+)(.*)$", tail)
        if not match:
            return raw

        fraction = match.group(1)[:6]
        suffix = match.group(2)
        return f"{head}.{fraction}{suffix}"

    def _normalize_table_name(self, value):
        parts = str(value or "dbo.WebChat_SheetChatbot").split(".")
        if not 1 <= len(parts) <= 2:
            parts = ["dbo", "WebChat_SheetChatbot"]
        if not all(re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", part) for part in parts):
            parts = ["dbo", "WebChat_SheetChatbot"]
        object_name = ".".join(parts)
        sql_name = ".".join(f"[{part}]" for part in parts)
        return object_name, sql_name


sheet_chatbot_repository = SheetChatbotRepository()
