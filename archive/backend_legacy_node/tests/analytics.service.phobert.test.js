/**
 * Integration tests: analytics.service.js với PhoBERT integration
 *
 * Mock:
 *  - analytics.repository (DB)
 *  - ai-sentiment.service (ml-service)
 *  - Không mock rule-based analyzer, topic-detector, satisfaction-score
 *
 * Kiểm tra:
 *  - runAnalytics() vẫn trả về đúng format sau khi tích hợp PhoBERT
 *  - Khi aiSentimentService hoạt động → source = "phobert"
 *  - Khi aiSentimentService thất bại → runAnalytics vẫn chạy với rule-based-fallback
 *  - Các read methods không thay đổi
 */

'use strict';

// Mock DB để không kết nối thật
jest.mock('../config/db', () => ({
  sql: {
    Transaction: jest.fn().mockImplementation(() => ({
      begin:    jest.fn().mockResolvedValue(undefined),
      commit:   jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    })),
    Request: jest.fn().mockImplementation(() => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] })
    }))
  },
  poolPromise: Promise.resolve({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] })
    })
  })
}));

// Mock analytics repository
jest.mock('../repositories/analytics.repository');
const analyticsRepository = require('../repositories/analytics.repository');

// Mock ai-sentiment service
jest.mock('../services/ai-sentiment.service');
const aiSentimentService = require('../services/ai-sentiment.service');

// Load analytics service (không mock, test business logic thật)
const analyticsService = require('../services/analytics.service');

// ─── Dữ liệu mock ─────────────────────────────────────────────────────────────
const MOCK_MESSAGES = [
  {
    messageId:      1,
    textContent:    'em không đăng nhập được ứng dụng bị lỗi',
    conversationId: 100,
    customerId:     'CUST001',
    source:         'ZaloOA',
    messageAt:      new Date('2026-06-01T10:00:00Z')
  },
  {
    messageId:      2,
    textContent:    'cảm ơn nhân viên đã hỗ trợ rất nhiệt tình',
    conversationId: 101,
    customerId:     'CUST002',
    source:         'Facebook',
    messageAt:      new Date('2026-06-01T11:00:00Z')
  }
];

const MOCK_AI_RESULTS = [
  {
    sentimentLabel:          'negative',
    sentimentScore:          -0.92,
    sentimentReason:         'PhoBERT dự đoán cảm xúc tiêu cực với độ tin cậy 92%.',
    matchedPositiveKeywords: [],
    matchedNegativeKeywords: [],
    source:                  'phobert',
    confidence:              0.92,
    rawLabel:                'NEG',
    probabilities:           { positive: 0.02, neutral: 0.06, negative: 0.92 }
  },
  {
    sentimentLabel:          'positive',
    sentimentScore:          0.88,
    sentimentReason:         'PhoBERT dự đoán cảm xúc tích cực với độ tin cậy 88%.',
    matchedPositiveKeywords: [],
    matchedNegativeKeywords: [],
    source:                  'phobert',
    confidence:              0.88,
    rawLabel:                'POS',
    probabilities:           { positive: 0.88, neutral: 0.09, negative: 0.03 }
  }
];


// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();

  // Mặc định: repository trả về 2 messages, save thành công
  analyticsRepository.getUnanalyzedMessages.mockResolvedValue(MOCK_MESSAGES);
  analyticsRepository.saveMessageAnalytics.mockResolvedValue(2);
  analyticsRepository.deleteAnalyticsByMessageIds.mockResolvedValue(undefined);
  analyticsRepository.getAnalyzerVersionDistribution.mockResolvedValue([]);

  // Mặc định: ai-sentiment hoạt động bình thường (PhoBERT)
  aiSentimentService.analyzeBatch.mockResolvedValue(MOCK_AI_RESULTS);
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: runAnalytics() trả về đúng format
// ═══════════════════════════════════════════════════════════════════════════════

