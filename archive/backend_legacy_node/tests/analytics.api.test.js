/**
 * Integration/API tests: Analytics endpoints (Sprint 6)
 *
 * Mock toÃ n bá»™ táº§ng database Ä‘á»ƒ test logic controller + route mÃ  khÃ´ng cáº§n DB tháº­t.
 */

// Mock db Ä‘á»ƒ trÃ¡nh káº¿t ná»‘i DB tháº­t
jest.mock('../config/db', () => ({
  sql: {
    Transaction: jest.fn().mockImplementation(() => ({
      begin: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
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

// Mock analytics.service Ä‘á»ƒ khÃ´ng cháº¡y business logic tháº­t khi test API layer
jest.mock('../services/analytics.service');
const analyticsService = require('../services/analytics.service');

const request = require('supertest');
const app = require('../server');

describe('Analytics API Endpoint Tests (Sprint 6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // â”€â”€â”€ POST /api/analytics/run â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('POST /api/analytics/run', () => {
    test('nÃªn tráº£ vá» 200 khi cháº¡y thÃ nh cÃ´ng vá»›i limit há»£p lá»‡', async () => {
      analyticsService.runAnalytics.mockResolvedValue({
        processed: 100,
        saved: 95,
        skipped: 5
      });

      const res = await request(app)
        .post('/api/analytics/run')
        .send({ limit: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processed).toBe(100);
      expect(res.body.data.saved).toBe(95);
    });

    test('nÃªn tráº£ vá» 400 khi limit = 0', async () => {
      const res = await request(app)
        .post('/api/analytics/run')
        .send({ limit: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('nÃªn tráº£ vá» 400 khi limit > 5000', async () => {
      const res = await request(app)
        .post('/api/analytics/run')
        .send({ limit: 9999 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('nÃªn tráº£ vá» 400 khi startDate sai Ä‘á»‹nh dáº¡ng', async () => {
      const res = await request(app)
        .post('/api/analytics/run')
        .send({ limit: 100, startDate: '01-06-2026' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('nÃªn tráº£ vá» 200 vá»›i 0 báº£n ghi khi khÃ´ng cÃ³ tin nháº¯n má»›i', async () => {
      analyticsService.runAnalytics.mockResolvedValue({
        processed: 0,
        saved: 0,
        skipped: 0
      });

      const res = await request(app)
        .post('/api/analytics/run')
        .send({ limit: 500 });

      expect(res.status).toBe(200);
      expect(res.body.data.processed).toBe(0);
    });

    test('nÃªn há»— trá»£ force=true vÃ  mode=reprocess-sample mÃ  khÃ´ng Ä‘á»•i response format', async () => {
      analyticsService.runAnalytics.mockResolvedValue({
        selected: 100,
        processed: 100,
        saved: 100,
        updated: 100,
        skipped: 0,
        phobertCount: 96,
        fallbackCount: 4,
        negativeCount: 12,
        needStaffReviewCount: 12,
        mode: 'reprocess-sample'
      });

      const res = await request(app)
        .post('/api/analytics/run')
        .send({ limit: 100, force: true, mode: 'reprocess-sample' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processed).toBe(100);
      expect(res.body.data.updated).toBe(100);
      expect(analyticsService.runAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          forceReanalyze: true,
          mode: 'reprocess-sample'
        })
      );
    });

    test('nÃªn tráº£ vá» 400 khi mode khÃ´ng há»£p lá»‡', async () => {
      const res = await request(app)
        .post('/api/analytics/run')
        .send({ limit: 100, force: true, mode: 'all-data' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(analyticsService.runAnalytics).not.toHaveBeenCalled();
    });
  });

  // â”€â”€â”€ GET /api/analytics/sentiment-summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('GET /api/analytics/sentiment-summary', () => {
    test('nÃªn tráº£ vá» 200 vá»›i dá»¯ liá»‡u tá»•ng há»£p', async () => {
      analyticsService.getSentimentSummary.mockResolvedValue({
        summary: { positive: 50, negative: 20, neutral: 30, total: 100 },
        avgScores: { positive: 0.65, negative: -0.45, neutral: 0.02 }
      });

      const res = await request(app).get('/api/analytics/sentiment-summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.total).toBe(100);
    });

    test('nÃªn truyá»n filter sentiment vÃ  topic xuá»‘ng service', async () => {
      analyticsService.getSentimentSummary.mockResolvedValue({
        summary: { positive: 0, negative: 3, neutral: 0, total: 3 },
        avgScores: { negative: -0.5 }
      });

      const res = await request(app)
        .get('/api/analytics/sentiment-summary')
        .query({ sentiment: 'negative', topic: 'TOEIC' });

      expect(res.status).toBe(200);
      expect(analyticsService.getSentimentSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          sentiment: 'negative',
          topic: 'TOEIC'
        })
      );
    });

    test('nÃªn tráº£ vá» 400 khi startDate sai Ä‘á»‹nh dáº¡ng', async () => {
      const res = await request(app)
        .get('/api/analytics/sentiment-summary?startDate=invalid-date');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('nÃªn tráº£ vá» 400 khi startDate > endDate', async () => {
      const res = await request(app)
        .get('/api/analytics/sentiment-summary?startDate=2026-06-30&endDate=2026-06-01');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('khÃ´ng thá»ƒ lá»›n hÆ¡n');
    });
  });

  // â”€â”€â”€ GET /api/analytics/topics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('GET /api/analytics/topics', () => {
    test('nÃªn tráº£ vá» danh sÃ¡ch chá»§ Ä‘á» cÃ³ label tiáº¿ng Viá»‡t', async () => {
      analyticsService.getTopicSummary.mockResolvedValue([
        { topicKey: 'TOEIC', topicLabel: 'TOEIC', count: 25 },
        { topicKey: 'Lá»‹ch thi', topicLabel: 'Lá»‹ch thi', count: 18 }
      ]);

      const res = await request(app).get('/api/analytics/topics');

      expect(res.status).toBe(200);
      expect(res.body.data[0].topicLabel).toBeDefined();
      expect(res.body.data.length).toBe(2);
    });

    test('nÃªn truyá»n filter topic xuá»‘ng service', async () => {
      analyticsService.getTopicSummary.mockResolvedValue([
        { topicKey: 'TOEIC', topicLabel: 'TOEIC', count: 2 }
      ]);

      const res = await request(app)
        .get('/api/analytics/topics')
        .query({ topic: 'TOEIC' });

      expect(res.status).toBe(200);
      expect(analyticsService.getTopicSummary).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'TOEIC' })
      );
    });
  });

  // â”€â”€â”€ GET /api/analytics/negative-conversations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('GET /api/analytics/negative-conversations', () => {
    test('nÃªn tráº£ vá» 200 vá»›i dá»¯ liá»‡u phÃ¢n trang', async () => {
      analyticsService.getNegativeConversations.mockResolvedValue({
        records: [],
        pagination: { page: 1, pageSize: 20, total: 0 }
      });

      const res = await request(app)
        .get('/api/analytics/negative-conversations?page=1&pageSize=20');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('pagination');
    });

    test('nÃªn truyá»n filter topic vÃ  phÃ¢n trang xuá»‘ng service', async () => {
      analyticsService.getNegativeConversations.mockResolvedValue({
        records: [],
        pagination: { page: 2, pageSize: 10, total: 0 }
      });

      const res = await request(app)
        .get('/api/analytics/negative-conversations')
        .query({ page: 2, pageSize: 10, topic: 'ÄÄƒng nháº­p há»‡ thá»‘ng' });

      expect(res.status).toBe(200);
      expect(analyticsService.getNegativeConversations).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'ÄÄƒng nháº­p há»‡ thá»‘ng',
          page: 2,
          pageSize: 10
        })
      );
    });

    test('nÃªn tráº£ vá» 400 khi pageSize > 100', async () => {
      const res = await request(app)
        .get('/api/analytics/negative-conversations?pageSize=200');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // â”€â”€â”€ GET /api/analytics/satisfaction-summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('GET /api/analytics/satisfaction-summary', () => {
    test('nÃªn tráº£ vá» 200 vá»›i dá»¯ liá»‡u hÃ i lÃ²ng', async () => {
      analyticsService.getSatisfactionSummary.mockResolvedValue({
        avgSatisfactionScore: 72.5,
        totalMessages: 100,
        needReviewCount: 5,
        levelDistribution: { satisfied: 60, neutral: 35, unsatisfied: 5 }
      });

      const res = await request(app).get('/api/analytics/satisfaction-summary');

      expect(res.status).toBe(200);
      expect(res.body.data.avgSatisfactionScore).toBe(72.5);
      expect(res.body.data.needReviewCount).toBe(5);
    });
  });
  describe('GET /api/analytics/need-review-conversations', () => {
    test('nen tra ve 200 voi endpoint canonical cho hoi thoai can xem xet', async () => {
      analyticsService.getNegativeConversations.mockResolvedValue({
        records: [],
        pagination: { page: 1, pageSize: 20, total: 0 }
      });

      const res = await request(app)
        .get('/api/analytics/need-review-conversations?page=1&pageSize=20');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.canonicalEndpoint).toBe('/api/analytics/need-review-conversations');
      expect(res.body.meta.endpointStatus).toBe('canonical');
    });
  });

  describe('GET /api/analytics/need-review-keywords', () => {
    test('nen goi keyword service voi mode needReview', async () => {
      analyticsService.getNegativeKeywords.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/analytics/need-review-keywords');

      expect(res.status).toBe(200);
      expect(analyticsService.getNegativeKeywords).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'needReview' })
      );
    });

    test('nen tra 400 khi keyword mode khong hop le', async () => {
      const res = await request(app)
        .get('/api/analytics/negative-keywords?mode=invalid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

