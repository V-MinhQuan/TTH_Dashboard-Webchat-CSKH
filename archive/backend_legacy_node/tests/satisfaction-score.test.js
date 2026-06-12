/**
 * Unit tests: satisfaction-score.service.js
 */
const satisfactionScore = require('../services/satisfaction-score.service');

describe('SatisfactionScoreService', () => {
  test('calculateSatisfactionScore: score trong khoảng [0, 100]', () => {
    const cases = [
      { sentimentScore: 1.0, sentimentLabel: 'positive', matchedNegativeKeywords: [], cleanedText: 'tuyệt vời' },
      { sentimentScore: -1.0, sentimentLabel: 'negative', matchedNegativeKeywords: ['lỗi', 'bức xúc'], cleanedText: 'lỗi bức xúc' },
      { sentimentScore: 0.0, sentimentLabel: 'neutral', matchedNegativeKeywords: [], cleanedText: 'ok bình thường' }
    ];

    cases.forEach(params => {
      const result = satisfactionScore.calculateSatisfactionScore(params);
      expect(result.satisfactionScore).toBeGreaterThanOrEqual(0);
      expect(result.satisfactionScore).toBeLessThanOrEqual(100);
    });
  });

  test('calculateSatisfactionScore: cảm xúc tích cực thuần túy không cần review', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0.9,
      sentimentLabel: 'positive',
      matchedNegativeKeywords: [],
      cleanedText: 'cảm ơn tư vấn rõ rồi em rất hài lòng'
    });

    expect(result.satisfactionScore).toBeGreaterThanOrEqual(60);
    expect(['satisfied', 'very_satisfied']).toContain(result.satisfactionLevel);
    expect(result.needStaffReview).toBe(false);
  });

  test('calculateSatisfactionScore: sentiment negative luôn cần nhân viên xem xét', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: -0.4,
      sentimentLabel: 'negative',
      matchedNegativeKeywords: ['chatbot trả lời sai'],
      cleanedText: 'chatbot trả lời sai'
    });

    expect(result.needStaffReview).toBe(true);
    expect(result.satisfactionReason).toContain('Cảm xúc tiêu cực');
  });

  test('calculateSatisfactionScore: điểm dưới 40 cần nhân viên xem xét', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: -0.5,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'em vẫn chưa xử lý được'
    });

    expect(result.satisfactionScore).toBeLessThan(40);
    expect(result.needStaffReview).toBe(true);
  });

  test('calculateSatisfactionScore: lỗi đăng nhập cần nhân viên xem xét dù sentiment score neutral', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'em không đăng nhập được'
    });

    expect(result.needStaffReview).toBe(true);
  });

  test('calculateSatisfactionScore: sai thông tin cần nhân viên xem xét dù sentiment score neutral', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'sai thông tin nhận bằng'
    });

    expect(result.needStaffReview).toBe(true);
  });

  test('calculateSatisfactionScore: chatbot trả lời sai điều kiện tốt nghiệp cần review', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: -0.8,
      sentimentLabel: 'negative',
      matchedNegativeKeywords: ['trả lời sai'],
      cleanedText: 'chatbot trả lời sai điều kiện tốt nghiệp'
    });

    expect(result.needStaffReview).toBe(true);
  });

  test('calculateSatisfactionScore: câu hỏi lịch thi TOEIC trung tính không cần review', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'lịch thi toeic khi nào có'
    });

    expect(result.satisfactionScore).toBe(50);
    expect(result.satisfactionLevel).toBe('neutral');
    expect(result.needStaffReview).toBe(false);
  });

  test('calculateSatisfactionScore: từ khóa khẩn cấp cần review nhưng không bắt nhầm điều kiện', () => {
    const crisis = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: -0.7,
      sentimentLabel: 'negative',
      matchedNegativeKeywords: ['khởi kiện'],
      cleanedText: 'em sẽ tố cáo và khởi kiện nếu không xử lý'
    });
    const neutral = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'điều kiện chuẩn đầu ra là gì'
    });

    expect(crisis.needStaffReview).toBe(true);
    expect(neutral.needStaffReview).toBe(false);
  });

  test('calculateSatisfactionScore: luôn trả về đủ 4 fields bắt buộc', () => {
    const result = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'ok'
    });

    expect(result).toHaveProperty('satisfactionScore');
    expect(result).toHaveProperty('satisfactionLevel');
    expect(result).toHaveProperty('satisfactionReason');
    expect(result).toHaveProperty('needStaffReview');
    expect(typeof result.needStaffReview).toBe('boolean');
  });

  test('getLevelLabel: trả về nhãn tiếng Việt', () => {
    expect(satisfactionScore.getLevelLabel('very_satisfied')).toBe('Rất hài lòng');
    expect(satisfactionScore.getLevelLabel('very_unsatisfied')).toBe('Rất không hài lòng');
    expect(satisfactionScore.getLevelLabel('neutral')).toBe('Trung tính');
  });
});
