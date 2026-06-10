/**
 * Unit tests: sentiment-analyzer.service.js
 */
const sentimentAnalyzer = require('../services/sentiment-analyzer.service');

describe('SentimentAnalyzerService', () => {
  test('analyzeSentiment: trả về neutral khi input rỗng', () => {
    const result = sentimentAnalyzer.analyzeSentiment('');
    expect(result.sentimentLabel).toBe('neutral');
    expect(result.sentimentScore).toBe(0.0);
  });

  test('analyzeSentiment: nhận diện positive từ lời cảm ơn/tư vấn rõ', () => {
    const result = sentimentAnalyzer.analyzeSentiment('cảm ơn tư vấn rõ rồi');
    expect(result.sentimentLabel).toBe('positive');
    expect(result.sentimentScore).toBeGreaterThan(0.15);
    expect(result.matchedPositiveKeywords.length).toBeGreaterThan(0);
  });

  test.each([
    'điều kiện ra trường là gì',
    'điều kiện chuẩn đầu ra TOEIC là gì',
    'em muốn hỏi điều kiện thi VSTEP',
    'lịch thi TOEIC khi nào có'
  ])('analyzeSentiment: câu hỏi thông tin "%s" là neutral', (text) => {
    const result = sentimentAnalyzer.analyzeSentiment(text);
    expect(result.sentimentLabel).toBe('neutral');
    expect(result.sentimentScore).toBe(0);
    expect(result.matchedNegativeKeywords).toEqual([]);
  });

  test.each([
    'em muốn khiếu nại vì chatbot trả lời sai',
    'em không đăng nhập được',
    'chatbot không hiểu câu hỏi của em',
    'em muốn khiếu kiện vì hệ thống xử lý sai',
    'sai thông tin nhận bằng',
    'không xem được điểm thi'
  ])('analyzeSentiment: nhận diện negative "%s"', (text) => {
    const result = sentimentAnalyzer.analyzeSentiment(text);
    expect(result.sentimentLabel).toBe('negative');
    expect(result.sentimentScore).toBeLessThan(-0.15);
    expect(result.matchedNegativeKeywords.length).toBeGreaterThan(0);
  });

  test('analyzeSentiment: không bắt nhầm từ đơn "kiện" trong "điều kiện"', () => {
    const result = sentimentAnalyzer.analyzeSentiment('điều kiện xét chứng chỉ là gì');
    expect(result.sentimentLabel).toBe('neutral');
    expect(result.matchedNegativeKeywords).not.toContain('kiện');
  });

  test('analyzeSentiment: xử lý phủ định - "không hài lòng" phải là negative', () => {
    const result = sentimentAnalyzer.analyzeSentiment('em không hài lòng với cách xử lý này');
    expect(result.sentimentLabel).toBe('negative');
    expect(result.sentimentScore).toBeLessThan(-0.15);
  });

  test('analyzeSentiment: score trong khoảng [-1, 1]', () => {
    const texts = [
      'tuyệt vời xuất sắc hoàn hảo tốt lắm hài lòng cảm ơn nhiều',
      'tệ hại thất vọng bức xúc lừa đảo gian lận khiếu kiện tố cáo rất tệ',
      'ok bình thường'
    ];

    texts.forEach(text => {
      const result = sentimentAnalyzer.analyzeSentiment(text);
      expect(result.sentimentScore).toBeGreaterThanOrEqual(-1.0);
      expect(result.sentimentScore).toBeLessThanOrEqual(1.0);
    });
  });

  test('analyzeSentiment: matchedPositiveKeywords và matchedNegativeKeywords không trùng lặp', () => {
    const result = sentimentAnalyzer.analyzeSentiment('cảm ơn nhưng chatbot trả lời sai');
    const posSet = new Set(result.matchedPositiveKeywords);
    const negSet = new Set(result.matchedNegativeKeywords);
    const intersection = [...posSet].filter(x => negSet.has(x));
    expect(intersection.length).toBe(0);
  });

  test('analyzeSentiment: luôn trả về đủ 5 fields bắt buộc', () => {
    const result = sentimentAnalyzer.analyzeSentiment('xin chào');
    expect(result).toHaveProperty('sentimentLabel');
    expect(result).toHaveProperty('sentimentScore');
    expect(result).toHaveProperty('sentimentReason');
    expect(result).toHaveProperty('matchedPositiveKeywords');
    expect(result).toHaveProperty('matchedNegativeKeywords');
    expect(Array.isArray(result.matchedPositiveKeywords)).toBe(true);
    expect(Array.isArray(result.matchedNegativeKeywords)).toBe(true);
  });
});
