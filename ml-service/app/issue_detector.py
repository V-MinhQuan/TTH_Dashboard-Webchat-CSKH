"""
issue_detector.py
─────────────────
Phát hiện sự cố (Issue Detection) độc lập với cảm xúc (sentiment) cho dự án FLIC WebChat.
"""

import re
import unicodedata
import html
from typing import Dict, Any, List, Optional

# Nhãn các nhóm sự cố
ISSUE_CATEGORIES = {
    "missing_email_or_notification": [
        "chua thay mail", "chua nhan mail", "chua nhan duoc mail", "chua nhan email", "chua nhan duoc email",
        "doi mail", "cho mail", "chua co thong bao", "khong thay thong bao", "chua nhan duoc thong tin",
        "mail thanh toan", "mail xac nhan"
    ],
    "payment_or_qr_issue": [
        "khong thay ma qr", "khong co ma qr", "chua thay ma qr", "chua co ma qr", "khong thay ma",
        "ma chuyen khoan", "chuyen khoan roi", "thanh toan roi", "chua xac nhan thanh toan",
        "sai noi dung chuyen khoan"
    ],
    "registration_issue": [
        "khong dang ky duoc", "khong dang ki duoc",
        "khong bam dang ky duoc", "khong bam dang ki duoc",
        "khong thay form", "form khong hien", "khong hien form",
        "dang ky roi nhung chua", "dang ki roi nhung chua",
        "dang ky thanh cong nhung chua", "dang ki thanh cong nhung chua",
        "khong gui duoc form", "khong nop duoc form"
    ],
    "file_extract_or_document_issue": [
        "khong mo duoc file", "khong tai duoc file", "file loi", "loi file",
        "extract", "giai nen", "khong giai nen duoc", "giai nen bao loi",
        "file yeu cau mat khau", "file bat nhap mat khau", "mat khau file",
        "tai lieu khong mo duoc"
    ],
    "deadline_or_urgency_issue": [
        "khong kip", "so khong kip", "so tre", "tre han", "qua han", "het han",
        "can gap", "gap a", "kip nop bang", "khong kip nop bang", "khong kip tot nghiep"
    ],
    "exam_result_or_retake_issue": [
        "rot", "thi rot", "bi rot", "rot excel", "rot thuc hanh", "rot ly thuyet",
        "thi lai", "dang ky thi lai", "dang ki thi lai", "khong dat"
    ],
    "access_or_login_issue": [
        "khong dang nhap duoc", "khong truy cap duoc", "khong vao duoc",
        "tai khoan loi", "khong hop le", "bao khong hop le", "loi dang nhap",
        "ko hop le", "k hop le", "dang nhap loi", "kh vao duoc", "kh vao", "kh duoc", "kh dang nhap"
    ],
    "contact_failure": [
        "goi khong ai nghe", "khong ai nghe may", "khong nghe may", "khong goi duoc",
        "khong lien he duoc", "nhan khong ai tra loi", "khong phan hoi", "tra loi dum", "tra loi giup"
    ],
    "typo_slang_abbreviation": [
        "k thay", "ko thay", "k nhan", "ko nhan", "chx nhan", "chua nhan dc",
        "k mo duoc", "ko mo duoc", "k mo dc", "ko mo dc", "k vao duoc", "ko vao duoc",
        "hong thay", "hong thay", "chx", "nhan dc", "kh vao duoc", "kh duoc"
    ]
}

# Whitelist để loại bỏ false positive câu hỏi thông tin thông thường
INFO_WHITELIST = [
    "lich thi co chua a", "lich thi co chua",
    "ho so thi gom nhung gi a", "ho so thi gom nhung gi",
    "le phi thi bao nhieu a", "le phi thi bao nhieu",
    "co can cong chung khong a", "co can cong chung khong",
    "da", "vang a", "ok", "da em cam on chi"
]


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return without_marks.replace("\u0111", "d").replace("\u0110", "D")


def normalize_for_issue(text: Any) -> str:
    if text is None:
        return ""
    # Giải mã HTML
    text = html.unescape(str(text))
    # Bỏ HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Lowercase & strip accents
    text = _strip_accents(text.lower())
    # Thay thế các ký tự không phải chữ/số thành dấu cách
    text = re.sub(r"[\W_]+", " ", text)
    # Chuẩn hóa khoảng trắng
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class IssueDetector:
    """Bộ phát hiện sự cố (Issue Detector) dựa trên luật mẫu từ khóa."""

    def detect(self, text: str) -> Dict[str, Any]:
        normalized = normalize_for_issue(text)
        
        # 1. Kiểm tra whitelist để loại bỏ các câu hỏi thông tin thông thường hoặc từ chào hỏi/đệm
        # Kiểm tra khớp chính xác tuyệt đối sau chuẩn hóa
        if normalized in [normalize_for_issue(w) for w in INFO_WHITELIST]:
            return {
                "issueFlag": False,
                "issueType": "none",
                "issueConfidence": 0.0,
                "issueReason": "matches whitelist: informational question or short greeting"
            }

        # 2. Quét qua các nhóm mẫu từ khóa sự cố
        padded_text = f" {normalized} "
        for category, patterns in ISSUE_CATEGORIES.items():
            for pattern in patterns:
                normalized_pattern = normalize_for_issue(pattern)
                # Dùng space-padding để đảm bảo khớp theo ranh giới từ
                padded_pattern = f" {normalized_pattern} "
                if padded_pattern in padded_text:
                    return {
                        "issueFlag": True,
                        "issueType": category,
                        "issueConfidence": 0.90,
                        "issueReason": f"matched pattern: {pattern}"
                    }

        return {
            "issueFlag": False,
            "issueType": "none",
            "issueConfidence": 0.0,
            "issueReason": "no issue pattern matched"
        }
