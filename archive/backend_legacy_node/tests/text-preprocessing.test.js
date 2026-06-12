/**
 * Unit tests: text-preprocessing.service.js
 */
const textPreprocessing = require('../services/text-preprocessing.service');

describe('TextPreprocessingService', () => {
  test('cleanText: trả về chuỗi rỗng nếu input null hoặc undefined', () => {
    expect(textPreprocessing.cleanText(null)).toBe('');
    expect(textPreprocessing.cleanText(undefined)).toBe('');
    expect(textPreprocessing.cleanText('')).toBe('');
  });

  test('cleanText: chuyển về lowercase', () => {
    const result = textPreprocessing.cleanText('Tôi RẤT Hài Lòng');
    expect(result).toBe(result.toLowerCase());
  });

  test('cleanText: loại bỏ URL', () => {
    const text = 'Xem tại https://flic.com.vn/product và www.google.com nhé';
    const result = textPreprocessing.cleanText(text);
    expect(result).not.toContain('https://');
    expect(result).not.toContain('www.google.com');
  });

  test('cleanText: loại bỏ ký tự xuống dòng thừa', () => {
    const text = 'Xin chào\n\nTôi muốn hỏi\r\nvề lịch thi';
    const result = textPreprocessing.cleanText(text);
    expect(result).not.toMatch(/\r|\n/);
  });

  test('cleanText: không xóa dấu tiếng Việt', () => {
    const text = 'Tôi rất hài lòng với dịch vụ tư vấn của bạn';
    const result = textPreprocessing.cleanText(text);
    expect(result).toContain('hài lòng');
    expect(result).toContain('dịch vụ');
  });

  test('cleanText: chuẩn hóa khoảng trắng thừa', () => {
    const text = 'Xin  chào    bạn';
    const result = textPreprocessing.cleanText(text);
    expect(result).toBe('xin chào bạn');
  });

  test('cleanText: mở rộng viết tắt FLIC phổ biến', () => {
    const result = textPreprocessing.cleanText('em kh đăng nhập dc');
    expect(result).toContain('em không đăng nhập được');
  });

  test('cleanText: mở rộng ib thành inbox', () => {
    const result = textPreprocessing.cleanText('ib cho em với');
    expect(result).toContain('inbox');
  });

  test('cleanText: giữ được token TOEIC, MOS, IC3 sau khi lowercase', () => {
    const result = textPreprocessing.cleanText('lịch thi TOEIC và thi MOS IC3');
    expect(result).toContain('toeic');
    expect(result).toContain('mos');
    expect(result).toContain('ic3');
  });

  test('cleanText: rút gọn ký tự đặc biệt lặp lại', () => {
    const text = 'tệ quá!!!!!';
    const result = textPreprocessing.cleanText(text);
    expect(result).toContain('!');
    expect(result).not.toMatch(/!{2,}/);
  });

  test('splitSentences: tách câu theo dấu câu', () => {
    const text = 'lịch thi khi nào có. em không đăng nhập được! cần tư vấn';
    const sentences = textPreprocessing.splitSentences(text);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
  });
});
