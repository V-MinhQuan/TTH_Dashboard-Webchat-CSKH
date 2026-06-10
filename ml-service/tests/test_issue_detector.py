"""
test_issue_detector.py
───────────────────────
Unit tests for the independent IssueDetector layer.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.issue_detector import IssueDetector

detector = IssueDetector()

POSITIVE_CASES = [
    ("em chua nhan duoc email xac nhan", "missing_email_or_notification"),
    ("em khong thay ma QR de chuyen khoan", "payment_or_qr_issue"),
    ("em khong mo duoc file on tap", "file_extract_or_document_issue"),
    ("extract file bi yeu cau mat khau", "file_extract_or_document_issue"),
    ("em chx nhan dc mail a", "typo_slang_abbreviation"),
    ("em k mo dc file", "typo_slang_abbreviation"),
    ("tra loi dum em vuiiii", "contact_failure"),
    ("da cho em hoi web bi sao vao kh duoc sao hoc a", "access_or_login_issue"),
    ("em chưa nhận được email xác nhận", "missing_email_or_notification"),
    ("em đợi mail thanh toán từ hôm qua tới giờ chưa thấy ạ", "missing_email_or_notification"),
    ("em không thấy mã QR để chuyển khoản", "payment_or_qr_issue"),
    ("em đăng ký rồi nhưng chưa có phản hồi", "registration_issue"),
    ("em không mở được file ôn tập", "file_extract_or_document_issue"),
    ("extract file bị yêu cầu mật khẩu", "file_extract_or_document_issue"),
    ("em rớt excel thì đăng ký thi lại sao ạ", "exam_result_or_retake_issue"),
    ("em sợ không kịp nộp bằng để tốt nghiệp", "deadline_or_urgency_issue"),
    ("em gọi mà không ai nghe máy", "contact_failure"),
    ("E điền mà ko hợp lệ", "access_or_login_issue"),
    ("em chx nhận đc mail ạ", "typo_slang_abbreviation"),
    ("em k mở đc file", "typo_slang_abbreviation")
]

NEGATIVE_CASES = [
    "lich thi thang 6 co chua a",
    "ho so thi gom nhung gi a",
    "le phi thi bao nhieu a",
    "co can cong chung khong a",
    "Da",
    "Vang a",
    "Ok",
    "Da em cam on chi",
    "lịch thi tháng 6 có chưa ạ",
    "hồ sơ thi gồm những gì ạ",
    "lệ phí thi bao nhiêu ạ",
    "có cần công chứng không ạ",
    "Dạ",
    "Vâng ạ",
    "Ok",
    "Dạ em cảm ơn chị"
]


def test_positive_cases():
    for text, expected_type in POSITIVE_CASES:
        res = detector.detect(text)
        assert res["issueFlag"] is True, f"Expected issueFlag=True for: {text!r}"
        assert res["issueType"] == expected_type, (
            f"Expected issueType={expected_type!r} but got {res['issueType']!r} for: {text!r}"
        )


def test_negative_cases():
    for text in NEGATIVE_CASES:
        res = detector.detect(text)
        assert res["issueFlag"] is False, (
            f"Expected issueFlag=False for: {text!r}, got: {res['issueType']!r} ({res['issueReason']})"
        )