describe('runAnalytics() - output format', () => {

  test('nên trả về { processed, saved, skipped } với giá trị đúng', async () => {
    const result = await analyticsService.runAnalytics({ limit: 10 });

    expect(result).toHaveProperty('processed');
    expect(result).toHaveProperty('saved');
    expect(result).toHaveProperty('skipped');
    expect(result.processed).toBe(2);
    expect(result.saved).toBe(2);
    expect(result.skipped).toBe(0);
  });

  test('nên trả về { processed: 0, saved: 0, skipped: 0 } khi không có messages', async () => {
    analyticsRepository.getUnanalyzedMessages.mockResolvedValue([]);

    const result = await analyticsService.runAnalytics();

    expect(result.processed).toBe(0);
    expect(result.saved).toBe(0);
    expect(result.skipped).toBe(0);
    // ai-sentiment và save không nên được gọi
    expect(aiSentimentService.analyzeBatch).not.toHaveBeenCalled();
    expect(analyticsRepository.saveMessageAnalytics).not.toHaveBeenCalled();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: aiSentimentService hoạt động → PhoBERT được dùng
// ═══════════════════════════════════════════════════════════════════════════════

describe('runAnalytics() - khi aiSentimentService hoạt động', () => {

  test('aiSentimentService.analyzeBatch nên được gọi với cleaned texts', async () => {
    await analyticsService.runAnalytics({ limit: 10 });

    expect(aiSentimentService.analyzeBatch).toHaveBeenCalledTimes(1);
    const callArgs = aiSentimentService.analyzeBatch.mock.calls[0];
    // Arg 0: mảng cleaned texts
    expect(Array.isArray(callArgs[0])).toBe(true);
    expect(callArgs[0]).toHaveLength(2);
    // Arg 1: rule-based analyzer (sentimentAnalyzer)
    expect(callArgs[1]).toBeDefined();
  });

  test('saveMessageAnalytics nên nhận items với sentimentLabel từ PhoBERT', async () => {
    await analyticsService.runAnalytics({ limit: 10 });

    expect(analyticsRepository.saveMessageAnalytics).toHaveBeenCalledTimes(1);
    const savedItems = analyticsRepository.saveMessageAnalytics.mock.calls[0][0];

    expect(savedItems).toHaveLength(2);
    // Message 1: negative từ PhoBERT
    expect(savedItems[0].sentimentLabel).toBe('negative');
    expect(savedItems[0].sentimentScore).toBeCloseTo(-0.92, 2);
    // Message 2: positive từ PhoBERT
    expect(savedItems[1].sentimentLabel).toBe('positive');
    expect(savedItems[1].sentimentScore).toBeCloseTo(0.88, 2);
  });

  test('items nên có analyzerVersion = "phobert-onnx-v1" khi source=phobert', async () => {
    await analyticsService.runAnalytics({ limit: 10 });

    const savedItems = analyticsRepository.saveMessageAnalytics.mock.calls[0][0];
    savedItems.forEach(item => {
      expect(item.analyzerVersion).toBe('phobert-onnx-v1');
      expect(item.sentimentSource).toBe('phobert');
    });
  });

  test('items nên có đầy đủ các trường bắt buộc', async () => {
    await analyticsService.runAnalytics({ limit: 10 });

    const savedItems = analyticsRepository.saveMessageAnalytics.mock.calls[0][0];
    const requiredFields = [
      'messageId', 'sentimentLabel', 'sentimentScore', 'sentimentReason',
      'matchedPositiveKeywords', 'matchedNegativeKeywords',
      'detectedTopics', 'detectedKeywords',
      'satisfactionScore', 'satisfactionLevel', 'satisfactionReason', 'needStaffReview'
    ];

    savedItems.forEach(item => {
      requiredFields.forEach(field => {
        expect(item).toHaveProperty(field);
      });
    });
  });

  test('summary mở rộng đếm nguồn PhoBERT, negative và needStaffReview', async () => {
    const result = await analyticsService.runAnalytics({ limit: 10 });

    expect(result.selected).toBe(2);
    expect(result.processed).toBe(2);
    expect(result.saved).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.phobertCount).toBe(2);
    expect(result.fallbackCount).toBe(0);
    expect(result.negativeCount).toBe(1);
    expect(result.needStaffReviewCount).toBe(1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: aiSentimentService thất bại → runAnalytics không crash, dùng rule-based-fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('runAnalytics() - khi aiSentimentService thất bại', () => {

  test('runAnalytics không crash khi analyzeBatch throw', async () => {
    // analyzeBatch throw bất ngờ
    aiSentimentService.analyzeBatch.mockRejectedValue(new Error('Lỗi không mong đợi'));

    // Không nên throw
    const result = await expect(analyticsService.runAnalytics({ limit: 10 })).resolves.toBeDefined();
  });

  test('khi analyzeBatch throw, saveMessageAnalytics vẫn được gọi với rule-based results', async () => {
    aiSentimentService.analyzeBatch.mockRejectedValue(new Error('ml-service crashed'));

    await analyticsService.runAnalytics({ limit: 10 });

    // saveMessageAnalytics phải vẫn được gọi với dữ liệu rule-based
    expect(analyticsRepository.saveMessageAnalytics).toHaveBeenCalled();
    const savedItems = analyticsRepository.saveMessageAnalytics.mock.calls[0][0];
    // Kết quả phải có từ rule-based (sentimentLabel là string hợp lệ)
    savedItems.forEach(item => {
      expect(['positive', 'neutral', 'negative']).toContain(item.sentimentLabel);
      expect(item.sentimentSource).toBe('rule-based-fallback');
      expect(item.analyzerVersion).toBe('rule-based-fallback-v1');
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: forceReanalyze option
// ═══════════════════════════════════════════════════════════════════════════════

describe('runAnalytics() - forceReanalyze', () => {

  test('nên gọi deleteAnalyticsByMessageIds khi forceReanalyze=true', async () => {
    await analyticsService.runAnalytics({ limit: 10, forceReanalyze: true });

    expect(analyticsRepository.deleteAnalyticsByMessageIds).toHaveBeenCalledWith([1, 2]);
  });

  test('không gọi deleteAnalyticsByMessageIds khi forceReanalyze=false', async () => {
    await analyticsService.runAnalytics({ limit: 10, forceReanalyze: false });

    expect(analyticsRepository.deleteAnalyticsByMessageIds).not.toHaveBeenCalled();
  });

  test('reprocess sample chỉ chọn tối đa theo limit và chỉ xóa messageId đã chọn', async () => {
    const result = await analyticsService.runAnalytics({
      limit: 100,
      forceReanalyze: true,
      mode: 'reprocess-sample'
    });

    expect(analyticsRepository.getUnanalyzedMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100,
        forceReanalyze: true
      })
    );
    expect(analyticsRepository.deleteAnalyticsByMessageIds).toHaveBeenCalledWith([1, 2]);
    expect(result.selected).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.mode).toBe('reprocess-sample');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Test: Read methods không thay đổi
// ═══════════════════════════════════════════════════════════════════════════════

describe('Read methods - không thay đổi sau integration', () => {

  test('getSentimentSummary vẫn delegate sang repository', async () => {
    analyticsRepository.getSentimentSummary = jest.fn().mockResolvedValue([
      { sentimentLabel: 'positive', count: 50, avgScore: 0.65 },
      { sentimentLabel: 'negative', count: 20, avgScore: -0.45 },
      { sentimentLabel: 'neutral',  count: 30, avgScore: 0.02 }
    ]);
    analyticsRepository.getAnalyzerVersionDistribution = jest.fn().mockResolvedValue([
      {
        sentimentSource: 'ensemble',
        analyzerVersion: 'ensemble-phobert-rule-v1',
        sentimentLabel: 'neutral',
        total: 30
      }
    ]);

    const result = await analyticsService.getSentimentSummary({});

    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('analyzerVersionDistribution');
    expect(result.summary.total).toBe(100);
    expect(result.summary.positive).toBe(50);
    expect(result.analyzerVersionDistribution[0].analyzerVersion).toBe('ensemble-phobert-rule-v1');
  });

  test('getTopicSummary vẫn hoạt động bình thường', async () => {
    analyticsRepository.getTopicRawData = jest.fn().mockResolvedValue([
      { detectedTopics: '["billing","shipping"]', msgCount: 5 }
    ]);

    const result = await analyticsService.getTopicSummary({});

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('getSatisfactionSummary vẫn trả về đúng format', async () => {
    analyticsRepository.getSatisfactionSummary = jest.fn().mockResolvedValue([
      { satisfactionLevel: 'satisfied', levelCount: 60, avgSatisfactionScore: 72, needReviewCount: 2 }
    ]);

    const result = await analyticsService.getSatisfactionSummary({});

    expect(result).toHaveProperty('avgSatisfactionScore');
    expect(result).toHaveProperty('totalMessages');
    expect(result).toHaveProperty('needReviewCount');
    expect(result).toHaveProperty('levelDistribution');
  });
});
