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
});
