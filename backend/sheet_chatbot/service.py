import re
import unicodedata
from difflib import SequenceMatcher

from backend.sheet_chatbot.repository import sheet_chatbot_repository


VALID_STATUSES = {
    "Chờ xử lý",
    "Đã duyệt",
    "Cần chỉnh sửa",
    "Từ chối",
}

VALID_STATUS_KEYS = {"cho xu ly", "da duyet", "can chinh sua", "tu choi"}

VALID_RISKS = {"Thap", "Trung binh", "Cao", "Tháº¥p", "Trung bĂ¬nh"}


def normalize_text(value=""):
    normalized = unicodedata.normalize("NFD", str(value or ""))
    without_marks = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    without_marks = without_marks.replace("đ", "d").replace("Đ", "D")
    cleaned = re.sub(r"\s+", " ", without_marks.lower()).strip()
    return cleaned


def normalize_sheet_status(value):
    normalized = normalize_text(value)
    if normalized == "da duyet":
        return "Đã duyệt"
    if normalized == "can chinh sua":
        return "Cần chỉnh sửa"
    if normalized in ("tu choi", "bi tu choi"):
        return "Từ chối"
    return "Chờ xử lý"


def is_valid_sheet_status(value):
    return normalize_text(normalize_sheet_status(value)) in VALID_STATUS_KEYS


def status_from_risk(risk):
    return "Chờ xử lý"


def next_row_id(rows):
    max_num = 0
    for row in rows:
        match = re.match(r"^CS-(\d+)$", str(row.get("id", "")))
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"CS-{max_num + 1:03d}"


