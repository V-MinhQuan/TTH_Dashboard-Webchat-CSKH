import json
import os
from copy import deepcopy
from datetime import datetime


DATA_FILE_PATH = os.getenv(
    "SHEET_CHATBOT_JSON_FILE",
    os.path.join(os.path.dirname(__file__), "../data/sheet_chatbot.json"),
)

DEFAULT_ROWS = [
    {
        "id": "CS-001",
        "addedAt": "2026-06-08T02:30:00Z",
        "addedBy": "Thu Trang",
        "question": "Lệ phí thi TOEIC hiện tại là bao nhiêu?",
        "correctAnswer": "Lệ phí thi TOEIC tại FLIC là 750.000 VNĐ/lần thi. Sinh viên có thẻ được giảm 10%.",
        "topic": "TOEIC",
        "source": "AI trả lời sai",
        "risk": "Thấp",
        "status": "Có thể sử dụng",
        "notes": "AI trả lời sai số tiền, đã kiểm tra bảng giá 2026",
        "createdAt": "2026-06-08T02:30:00Z",
        "updatedAt": "2026-06-08T02:30:00Z",
    },
    {
        "id": "CS-002",
        "addedAt": "2026-06-08T01:15:00Z",
        "addedBy": "Thùy NT",
        "question": "Thi xong VSTEP bao lâu có kết quả?",
        "correctAnswer": "Kết quả thi VSTEP được trả trong vòng 30 ngày làm việc kể từ ngày thi.",
        "topic": "VSTEP",
        "source": "AI trả lời sai",
        "risk": "Trung bình",
        "status": "Chờ xử lý",
        "notes": "AI nói 2 tháng nhưng thực tế là 30 ngày làm việc",
        "createdAt": "2026-06-08T01:15:00Z",
        "updatedAt": "2026-06-08T01:15:00Z",
    },
    {
        "id": "CS-003",
        "addedAt": "2026-06-07T09:40:00Z",
        "addedBy": "Thu Trang",
        "question": "Điểm TOEIC 600 có đủ chuẩn đầu ra không?",
        "correctAnswer": "Điểm TOEIC 600 đạt chuẩn đầu ra cho hầu hết các ngành. Một số ngành đặc biệt yêu cầu 650+.",
        "topic": "Chuẩn đầu ra ngoại ngữ",
        "source": "AI không chắc chắn",
        "risk": "Cao",
        "status": "Chờ quản lý xác nhận",
        "notes": "Cần xác nhận theo quy định từng ngành.",
        "createdAt": "2026-06-07T09:40:00Z",
        "updatedAt": "2026-06-07T09:40:00Z",
    },
]


class SheetChatbotRepository:
    def __init__(self, file_path=None):
        self.file_path = file_path or DATA_FILE_PATH

    def get_all(self):
        self._ensure_file()
        try:
            with open(self.file_path, "r", encoding="utf-8-sig") as f:
                content = f.read().strip()
                return json.loads(content) if content else []
        except Exception as exc:
            print("Error reading sheet_chatbot.json:", exc)
            return []

    def save_all(self, rows):
        dir_name = os.path.dirname(self.file_path)
        os.makedirs(dir_name, exist_ok=True)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)

    def _ensure_file(self):
        if os.path.exists(self.file_path):
            return
        dir_name = os.path.dirname(self.file_path)
        os.makedirs(dir_name, exist_ok=True)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(deepcopy(DEFAULT_ROWS), f, ensure_ascii=False, indent=2)

    def now_iso(self):
        return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


sheet_chatbot_repository = SheetChatbotRepository()
