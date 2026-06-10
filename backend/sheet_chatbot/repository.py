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
        "question": "Lá»‡ phĂ­ thi TOEIC hiá»‡n táº¡i lĂ  bao nhiĂªu?",
        "correctAnswer": "Lá»‡ phĂ­ thi TOEIC táº¡i FLIC lĂ  750.000 VNÄ/láº§n thi. Sinh viĂªn cĂ³ tháº» Ä‘Æ°á»£c giáº£m 10%.",
        "topic": "TOEIC",
        "source": "AI tráº£ lá»i sai",
        "risk": "Tháº¥p",
        "status": "Chờ xử lý",
        "notes": "AI tráº£ lá»i sai sá»‘ tiá»n, Ä‘Ă£ kiá»ƒm tra báº£ng giĂ¡ 2026",
        "createdAt": "2026-06-08T02:30:00Z",
        "updatedAt": "2026-06-08T02:30:00Z",
    },
    {
        "id": "CS-002",
        "addedAt": "2026-06-08T01:15:00Z",
        "addedBy": "Thuy NT",
        "question": "Thi xong VSTEP bao lĂ¢u cĂ³ káº¿t quáº£?",
        "correctAnswer": "Káº¿t quáº£ thi VSTEP Ä‘Æ°á»£c tráº£ trong vĂ²ng 30 ngĂ y lĂ m viá»‡c ká»ƒ tá»« ngĂ y thi.",
        "topic": "VSTEP",
        "source": "AI tráº£ lá»i sai",
        "risk": "Trung bĂ¬nh",
        "status": "Chá» xá»­ lĂ½",
        "notes": "AI nĂ³i 2 thĂ¡ng nhÆ°ng thá»±c táº¿ lĂ  30 ngĂ y lĂ m viá»‡c",
        "createdAt": "2026-06-08T01:15:00Z",
        "updatedAt": "2026-06-08T01:15:00Z",
    },
    {
        "id": "CS-003",
        "addedAt": "2026-06-07T09:40:00Z",
        "addedBy": "Thu Trang",
        "question": "Äiá»ƒm TOEIC 600 cĂ³ Ä‘á»§ chuáº©n Ä‘áº§u ra khĂ´ng?",
        "correctAnswer": "Äiá»ƒm TOEIC 600 Ä‘áº¡t chuáº©n Ä‘áº§u ra cho háº§u háº¿t cĂ¡c ngĂ nh. Má»™t sá»‘ ngĂ nh Ä‘áº·c biá»‡t yĂªu cáº§u 650+.",
        "topic": "Chuáº©n Ä‘áº§u ra ngoáº¡i ngá»¯",
        "source": "AI khĂ´ng cháº¯c cháº¯n",
        "risk": "Cao",
        "status": "Chờ xử lý",
        "notes": "Cáº§n xĂ¡c nháº­n theo quy Ä‘á»‹nh tá»«ng ngĂ nh.",
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
            with open(self.file_path, "r", encoding="utf-8") as f:
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