class SheetChatbotService:
    def __init__(self, repository=sheet_chatbot_repository):
        self.repository = repository

    async def get_rows(self, filters):
        page = max(int(filters.get("page") or 1), 1)
        page_size = max(min(int(filters.get("pageSize") or 10), 100), 1)
        search = normalize_text(filters.get("search"))
        status = filters.get("status")
        risk = filters.get("risk")
        added_by = filters.get("addedBy")
        role = filters.get("role")

        rows = self.repository.get_all()

        if role and role != "manager" and added_by:
            rows = [row for row in rows if row.get("addedBy") == added_by]
        elif added_by:
            rows = [row for row in rows if row.get("addedBy") == added_by]

        if search:
            rows = [
                row for row in rows
                if search in normalize_text(" ".join([
                    row.get("question", ""),
                    row.get("correctAnswer", ""),
                    row.get("topic", ""),
                    row.get("addedBy", ""),
                ]))
            ]

        if status and normalize_text(status) != "tat ca":
            rows = [row for row in rows if normalize_text(row.get("status")) == normalize_text(status)]

        if risk and normalize_text(risk) != "tat ca":
            rows = [row for row in rows if normalize_text(row.get("risk")) == normalize_text(risk)]

        rows = sorted(rows, key=lambda row: row.get("createdAt") or row.get("addedAt") or "", reverse=True)
        total = len(rows)
        start = (page - 1) * page_size

        return {
            "rows": rows[start:start + page_size],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "stats": self.get_stats(rows),
        }

    async def get_row_by_id(self, row_id):
        row = self._find_row(row_id)
        if not row:
            raise Exception(f"Khong tim thay du lieu Sheet Chatbot co ID {row_id}.")
        return row

    async def create_row(self, data):
        question = (data.get("question") or "").strip()
        answer = (data.get("correctAnswer") or data.get("answer") or "").strip()
        if not question:
            raise Exception("question la bat buoc.")
        if not answer:
            raise Exception("correctAnswer la bat buoc.")

        rows = self.repository.get_all()
        now = self.repository.now_iso()
        risk = data.get("risk") or "Thap"
        status = normalize_sheet_status(data.get("status") or status_from_risk(risk))
        row = {
            "id": next_row_id(rows),
            "addedAt": now,
            "addedBy": (data.get("addedBy") or "Admin FLIC").strip(),
            "question": question,
            "correctAnswer": answer,
            "topic": (data.get("topic") or "KhĂ¡c").strip(),
            "source": (data.get("source") or "NhĂ¢n viĂªn Ä‘á» xuáº¥t").strip(),
            "risk": risk,
            "status": status,
            "notes": (data.get("notes") or "").strip(),
            "createdAt": now,
            "updatedAt": now,
        }

        rows.append(row)
        self.repository.save_all(rows)
        return row

    async def update_row(self, row_id, data):
        rows = self.repository.get_all()
        index = self._find_index(rows, row_id)
        if index == -1:
            raise Exception(f"Khong tim thay du lieu Sheet Chatbot co ID {row_id}.")

        current = rows[index]
        allowed_fields = ["question", "correctAnswer", "topic", "source", "risk", "status", "notes", "addedBy"]
        updated = {**current}
        for field in allowed_fields:
            if field in data and data[field] is not None:
                updated[field] = data[field].strip() if isinstance(data[field], str) else data[field]

        if not updated.get("question"):
            raise Exception("question la bat buoc.")
        if not updated.get("correctAnswer"):
            raise Exception("correctAnswer la bat buoc.")
        if updated.get("status"):
            if not is_valid_sheet_status(updated["status"]):
                raise Exception("status khong hop le.")
            updated["status"] = normalize_sheet_status(updated["status"])
        else:
            updated["status"] = "Chờ xử lý"
        if updated.get("risk") and updated["risk"] not in VALID_RISKS:
            raise Exception("risk khong hop le.")

        updated["updatedAt"] = self.repository.now_iso()
        rows[index] = updated
        self.repository.save_all(rows)
        return updated

    async def update_status(self, row_id, status, reviewer=None, notes=None):
        if not is_valid_sheet_status(status):
            raise Exception("status khong hop le.")
        normalized_status = normalize_sheet_status(status)

        rows = self.repository.get_all()
        index = self._find_index(rows, row_id)
        if index == -1:
            raise Exception(f"Khong tim thay du lieu Sheet Chatbot co ID {row_id}.")

        now = self.repository.now_iso()
        row = {
            **rows[index],
            "status": normalized_status,
            "updatedAt": now,
            "reviewedAt": now,
            "reviewedBy": reviewer or rows[index].get("reviewedBy"),
        }
        if notes is not None:
            row["notes"] = notes

        rows[index] = row
        self.repository.save_all(rows)
        return row

    async def delete_row(self, row_id):
        rows = self.repository.get_all()
        index = self._find_index(rows, row_id)
        if index == -1:
            raise Exception(f"Khong tim thay du lieu Sheet Chatbot co ID {row_id}.")
        rows.pop(index)
        self.repository.save_all(rows)
        return True

    async def find_duplicates(self, question, min_similarity=0.75, limit=5):
        if not question or not question.strip():
            raise Exception("question la bat buoc.")

        target = normalize_text(question)
        matches = []
        for row in self.repository.get_all():
            candidate = normalize_text(row.get("question"))
            if not candidate:
                continue
            score = SequenceMatcher(None, target, candidate).ratio()
            if target in candidate or candidate in target:
                score = max(score, 0.92)
            if score >= min_similarity:
                matches.append({**row, "similarity": round(score, 3)})

        return sorted(matches, key=lambda row: row["similarity"], reverse=True)[:limit]

    async def merge_to_faq(self, row_id, reviewer=None):
        row = await self.update_status(row_id, "ÄĂ£ duyá»‡t", reviewer=reviewer)
        faq_topic = self._map_faq_topic(row.get("topic"))
        return {
            "id": f"FAQ-{row['id']}",
            "question": row.get("question"),
            "answer": row.get("correctAnswer"),
            "topic": faq_topic,
            "proposer": row.get("addedBy"),
            "source": row.get("source"),
            "status": "ÄĂ£ duyá»‡t",
            "riskLevel": row.get("risk"),
            "date": self.repository.now_iso()[:10],
            "notes": row.get("notes") or "Gá»™p tá»« Sheet Chatbot",
        }

    def get_stats(self, rows=None):
        if rows is None:
            rows = self.repository.get_all()
        return {
            "total": len(rows),
            "pendingManager": sum(1 for row in rows if normalize_text(row.get("status")) == "cho quan ly xac nhan"),
            "approved": sum(1 for row in rows if normalize_text(row.get("status")) == "da duyet"),
            "usable": sum(1 for row in rows if normalize_text(row.get("status")) == "co the su dung"),
            "needsEdit": sum(1 for row in rows if normalize_text(row.get("status")) == "can chinh sua"),
            "rejected": sum(1 for row in rows if normalize_text(row.get("status")) == "bi tu choi"),
        }

    def _find_row(self, row_id):
        return next((row for row in self.repository.get_all() if str(row.get("id")) == str(row_id)), None)

    def _find_index(self, rows, row_id):
        return next((index for index, row in enumerate(rows) if str(row.get("id")) == str(row_id)), -1)

    def _map_faq_topic(self, topic):
        normalized = normalize_text(topic)
        if "chuan dau ra" in normalized:
            return "Chuáº©n Ä‘áº§u ra"
        if any(key in normalized for key in ("cntt", "tin hoc", "mos", "ic3")):
            return "MOS"
        return topic or "KhĂ¡c"


sheet_chatbot_service = SheetChatbotService()
