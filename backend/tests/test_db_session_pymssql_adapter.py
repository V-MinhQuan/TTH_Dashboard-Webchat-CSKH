import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import _PymssqlCursor


class DummyCursor:
    def __init__(self):
        self.query = ""
        self.params = ()

    def execute(self, query, params=()):
        self.query = query
        self.params = params


def test_pymssql_adapter_escapes_literal_percent_before_converting_placeholders():
    cursor = DummyCursor()
    adapter = _PymssqlCursor(cursor)

    adapter.execute("SELECT * FROM t WHERE name LIKE N'%foo%' AND id = ?", [123])

    assert cursor.query == "SELECT * FROM t WHERE name LIKE N'%%foo%%' AND id = %s"
    assert cursor.params == (123,)
