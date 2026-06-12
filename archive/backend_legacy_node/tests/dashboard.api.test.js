// Mock db.js để tránh mở kết nối cơ sở dữ liệu thật khi chạy test
jest.mock('../config/db', () => ({
  sql: {},
  poolPromise: Promise.resolve({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{ db_time: '2026-06-03T09:37:28.810Z' }]
      })
    })
  })
}));

// Mock dashboard.service để tránh kết nối database thật khi chạy test API
jest.mock('../services/dashboard.service');
const dashboardService = require('../services/dashboard.service');

// Mock ai-sentiment.service
jest.mock('../services/ai-sentiment.service');
const aiSentimentService = require('../services/ai-sentiment.service');

const request = require('supertest');
const app = require('../server');

describe('Dashboard API Endpoint Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/health nên trả về trạng thái 200 thành công', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Backend is running');
  });

  test('GET /api/dashboard/kpi nên trả về KPI khi thành công', async () => {
    const mockKPI = {
      totalConversations: 10,
      newCustomers: 8,
      statusSummary: { new: 5, open: 3, pending: 0, closed: 2, unknown: 0 },
      sourceSummary: { ZaloOA: 4, ZaloBusiness: 2, Facebook: 3, ChatWidget: 1, other: 0 },
      averageResponseTimeMinutes: 12
    };
    dashboardService.getKPIs.mockResolvedValue(mockKPI);

    const res = await request(app).get('/api/dashboard/kpi');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(mockKPI);
  });

  test('GET /api/dashboard/kpi?startDate=invalid nên trả về mã lỗi 400', async () => {
    const res = await request(app).get('/api/dashboard/kpi?startDate=invalid-date');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Định dạng startDate không hợp lệ');
  });

  test('GET /api/dashboard/kpi nên trả về 400 nếu startDate > endDate', async () => {
    const res = await request(app).get('/api/dashboard/kpi?startDate=2026-06-30&endDate=2026-06-01');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc');
  });

  test('GET /api/unknown-route nên trả về trạng thái 404 không tìm thấy', async () => {
    const res = await request(app).get('/api/unknown-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('không tồn tại');
  });

  describe('GET /api/health/ml', () => {
    test('nên trả về 200 và thông tin sức khỏe ml-service', async () => {
      const mockHealth = {
        available: true,
        status: 'ok',
        modelLoaded: true,
        modelName: 'wonrax/phobert-base-vietnamese-sentiment',
        sentimentMode: 'ensemble'
      };
      aiSentimentService.getMlRuntimeHealth.mockResolvedValue(mockHealth);

      const res = await request(app).get('/api/health/ml');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockHealth);
      expect(aiSentimentService.getMlRuntimeHealth).toHaveBeenCalled();
    });

    test('nen tra ve mlServiceReachable=false khi ml-service offline', async () => {
      aiSentimentService.getMlRuntimeHealth.mockResolvedValue({
        status: 'unreachable',
        mlServiceReachable: false,
        sentimentMode: 'unavailable',
        phobertAvailable: false,
        visobertAvailable: false,
        visobertError: 'ECONNREFUSED',
        activeAnalyzerVersion: 'rule-based-fallback-v1',
        actualAnalyzerVersion: 'unavailable',
        issueDetectorAvailable: false,
        visobertStatus: 'experimental_not_active',
        visobertNote: 'ViSoBERT is experimental and not active because ml-service is unreachable.'
      });

      const res = await request(app).get('/api/health/ml');

      expect(res.status).toBe(200);
      expect(res.body.mlServiceReachable).toBe(false);
      expect(res.body.status).toBe('unreachable');
      expect(res.body.issueDetectorAvailable).toBe(false);
    });

    test('nen neu ro ViSoBERT active nhung chua production-approved', async () => {
      aiSentimentService.getMlRuntimeHealth.mockResolvedValue({
        status: 'ok',
        mlServiceReachable: true,
        sentimentMode: 'ensemble',
        phobertAvailable: true,
        visobertAvailable: true,
        visobertError: null,
        activeAnalyzerVersion: 'ensemble-phobert-visobert-v1',
        actualAnalyzerVersion: 'ensemble-phobert-visobert-v1',
        issueDetectorAvailable: true,
        visobertStatus: 'experimental_active_not_production_approved',
        visobertNote: 'ViSoBERT is reachable but remains experimental until separately approved for production automation.'
      });

      const res = await request(app).get('/api/health/ml');

      expect(res.status).toBe(200);
      expect(res.body.visobertAvailable).toBe(true);
      expect(res.body.visobertStatus).toBe('experimental_active_not_production_approved');
      expect(res.body.visobertNote).toContain('experimental');
    });
  });

  describe('POST /api/sentiment/predict', () => {
    const ISSUE_TRUE_CASES = [
      'em chua nhan duoc email xac nhan',
      'em khong thay ma QR de chuyen khoan',
      'em khong mo duoc file on tap',
      'extract file bi yeu cau mat khau',
      'em chx nhan dc mail a',
      'em k mo dc file',
      'tra loi dum em vuiiii',
      'da cho em hoi web bi sao vao kh duoc sao hoc a'
    ];

    const ISSUE_FALSE_CASES = [
      'lich thi thang 6 co chua a',
      'ho so thi gom nhung gi a',
      'le phi thi bao nhieu a',
      'co can cong chung khong a',
      'Da',
      'Vang a',
      'Ok',
      'Da em cam on chi'
    ];

    test.each(ISSUE_TRUE_CASES)('contract moi tra issueFlag=true va needStaffReview=true: %s', async (text) => {
      aiSentimentService.predictSingleForDashboard.mockResolvedValue({
        sentiment: { label: 'neutral', confidence: 0.76 },
        issue: {
          issueFlag: true,
          issueType: 'missing_email_or_notification',
          issueReason: 'matched pattern from ml-service',
          issueConfidence: 0.9
        },
        needStaffReview: true,
        analyzerVersion: 'ensemble-phobert-rule-v1',
        actualAnalyzerVersion: 'ensemble-phobert-rule-v1',
        source: 'ml-service',
        endpoint: '/predict-ensemble'
      });

      const res = await request(app)
        .post('/api/sentiment/predict')
        .send({ text });

      expect(res.status).toBe(200);
      expect(res.body.sentiment.label).toBe('neutral');
      expect(res.body.issue.issueFlag).toBe(true);
      expect(res.body.needStaffReview).toBe(true);
      expect(res.body.analyzerVersion).toBe('ensemble-phobert-rule-v1');
      expect(aiSentimentService.predictSingleForDashboard).toHaveBeenCalledWith(text, expect.any(Object));
    });

    test.each(ISSUE_FALSE_CASES)('contract moi tra issueFlag=false: %s', async (text) => {
      aiSentimentService.predictSingleForDashboard.mockResolvedValue({
        sentiment: { label: 'neutral', confidence: 0.91 },
        issue: {
          issueFlag: false,
          issueType: 'none',
          issueReason: 'no issue pattern matched',
          issueConfidence: 0
        },
        needStaffReview: false,
        analyzerVersion: 'ensemble-phobert-rule-v1',
        actualAnalyzerVersion: 'ensemble-phobert-rule-v1',
        source: 'ml-service',
        endpoint: '/predict-ensemble'
      });

      const res = await request(app)
        .post('/api/sentiment/predict')
        .send({ text });

      expect(res.status).toBe(200);
      expect(res.body.issue.issueFlag).toBe(false);
      expect(res.body.needStaffReview).toBe(false);
      expect(res.body.sentiment.label).toBe('neutral');
    });

    test('contract moi tra 400 khi thieu text', async () => {
      const res = await request(app)
        .post('/api/sentiment/predict')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(aiSentimentService.predictSingleForDashboard).not.toHaveBeenCalled();
    });
  });
});
