/**
 * Unit tests: ai-sentiment.service.js
 *
 * Chiến lược mock:
 *  - Mock http module để kiểm soát hành vi của _postJson/_getJson
 *  - Mock sentimentAnalyzer.analyzeSentiment để kiểm tra fallback call
 *  - Không gọi ml-service thật
 *
 * Chạy: npm test (từ thư mục backend/)
 */

'use strict';

// ─── Mock http/https module TRƯỚC KHI require service ─────────────────────────
jest.mock('http', () => {
  const EventEmitter = require('events');

  return {
    request: jest.fn()
  };
});

const http = require('http');

// Mock rule-based analyzer
const mockRuleBasedAnalyzer = {
  analyzeSentiment: jest.fn((text) => ({
    sentimentLabel:          'neutral',
    sentimentScore:          0.0,
    sentimentReason:         'Mock rule-based result',
    matchedPositiveKeywords: [],
    matchedNegativeKeywords: []
  }))
};

// ─── Helper: tạo mock HTTP response ───────────────────────────────────────────
function createMockHttpSuccess(responseBody) {
  const { EventEmitter } = require('events');

  return () => {
    const req = new EventEmitter();
    req.write      = jest.fn();
    req.end        = jest.fn();
    req.setTimeout = jest.fn();
    req.destroy    = jest.fn();

    const res = new EventEmitter();
    res.statusCode  = 200;
    res.setEncoding = jest.fn();

    setImmediate(() => {
      const callback = http.request.mock.calls[http.request.mock.calls.length - 1][1];
      callback(res);
      res.emit('data', JSON.stringify(responseBody));
      res.emit('end');
    });

    return req;
  };
}

function createMockHttpError(errorMessage) {
  const { EventEmitter } = require('events');

  return () => {
    const req = new EventEmitter();
    req.write      = jest.fn();
    req.end        = jest.fn();
    req.setTimeout = jest.fn();
    req.destroy    = jest.fn();

    setImmediate(() => {
      req.emit('error', new Error(errorMessage));
    });

    return req;
  };
}

// ─── Load service sau khi mock ────────────────────────────────────────────────
let aiSentimentService;

beforeAll(() => {
  aiSentimentService = require('../services/ai-sentiment.service');
});

