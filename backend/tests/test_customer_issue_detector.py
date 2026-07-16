from __future__ import annotations

import pytest

from app.services.customer_issue_detector import detect_customer_issue


@pytest.mark.parametrize(
    ("text", "expected_type"),
    [
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
        ("em sợ không kịp nộp bằng để tốt nghiệp", "deadline_or_urgency_issue"),
        ("em rớt excel thì đăng ký thi lại sao ạ", "exam_result_or_retake_issue"),
        ("E điền mà ko hợp lệ", "access_or_login_issue"),
        ("em gọi mà không ai nghe máy", "contact_failure"),
        ("em chx nhận đc mail ạ", "typo_slang_abbreviation"),
        ("em k mở đc file", "typo_slang_abbreviation"),
    ],
)
def test_detect_customer_issue_preserves_issue_categories(text: str, expected_type: str):
    result = detect_customer_issue(text)

    assert result == {
        "issueFlag": True,
        "issueType": expected_type,
        "issueConfidence": 0.9,
        "issueReason": result["issueReason"],
    }
    assert result["issueReason"].startswith("matched pattern: ")


@pytest.mark.parametrize(
    "text",
    [
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
        "Dạ em cảm ơn chị",
    ],
)
def test_detect_customer_issue_does_not_flag_informational_text(text: str):
    result = detect_customer_issue(text)

    assert result["issueFlag"] is False
    assert result["issueType"] == "none"
    assert result["issueConfidence"] == 0.0


def test_detect_customer_issue_preserves_exact_whitelist_reason():
    assert detect_customer_issue("lịch thi có chưa ạ") == {
        "issueFlag": False,
        "issueType": "none",
        "issueConfidence": 0.0,
        "issueReason": "matches whitelist: informational question or short greeting",
    }


def test_detect_customer_issue_normalizes_html_accents_and_spacing():
    result = detect_customer_issue("  <p>EM KHÔNG   THẤY MÃ QR</p> để chuyển khoản  ")

    assert result["issueFlag"] is True
    assert result["issueType"] == "payment_or_qr_issue"


@pytest.mark.parametrize("text", [None, "", "nội dung tư vấn thông thường"])
def test_detect_customer_issue_returns_no_issue_with_stable_contract(text: object):
    assert detect_customer_issue(text) == {
        "issueFlag": False,
        "issueType": "none",
        "issueConfidence": 0.0,
        "issueReason": "no issue pattern matched",
    }


def test_detect_customer_issue_matches_whole_phrase_boundaries():
    result = detect_customer_issue("chuỗi này chứa k mở đcfile nhưng không phải cụm hoàn chỉnh")

    assert result["issueFlag"] is False
