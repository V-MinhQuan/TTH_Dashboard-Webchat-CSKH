import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai_issue_classifier import classify_ai_issue, remove_accents


def test_ai_issue_classifier_detects_no_data_keywords():
    result = classify_ai_issue("Trợ lý AI không tìm thấy dữ liệu phù hợp trong hệ thống.")

    assert result.issue_flag is True
    assert result.issue_type == "Không tìm thấy dữ liệu"
    assert result.issue_confidence == 0.85


def test_ai_issue_classifier_prioritizes_specific_uncertain_phrase():
    result = classify_ai_issue("Hiện chưa có thông tin cụ thể, cần xác nhận thêm.")

    assert result.issue_flag is True
    assert result.issue_type == "AI không chắc chắn"


def test_ai_issue_classifier_detects_uncertain_guessing_keywords():
    result = classify_ai_issue("Có lẽ hồ sơ của bạn cần kiểm tra lại.")

    assert result.issue_flag is True
    assert result.issue_type == "AI không chắc chắn"


def test_ai_issue_classifier_maps_unclear_intent_to_uncertain():
    result = classify_ai_issue("Tôi chưa hiểu ý bạn, vui lòng diễn đạt lại câu hỏi.")

    assert result.issue_flag is True
    assert result.issue_type == "AI không chắc chắn"


def test_ai_issue_classifier_detects_hallucination_risk_keywords():
    result = classify_ai_issue("Tôi tự suy luận câu trả lời này từ thông tin chưa xác nhận.")

    assert result.issue_flag is True
    assert result.issue_type == "AI có nguy cơ tự tạo thông tin"


def test_ai_issue_classifier_is_accent_insensitive():
    result = classify_ai_issue("Khong tim thay thong tin trong du lieu hien co.")

    assert result.issue_flag is True
    assert result.issue_type == "Không tìm thấy dữ liệu"
    assert remove_accents("không tìm thấy") == "khong tim thay"


def test_ai_issue_classifier_returns_no_issue_for_normal_answer():
    result = classify_ai_issue("Bạn có thể nộp hồ sơ tại phòng đào tạo trong giờ hành chính.")

    assert result.issue_flag is False
    assert result.issue_type is None