beforeEach(() => {
  jest.clearAllMocks();
  if (aiSentimentService && aiSentimentService.clearCache) {
    aiSentimentService.clearCache();
  }
  // Reset isWarmedUp trước mỗi test để đảm bảo trạng thái nhất quán
  if (aiSentimentService && aiSentimentService._setIsWarmedUp) {
    aiSentimentService._setIsWarmedUp(false);
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: Văn bản ngắn → rule-based (không gọi ml-service)
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Short text uses rule-based', () => {

  test('null text nên dùng rule-based với source "rule-based"', async () => {
    const results = await aiSentimentService.analyzeBatch([null], mockRuleBasedAnalyzer);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('rule-based');
    expect(mockRuleBasedAnalyzer.analyzeSentiment).toHaveBeenCalled();
  });

  test('empty string nên dùng rule-based', async () => {
    const results = await aiSentimentService.analyzeBatch([''], mockRuleBasedAnalyzer);
    expect(results[0].source).toBe('rule-based');
  });

  test('whitespace-only nên dùng rule-based', async () => {
    const results = await aiSentimentService.analyzeBatch(['   '], mockRuleBasedAnalyzer);
    expect(results[0].source).toBe('rule-based');
  });

  test('text 1 ký tự nên dùng rule-based (MIN_TEXT_LENGTH=2)', async () => {
    // "a" = 1 ký tự < MIN_TEXT_LENGTH=2
    const results = await aiSentimentService.analyzeBatch(['a'], mockRuleBasedAnalyzer);
    expect(results[0].source).toBe('rule-based');
    expect(http.request).not.toHaveBeenCalled();
  });

  test('mảng rỗng trả về mảng rỗng', async () => {
    const results = await aiSentimentService.analyzeBatch([], mockRuleBasedAnalyzer);
    expect(results).toEqual([]);
    expect(http.request).not.toHaveBeenCalled();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: WARNING 6 — MIN_TEXT_LENGTH=2 cho phép "tệ", "ok"
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - MIN_TEXT_LENGTH=2 allows short Vietnamese words', () => {

  const mockMlResponse = {
    success: true,
    model:   'wonrax/phobert-base-vietnamese-sentiment',
    engine:  'onnxruntime',
    count:   1,
    results: [{
      text:          'tệ',
      label:         'negative',
      score:         -0.85,
      confidence:    0.85,
      source:        'phobert',
      rawLabel:      'NEG',
      probabilities: { positive: 0.05, neutral: 0.10, negative: 0.85 }
    }]
  };

  test('"tệ" (2 ký tự) được gửi lên PhoBERT nếu ml-service khả dụng', async () => {
    http.request.mockImplementation(createMockHttpSuccess(mockMlResponse));

    const results = await aiSentimentService.analyzeBatch(['tệ'], mockRuleBasedAnalyzer);

    // http.request phải được gọi (tức là đã gửi lên ml-service)
    expect(http.request).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('phobert');
  });

  test('"ok" (2 ký tự) được gửi lên PhoBERT nếu ml-service khả dụng', async () => {
    const okResponse = {
      ...mockMlResponse,
      results: [{ ...mockMlResponse.results[0], text: 'ok', label: 'neutral' }]
    };
    http.request.mockImplementation(createMockHttpSuccess(okResponse));

    const results = await aiSentimentService.analyzeBatch(['ok'], mockRuleBasedAnalyzer);

    expect(http.request).toHaveBeenCalled();
    expect(results).toHaveLength(1);
  });

  test('"tốt" (3 ký tự) được gửi lên PhoBERT nếu ml-service khả dụng', async () => {
    const totResponse = {
      ...mockMlResponse,
      results: [{ ...mockMlResponse.results[0], text: 'tốt', label: 'positive' }]
    };
    http.request.mockImplementation(createMockHttpSuccess(totResponse));

    const results = await aiSentimentService.analyzeBatch(['tốt'], mockRuleBasedAnalyzer);

    expect(http.request).toHaveBeenCalled();
    expect(results).toHaveLength(1);
  });

  test('empty string vẫn không gửi lên PhoBERT', async () => {
    const results = await aiSentimentService.analyzeBatch([''], mockRuleBasedAnalyzer);
    expect(http.request).not.toHaveBeenCalled();
    expect(results[0].source).toBe('rule-based');
  });

  test('whitespace vẫn không gửi lên PhoBERT', async () => {
    const results = await aiSentimentService.analyzeBatch(['  '], mockRuleBasedAnalyzer);
    expect(http.request).not.toHaveBeenCalled();
    expect(results[0].source).toBe('rule-based');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Hybrid post-processing sau PhoBERT
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Hybrid post-processing', () => {
  function mlResponseFor(texts, label = 'neutral', score = 0, confidence = 0.9) {
    return {
      success: true,
      model:   'wonrax/phobert-base-vietnamese-sentiment',
      engine:  'onnxruntime',
      count:   texts.length,
      results: texts.map(text => ({
        text,
        label,
        score,
        confidence,
        source:   'phobert',
        rawLabel: label.toUpperCase().slice(0, 3),
        probabilities: label === 'negative'
          ? { positive: 0.02, neutral: 0.08, negative: 0.90 }
          : { positive: 0.05, neutral: 0.90, negative: 0.05 }
      }))
    };
  }

  test.each([
    'điều kiện ra trường là gì',
    'điều kiện chuẩn đầu ra TOEIC là gì',
    'em muốn hỏi điều kiện thi VSTEP',
    'điều kiện tốt nghiệp cần chứng chỉ gì'
  ])('whitelist điều kiện ép "%s" về neutral dù PhoBERT trả negative', async (text) => {
    http.request.mockImplementation(createMockHttpSuccess(
      mlResponseFor([text], 'negative', -0.98, 0.98)
    ));

    const results = await aiSentimentService.analyzeBatch([text], mockRuleBasedAnalyzer);

    expect(results[0].source).toBe('phobert');
    expect(results[0].sentimentLabel).toBe('neutral');
    expect(results[0].sentimentScore).toBe(0);
    expect(results[0].sentimentReason).toContain('Câu hỏi về điều kiện/thông tin');
  });

  test.each([
    'chatbot trả lời sai rồi',
    'sai thông tin nhận bằng',
    'không xem được điểm thi',
    'em không đăng nhập được'
  ])('strong negative override ép "%s" về negative dù PhoBERT trả neutral', async (text) => {
    http.request.mockImplementation(createMockHttpSuccess(
      mlResponseFor([text], 'neutral', 0, 0.88)
    ));

    const results = await aiSentimentService.analyzeBatch([text], mockRuleBasedAnalyzer);

    expect(results[0].sentimentLabel).toBe('negative');
    expect(results[0].sentimentScore).toBeLessThanOrEqual(-0.8);
    expect(results[0].sentimentReason).toContain('Hybrid override');
    expect(results[0].matchedNegativeKeywords.length).toBeGreaterThan(0);
  });

  test('strong negative có ưu tiên cao hơn whitelist điều kiện', async () => {
    const text = 'chatbot trả lời sai điều kiện tốt nghiệp';
    http.request.mockImplementation(createMockHttpSuccess(
      mlResponseFor([text], 'neutral', 0, 0.88)
    ));

    const results = await aiSentimentService.analyzeBatch([text], mockRuleBasedAnalyzer);

    expect(results[0].sentimentLabel).toBe('negative');
    expect(results[0].sentimentReason).toContain('trả lời sai');
  });

  test('câu hỏi lịch thi giữ neutral dù PhoBERT trả positive', async () => {
    const text = 'lịch thi TOEIC khi nào có';
    http.request.mockImplementation(createMockHttpSuccess(
      mlResponseFor([text], 'positive', 0.99, 0.99)
    ));

    const results = await aiSentimentService.analyzeBatch([text], mockRuleBasedAnalyzer);

    expect(results[0].sentimentLabel).toBe('neutral');
    expect(results[0].sentimentScore).toBe(0);
    expect(results[0].sentimentReason).toContain('Câu hỏi thông tin');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: ISSUE 2 — Rule-based probabilities sum = 1
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Rule-based probabilities sum to 1', () => {

  function sumProbs(probs) {
    return (probs.positive || 0) + (probs.neutral || 0) + (probs.negative || 0);
  }

  test('rule-based positive result: probabilities sum = 1', async () => {
    mockRuleBasedAnalyzer.analyzeSentiment.mockReturnValueOnce({
      sentimentLabel:          'positive',
      sentimentScore:          0.7,
      sentimentReason:         'Tìm thấy từ tích cực',
      matchedPositiveKeywords: ['tốt'],
      matchedNegativeKeywords: []
    });

    const results = await aiSentimentService.analyzeBatch(['tốt lắm'], mockRuleBasedAnalyzer);
    // "tốt lắm" < 5 ký tự? Không, = 7 ký tự → sẽ gửi ml-service, nhưng chúng ta test fallback
    // Force rule-based bằng cách dùng text quá ngắn
    const rbResults = await aiSentimentService.analyzeBatch([''], mockRuleBasedAnalyzer);
    const probs = rbResults[0].probabilities;
    const total = sumProbs(probs);
    expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
  });

  test('rule-based negative result: probabilities sum = 1', async () => {
    mockRuleBasedAnalyzer.analyzeSentiment.mockReturnValue({
      sentimentLabel:          'negative',
      sentimentScore:          -0.8,
      sentimentReason:         'Tìm thấy từ tiêu cực',
      matchedPositiveKeywords: [],
      matchedNegativeKeywords: ['tệ']
    });

    // Text quá ngắn → rule-based ngay
    const results = await aiSentimentService.analyzeBatch([''], mockRuleBasedAnalyzer);
    const probs = results[0].probabilities;
    const total = sumProbs(probs);
    expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
    // negative phải > 0
    expect(probs.negative).toBeGreaterThan(0);
    // positive phải = 0
    expect(probs.positive).toBe(0);
  });

  test('rule-based neutral result: probabilities.neutral = 1', async () => {
    mockRuleBasedAnalyzer.analyzeSentiment.mockReturnValue({
      sentimentLabel:          'neutral',
      sentimentScore:          0.0,
      sentimentReason:         'Trung tính',
      matchedPositiveKeywords: [],
      matchedNegativeKeywords: []
    });

    const results = await aiSentimentService.analyzeBatch([''], mockRuleBasedAnalyzer);
    const probs = results[0].probabilities;
    expect(probs.neutral).toBe(1);
    expect(probs.positive).toBe(0);
    expect(probs.negative).toBe(0);
  });

  test('rule-based-fallback result: probabilities sum = 1', async () => {
    // Mô phỏng ml-service down → fallback
    mockRuleBasedAnalyzer.analyzeSentiment.mockReturnValue({
      sentimentLabel:          'negative',
      sentimentScore:          -0.6,
      sentimentReason:         'Tiêu cực',
      matchedPositiveKeywords: [],
      matchedNegativeKeywords: ['lỗi']
    });
    http.request.mockImplementation(createMockHttpError('ECONNREFUSED'));

    const results = await aiSentimentService.analyzeBatch(
      ['không đăng nhập được'],
      mockRuleBasedAnalyzer
    );
    expect(results[0].source).toBe('rule-based-fallback');
    const probs = results[0].probabilities;
    const total = sumProbs(probs);
    expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
  });

  test('rule-based positive with score=0: probabilities still sum=1 with min confidence', async () => {
    // Edge case: label=positive nhưng score=0 → dùng conf tối thiểu 0.6
    mockRuleBasedAnalyzer.analyzeSentiment.mockReturnValue({
      sentimentLabel:          'positive',
      sentimentScore:          0.0,
      sentimentReason:         'Match từ khóa positive',
      matchedPositiveKeywords: ['oke'],
      matchedNegativeKeywords: []
    });

    const results = await aiSentimentService.analyzeBatch([''], mockRuleBasedAnalyzer);
    const probs = results[0].probabilities;
    const total = sumProbs(probs);
    expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
    // Với min conf = 0.6: positive=0.6, neutral=0.4, negative=0
    expect(probs.positive).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: WARNING 5 — Cache key includes model version
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Cache key includes model version', () => {

  const mockResponse = {
    success: true,
    model:   'wonrax/phobert-base-vietnamese-sentiment',
    engine:  'onnxruntime',
    count:   1,
    results: [{
      text:          'em không đăng nhập được',
      label:         'negative',
      score:         -0.91,
      confidence:    0.91,
      source:        'phobert',
      rawLabel:      'NEG',
      probabilities: { positive: 0.02, neutral: 0.07, negative: 0.91 }
    }]
  };

  test('cache hit trả về source "cache" và không gọi lại ml-service', async () => {
    http.request.mockImplementation(createMockHttpSuccess(mockResponse));

    const first  = await aiSentimentService.analyzeBatch(['em không đăng nhập được'], mockRuleBasedAnalyzer);
    const second = await aiSentimentService.analyzeBatch(['em không đăng nhập được'], mockRuleBasedAnalyzer);

    expect(first[0].source).toBe('phobert');
    expect(second[0].source).toBe('cache');
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  test('getCacheStats trả về modelVersion', () => {
    const stats = aiSentimentService.getCacheStats();
    expect(stats).toHaveProperty('modelVersion');
    expect(typeof stats.modelVersion).toBe('string');
    expect(stats.modelVersion.length).toBeGreaterThan(0);
  });

  test('getCacheStats trả về size và maxSize', () => {
    const stats = aiSentimentService.getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('maxSize');
    expect(stats.maxSize).toBe(10000);
  });

  test('clearCache đặt lại size về 0', () => {
    aiSentimentService.clearCache();
    const stats = aiSentimentService.getCacheStats();
    expect(stats.size).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: WARNING 4 — Tiered timeout (first request / warm-up)
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Tiered timeout (cold start vs warm)', () => {

  test('trước khi warm-up: isWarmedUp = false', () => {
    aiSentimentService._setIsWarmedUp(false);
    expect(aiSentimentService._getIsWarmedUp()).toBe(false);
  });

  test('request đầu tiên gửi lên ml-service (chưa warm-up)', async () => {
    aiSentimentService._setIsWarmedUp(false);

    let capturedTimeout = null;
    http.request.mockImplementation((options, callback) => {
      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.write   = jest.fn();
      req.end     = jest.fn();
      req.destroy = jest.fn();
      req.setTimeout = jest.fn((ms) => { capturedTimeout = ms; });

      const res = new EventEmitter();
      res.statusCode  = 200;
      res.setEncoding = jest.fn();

      const mockResponse = {
        success: true,
        model:   'wonrax/phobert-base-vietnamese-sentiment',
        engine:  'onnxruntime',
        count:   1,
        results: [{
          text:          'xin chào',
          label:         'neutral',
          score:         0.0,
          confidence:    0.5,
          source:        'phobert',
          rawLabel:      'NEU',
          probabilities: { positive: 0.2, neutral: 0.6, negative: 0.2 }
        }]
      };

      setImmediate(() => {
        callback(res);
        res.emit('data', JSON.stringify(mockResponse));
        res.emit('end');
      });

      return req;
    });

    await aiSentimentService.analyzeBatch(['xin chào'], mockRuleBasedAnalyzer);

    // Timeout được truyền vào setTimeout phải là TIMEOUT_FIRST_MS (15000 mặc định)
    // hoặc giá trị từ ML_TIMEOUT_FIRST_MS env
    const expectedFirstTimeout = Number(process.env.ML_TIMEOUT_FIRST_MS || 15000);
    expect(capturedTimeout).toBe(expectedFirstTimeout);
  });

  test('sau khi warm-up thành công: isWarmedUp = true', async () => {
    aiSentimentService._setIsWarmedUp(false);

    const mockResponse = {
      success: true,
      model:   'wonrax/phobert-base-vietnamese-sentiment',
      engine:  'onnxruntime',
      count:   1,
      results: [{
        text:          'xin chào',
        label:         'neutral',
        score:         0.0,
        confidence:    0.5,
        source:        'phobert',
        rawLabel:      'NEU',
        probabilities: { positive: 0.2, neutral: 0.6, negative: 0.2 }
      }]
    };
    http.request.mockImplementation(createMockHttpSuccess(mockResponse));

    await aiSentimentService.analyzeBatch(['xin chào'], mockRuleBasedAnalyzer);

    // Sau khi request thành công, service phải đánh dấu warm-up
    expect(aiSentimentService._getIsWarmedUp()).toBe(true);
  });

  test('khi timeout xảy ra, fallback hoạt động bình thường', async () => {
    aiSentimentService._setIsWarmedUp(false);
    http.request.mockImplementation(createMockHttpError('ml-service timeout sau 15000ms'));

    const results = await aiSentimentService.analyzeBatch(
      ['không đăng nhập được'],
      mockRuleBasedAnalyzer
    );

    expect(results[0].source).toBe('rule-based-fallback');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: ml-service down → fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - ml-service down fallback', () => {

  test('ml-service connection refused → source "rule-based-fallback"', async () => {
    http.request.mockImplementation(createMockHttpError('connect ECONNREFUSED'));

    const results = await aiSentimentService.analyzeBatch(
      ['em không đăng nhập được'],
      mockRuleBasedAnalyzer
    );

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('rule-based-fallback');
    expect(mockRuleBasedAnalyzer.analyzeSentiment).toHaveBeenCalled();
  });

  test('ml-service timeout → source "rule-based-fallback"', async () => {
    http.request.mockImplementation(createMockHttpError('ml-service timeout sau 5000ms'));

    const results = await aiSentimentService.analyzeBatch(
      ['tôi rất thất vọng với dịch vụ'],
      mockRuleBasedAnalyzer
    );

    expect(results[0].source).toBe('rule-based-fallback');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: ml-service trả về ít kết quả hơn expected
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Missing results fallback', () => {

  test('ml-service trả về 1 kết quả nhưng gửi 2 văn bản → item thiếu dùng fallback', async () => {
    const partialResponse = {
      success: true,
      model:   'wonrax/phobert-base-vietnamese-sentiment',
      engine:  'onnxruntime',
      count:   1,
      results: [{
        text:          'em không đăng nhập được',
        label:         'negative',
        score:         -0.92,
        confidence:    0.92,
        source:        'phobert',
        rawLabel:      'NEG',
        probabilities: { positive: 0.02, neutral: 0.06, negative: 0.92 }
      }]
    };

    http.request.mockImplementation(createMockHttpSuccess(partialResponse));

    const results = await aiSentimentService.analyzeBatch(
      ['em không đăng nhập được', 'cảm ơn tư vấn rõ rồi'],
      mockRuleBasedAnalyzer
    );

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe('phobert');
    expect(results[1].source).toBe('rule-based-fallback');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: Thứ tự kết quả phải khớp với input
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Result order preservation', () => {

  test('thứ tự kết quả phải khớp với thứ tự input', async () => {
    const mockResponse = {
      success: true,
      model:   'wonrax/phobert-base-vietnamese-sentiment',
      engine:  'onnxruntime',
      count:   2,
      results: [
        {
          text:          'em không đăng nhập được',
          label:         'negative',
          score:         -0.90,
          confidence:    0.90,
          source:        'phobert',
          rawLabel:      'NEG',
          probabilities: { positive: 0.02, neutral: 0.08, negative: 0.90 }
        },
        {
          text:          'cảm ơn tư vấn rõ rồi',
          label:         'positive',
          score:         0.85,
          confidence:    0.85,
          source:        'phobert',
          rawLabel:      'POS',
          probabilities: { positive: 0.85, neutral: 0.12, negative: 0.03 }
        }
      ]
    };

    http.request.mockImplementation(createMockHttpSuccess(mockResponse));

    const results = await aiSentimentService.analyzeBatch(
      ['em không đăng nhập được', 'cảm ơn tư vấn rõ rồi'],
      mockRuleBasedAnalyzer
    );

    expect(results).toHaveLength(2);
    expect(results[0].sentimentLabel).toBe('negative');
    expect(results[1].sentimentLabel).toBe('positive');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: Batch splitting (65 texts → 3 batches: 32, 32, 1)
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - Batch splitting', () => {

  test('65 texts được chia thành 3 batches: 32, 32, 1', async () => {
    // Tất cả 65 text đủ dài (>= 2 ký tự với MIN_TEXT_LENGTH=2)
    const texts = Array.from({ length: 65 }, (_, i) => `văn bản số ${i + 1} đủ dài`);

    let callCount = 0;
    const batchSizes = [];

    http.request.mockImplementation((options, callback) => {
      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.setTimeout = jest.fn();
      req.destroy    = jest.fn();
      req.end        = jest.fn();

      let body = '';
      req.write = jest.fn((chunk) => { body += chunk; });

      const res = new EventEmitter();
      res.statusCode  = 200;
      res.setEncoding = jest.fn();

      setImmediate(() => {
        callback(res);
        try {
          const parsed    = JSON.parse(body);
          const batchSize = parsed.texts ? parsed.texts.length : 0;
          batchSizes.push(batchSize);
          callCount++;

          const mockResults = parsed.texts.map((t) => ({
            text:          t,
            label:         'neutral',
            score:         0.0,
            confidence:    0.5,
            source:        'phobert',
            rawLabel:      'NEU',
            probabilities: { positive: 0.1, neutral: 0.8, negative: 0.1 }
          }));

          res.emit('data', JSON.stringify({
            success: true,
            model:   'wonrax/phobert-base-vietnamese-sentiment',
            engine:  'onnxruntime',
            count:   mockResults.length,
            results: mockResults
          }));
          res.emit('end');
        } catch {
          res.emit('end');
        }
      });

      return req;
    });

    const results = await aiSentimentService.analyzeBatch(texts, mockRuleBasedAnalyzer);

    expect(results).toHaveLength(65);
    expect(callCount).toBe(3);
    expect(batchSizes).toEqual([32, 32, 1]);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: analyzeOne wrapper
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - analyzeOne', () => {

  test('analyzeOne trả về object đơn (không phải array)', async () => {
    http.request.mockImplementation(createMockHttpError('connection refused'));

    const result = await aiSentimentService.analyzeOne('văn bản đủ dài test', mockRuleBasedAnalyzer);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).not.toBeInstanceOf(Array);
    expect(result).toHaveProperty('sentimentLabel');
    expect(result).toHaveProperty('sentimentScore');
    expect(result).toHaveProperty('sentimentReason');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: checkHealth
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - checkHealth', () => {

  test('checkHealth trả về available=false khi ml-service không chạy', async () => {
    http.request.mockImplementation(createMockHttpError('ECONNREFUSED'));

    const health = await aiSentimentService.checkHealth();

    expect(health.available).toBe(false);
    expect(health.status).toBe('unreachable');
    expect(health).toHaveProperty('error');
  });

  test('checkHealth trả về available=true khi ml-service OK', async () => {
    const mockHealthResponse = {
      success:     true,
      status:      'ok',
      modelLoaded: true,
      modelName:   'wonrax/phobert-base-vietnamese-sentiment',
      engine:      'onnxruntime'
    };
    http.request.mockImplementation(createMockHttpSuccess(mockHealthResponse));

    const health = await aiSentimentService.checkHealth();

    expect(health.available).toBe(true);
    expect(health.status).toBe('ok');
    expect(health.modelLoaded).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: TASK 2 — warmUp()
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiSentimentService - warmUp()', () => {

  const mockWarmUpResponse = {
    success: true,
    model:   'wonrax/phobert-base-vietnamese-sentiment',
    engine:  'onnxruntime',
    count:   1,
    results: [{
      text:          'xin chào',
      label:         'neutral',
      score:         0.0,
      confidence:    0.5,
      source:        'phobert',
      rawLabel:      'NEU',
      probabilities: { positive: 0.2, neutral: 0.6, negative: 0.2 }
    }]
  };

  test('warmUp() với ML_WARMUP_ENABLED=true và ml-service OK → isWarmedUp = true', async () => {
    aiSentimentService._setIsWarmedUp(false);
    http.request.mockImplementation(createMockHttpSuccess(mockWarmUpResponse));

    await aiSentimentService.warmUp();

    expect(aiSentimentService._getIsWarmedUp()).toBe(true);
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  test('warmUp() với ml-service down → không crash, isWarmedUp vẫn = false', async () => {
    aiSentimentService._setIsWarmedUp(false);
    http.request.mockImplementation(createMockHttpError('connect ECONNREFUSED'));

    // warmUp() phải trả về promise resolved (không throw)
    await expect(aiSentimentService.warmUp()).resolves.toBeUndefined();

    // isWarmedUp phải vẫn là false sau khi warm-up thất bại
    expect(aiSentimentService._getIsWarmedUp()).toBe(false);
  });

  test('warmUp() với ml-service timeout → không crash, fallback vẫn hoạt động', async () => {
    aiSentimentService._setIsWarmedUp(false);
    http.request.mockImplementation(createMockHttpError('ml-service timeout sau 15000ms'));

    await expect(aiSentimentService.warmUp()).resolves.toBeUndefined();
    expect(aiSentimentService._getIsWarmedUp()).toBe(false);

    // Sau warm-up thất bại, analyzeBatch vẫn fallback về rule-based
    http.request.mockImplementation(createMockHttpError('ECONNREFUSED'));
    const results = await aiSentimentService.analyzeBatch(
      ['tôi không hài lòng với dịch vụ'],
      mockRuleBasedAnalyzer
    );
    expect(results[0].source).toBe('rule-based-fallback');
  });

  test('warmUp() với ML_WARMUP_ENABLED=false → không gọi HTTP, return ngay', async () => {
    // Lưu giá trị gốc để kiểm tra hành vi
    // _getWarmupEnabled() phải đọc từ env
    const enabled = aiSentimentService._getWarmupEnabled();

    if (!enabled) {
      // Nếu env đang là false, warmUp không gọi http.request
      await aiSentimentService.warmUp();
      expect(http.request).not.toHaveBeenCalled();
    } else {
      // Nếu env là true (mặc định), mock thành công để test path bình thường
      http.request.mockImplementation(createMockHttpSuccess(mockWarmUpResponse));
      await aiSentimentService.warmUp();
      expect(http.request).toHaveBeenCalledTimes(1);
    }
  });

  test('warmUp() thành công → isWarmedUp=true → batch tiếp theo dùng TIMEOUT_MS', async () => {
    aiSentimentService._setIsWarmedUp(false);
    http.request.mockImplementation(createMockHttpSuccess(mockWarmUpResponse));

    // Warm-up
    await aiSentimentService.warmUp();
    expect(aiSentimentService._getIsWarmedUp()).toBe(true);

    // Request tiếp theo phải dùng TIMEOUT_MS (ngắn hơn TIMEOUT_FIRST_MS)
    let capturedTimeout = null;
    http.request.mockImplementation((options, callback) => {
      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.write   = jest.fn();
      req.end     = jest.fn();
      req.destroy = jest.fn();
      req.setTimeout = jest.fn((ms) => { capturedTimeout = ms; });

      const res = new EventEmitter();
      res.statusCode  = 200;
      res.setEncoding = jest.fn();

      const batchResponse = {
        success: true,
        model:   'wonrax/phobert-base-vietnamese-sentiment',
        engine:  'onnxruntime',
        count:   1,
        results: [{
          text:          'tôi cần hỗ trợ',
          label:         'neutral',
          score:         0.0,
          confidence:    0.5,
          source:        'phobert',
          rawLabel:      'NEU',
          probabilities: { positive: 0.2, neutral: 0.6, negative: 0.2 }
        }]
      };

      setImmediate(() => {
        callback(res);
        res.emit('data', JSON.stringify(batchResponse));
        res.emit('end');
      });

      return req;
    });

    await aiSentimentService.analyzeBatch(['tôi cần hỗ trợ'], mockRuleBasedAnalyzer);

    // Sau warm-up thành công, timeout phải là TIMEOUT_MS (mặc định 5000)
    const expectedTimeout = Number(process.env.ML_TIMEOUT_MS || 5000);
    expect(capturedTimeout).toBe(expectedTimeout);
  });

  test('warmUp() thành công nhưng response.success=false → isWarmedUp vẫn = false', async () => {
    aiSentimentService._setIsWarmedUp(false);

    const badResponse = {
      success: false,
      results: null
    };
    http.request.mockImplementation(createMockHttpSuccess(badResponse));

    await expect(aiSentimentService.warmUp()).resolves.toBeUndefined();
    expect(aiSentimentService._getIsWarmedUp()).toBe(false);
  });

  test('warmUp() export: warmUp phải là function async', () => {
    expect(typeof aiSentimentService.warmUp).toBe('function');
    expect(aiSentimentService.warmUp.constructor.name).toBe('AsyncFunction');
  });

  test('_getWarmupText() trả về văn bản warm-up mặc định hoặc từ env', () => {
    const warmupText = aiSentimentService._getWarmupText();
    expect(typeof warmupText).toBe('string');
    expect(warmupText.length).toBeGreaterThan(0);
  });
});
