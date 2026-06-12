// Mock db.js để tránh mở kết nối cơ sở dữ liệu thật khi chạy test
jest.mock('../config/db', () => ({
  sql: {},
  poolPromise: Promise.resolve({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn()
    })
  })
}));

// Mock repository trước khi require dashboard.service
jest.mock('../repositories/conversation.repository');
const conversationRepository = require('../repositories/conversation.repository');
const dashboardService = require('../services/dashboard.service');

describe('DashboardService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('nên tính toán KPI chính xác từ dữ liệu thô của repository', async () => {
    // 1. Định nghĩa dữ liệu giả lập trả về từ DB
    const mockDbConversations = [
      {
        id: 1,
        customer_id: 'C1',
        customer_name: 'Nguyen Van A',
        status: 'mới',
        source: 'facebook',
        created_at: '2026-06-01T08:00:00.000Z',
        first_response_at: '2026-06-01T08:10:00.000Z', // Phản hồi mất 10 phút
        updated_at: '2026-06-01T08:15:00.000Z'
      },
      {
        id: 2,
        customer_id: 'C2',
        customer_name: 'Le Thi B',
        status: 'đang xử lý',
        source: 'zalooa',
        created_at: '2026-06-01T08:30:00.000Z',
        first_response_at: '2026-06-01T08:50:00.000Z', // Phản hồi mất 20 phút
        updated_at: '2026-06-01T08:55:00.000Z'
      },
      {
        id: 3,
        customer_id: 'C1', // Khách hàng trùng với bản ghi 1
        customer_name: 'Nguyen Van A',
        status: 'closed',
        source: 'chatwidget',
        created_at: '2026-06-01T09:00:00.000Z',
        first_response_at: null, // Không phản hồi
        updated_at: '2026-06-01T09:05:00.000Z'
      }
    ];

    // Thiết lập mock return value cho repository
    conversationRepository.getConversations.mockResolvedValue(mockDbConversations);

    // 2. Chạy phương thức tính KPI
    const kpi = await dashboardService.getKPIs('2026-06-01', '2026-06-30');

    // 3. Kiểm định kết quả
    expect(conversationRepository.getConversations).toHaveBeenCalledWith('2026-06-01', '2026-06-30');
    expect(kpi.totalConversations).toBe(3);
    
    // Khách hàng mới (unique customer_id) phải là 2 (C1 và C2)
    expect(kpi.newCustomers).toBe(2);

    // Tổng số lượng theo trạng thái
    expect(kpi.statusSummary).toEqual({
      new: 1,
      open: 1,
      pending: 0,
      closed: 1,
      unknown: 0
    });

    // Tổng số lượng theo nguồn dữ liệu
    expect(kpi.sourceSummary).toEqual({
      Facebook: 1,
      ZaloOA: 1,
      ZaloBusiness: 0,
      ChatWidget: 1,
      other: 0
    });

    // Thời gian phản hồi trung bình (10 phút + 20 phút) / 2 lượt phản hồi = 15 phút
    expect(kpi.averageResponseTimeMinutes).toBe(15);
  });

  test('nên trả về các thống kê rỗng nếu repository không có bản ghi nào', async () => {
    conversationRepository.getConversations.mockResolvedValue([]);

    const kpi = await dashboardService.getKPIs();

    expect(kpi.totalConversations).toBe(0);
    expect(kpi.newCustomers).toBe(0);
    expect(kpi.averageResponseTimeMinutes).toBe(0);
    expect(kpi.statusSummary.new).toBe(0);
    expect(kpi.sourceSummary.Facebook).toBe(0);
  });
});
