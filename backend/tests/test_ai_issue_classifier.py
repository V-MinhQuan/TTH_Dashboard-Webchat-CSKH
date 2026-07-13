import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.topic_taxonomy import canonical_topic_labels
from app.services.ai_issue_classifier import classify_ai_issue, remove_accents
from app.core.text_matching import match_keyword
from app.services.topic_resolver import resolve_topic


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


def test_ai_issue_classifier_maps_hallucination_risk_to_uncertain():
    result = classify_ai_issue("Tôi tự suy luận câu trả lời này từ thông tin chưa xác nhận.")

    assert result.issue_flag is True
    assert result.issue_type == "AI không chắc chắn"


def test_ai_issue_classifier_is_accent_insensitive():
    result = classify_ai_issue("Khong tim thay thong tin trong du lieu hien co.")

    assert result.issue_flag is True
    assert result.issue_type == "Không tìm thấy dữ liệu"
    assert remove_accents("không tìm thấy") == "khong tim thay"


def test_keyword_matching_requires_complete_word_or_phrase():
    assert match_keyword("LỊCH THI TOEIC", "lịch thi toeic") is not None
    assert match_keyword("Khách nói biomass", "MOS") is None


def test_keyword_matching_keeps_only_most_specific_nested_phrase():
    from app.core.text_matching import find_keyword_matches

    matches = find_keyword_matches(
        "Cho tôi hỏi lịch thi TOEIC tháng này",
        ["TOEIC", "thi TOEIC", "lịch thi TOEIC"],
    )
    assert [match.keyword for match in matches] == ["lịch thi TOEIC"]


def test_topic_resolver_prefers_direct_topic_over_old_context():
    result = resolve_topic(
        "Thôi, chuyển sang MOS nhé",
        [{"messageId": 10, "textContent": "Tôi muốn hỏi TOEIC"}],
    )
    assert result.primary_topic_id == "mos"
    assert result.source == "direct"


def test_topic_resolver_inherits_nearest_clear_customer_topic():
    result = resolve_topic(
        "Lệ phí bao nhiêu?",
        [
            {"messageId": 20, "textContent": "Tôi muốn hỏi MOS"},
            {"messageId": 10, "textContent": "Tôi muốn hỏi TOEIC"},
        ],
    )
    assert result.primary_topic_id == "mos"
    assert result.source == "context"
    assert result.context_message_id == 20


def test_topic_resolver_does_not_choose_taxonomy_order_for_ambiguous_message():
    result = resolve_topic("So sánh lịch thi TOEIC và MOS")
    assert result.primary_topic_id is None
    assert result.source == "ambiguous"


def test_ai_issue_classifier_returns_no_issue_for_normal_answer():
    result = classify_ai_issue("Bạn có thể nộp hồ sơ tại phòng đào tạo trong giờ hành chính.")

    assert result.issue_flag is False
    assert result.issue_type is None


def test_topic_inference_maps_customer_text_to_six_canonical_groups():
    assert canonical_topic_labels("Em muốn đăng ký thi IC3 CNTT cơ bản") == [
        "Sát hạch CNTT",
    ]
    assert canonical_topic_labels("Trung tâm có lớp tin học văn phòng học Word và Excel không?") == [
        "Học Tin học",
    ]
    assert canonical_topic_labels("Em cần lịch thi TOEIC và chứng chỉ MOS") == ["TOEIC", "MOS"]
    assert canonical_topic_labels("Em cần gặp tư vấn viên") == ["Khác"]
