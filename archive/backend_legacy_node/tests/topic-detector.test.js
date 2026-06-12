/**
 * Unit tests: topic-detector.service.js
 */
const topicDetector = require('../services/topic-detector.service');

describe('TopicDetectorService', () => {
  test('detectTopics: trả về mảng rỗng khi input rỗng', () => {
    const result = topicDetector.detectTopics('');
    expect(result.detectedTopics).toEqual([]);
    expect(result.detectedKeywords).toEqual([]);
  });

  test('detectTopics: phát hiện TOEIC và Lịch thi', () => {
    const result = topicDetector.detectTopics('lịch thi TOEIC tháng này khi nào có');
    expect(result.detectedTopics).toContain('TOEIC');
    expect(result.detectedTopics).toContain('Lịch thi');
  });

  test('detectTopics: phát hiện Đăng nhập hệ thống', () => {
    const result = topicDetector.detectTopics('em không đăng nhập được tài khoản');
    expect(result.detectedTopics).toContain('Đăng nhập hệ thống');
  });

  test('detectTopics: phát hiện VSTEP và Lệ phí / Học phí', () => {
    const result = topicDetector.detectTopics('lệ phí thi VSTEP bao nhiêu');
    expect(result.detectedTopics).toContain('VSTEP');
    expect(result.detectedTopics).toContain('Lệ phí / Học phí');
  });

  test('detectTopics: phát hiện Chuẩn đầu ra / Chứng chỉ', () => {
    const result = topicDetector.detectTopics('điều kiện chuẩn đầu ra là gì');
    expect(result.detectedTopics).toContain('Chuẩn đầu ra / Chứng chỉ');
  });

  test('detectTopics: phát hiện Tin học / MOS / IC3 và Tra cứu điểm', () => {
    const result = topicDetector.detectTopics('khi nào có điểm thi MOS');
    expect(result.detectedTopics).toContain('Tin học / MOS / IC3');
    expect(result.detectedTopics).toContain('Tra cứu điểm');
  });

  test('detectTopics: phát hiện Khiếu nại / Lỗi hệ thống', () => {
    const result = topicDetector.detectTopics('chatbot trả lời sai rồi');
    expect(result.detectedTopics).toContain('Khiếu nại / Lỗi hệ thống');
  });

  test('detectTopics: mặc định là Khác nếu không match topic nào', () => {
    const result = topicDetector.detectTopics('xin chào bạn');
    expect(result.detectedTopics).toContain('Khác');
  });

  test('detectTopics: luôn trả về array cho detectedTopics và detectedKeywords', () => {
    const result = topicDetector.detectTopics('em muốn đăng ký thi TOEIC');
    expect(Array.isArray(result.detectedTopics)).toBe(true);
    expect(Array.isArray(result.detectedKeywords)).toBe(true);
  });

  test('getTopicLabel: trả về chính label FLIC', () => {
    expect(topicDetector.getTopicLabel('TOEIC')).toBe('TOEIC');
    expect(topicDetector.getTopicLabel('Đăng nhập hệ thống')).toBe('Đăng nhập hệ thống');
    expect(topicDetector.getTopicLabel('Khiếu nại / Lỗi hệ thống')).toBe('Khiếu nại / Lỗi hệ thống');
  });

  test('getTaxonomy: chỉ còn taxonomy FLIC, không còn topic thương mại điện tử cũ', () => {
    const taxonomy = topicDetector.getTaxonomy();
    const keys = Object.keys(taxonomy);

    expect(keys.length).toBe(13);
    expect(keys).toContain('TOEIC');
    expect(keys).toContain('Lịch thi');
    expect(keys).not.toContain('billing');
    expect(keys).not.toContain('shipping');
    expect(keys).not.toContain('complaint');
  });
});
