const cleanerService = require('../services/conversation-cleaner.service');

describe('ConversationCleanerService Unit Tests', () => {
  test('nên loại bỏ bản ghi bị thiếu id hoặc created_at', () => {
    const rawData = [
      { id: 1, created_at: '2026-06-01T08:00:00Z', customer_id: 'C1', source: 'Facebook' },
      { id: 2, customer_id: 'C2', source: 'ZaloOA' }, // thiếu created_at
      { created_at: '2026-06-01T08:00:00Z', customer_id: 'C3', source: 'ChatWidget' }, // thiếu id
      { id: 4, created_at: 'invalid-date', customer_id: 'C4', source: 'Facebook' } // ngày không hợp lệ
    ];

    const result = cleanerService.cleanAndNormalize(rawData);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('nên loại bỏ bản ghi trùng lặp theo id', () => {
    const rawData = [
      { id: '1', created_at: '2026-06-01T08:00:00Z', customer_id: 'C1', source: 'Facebook' },
      { id: '1', created_at: '2026-06-01T09:00:00Z', customer_id: 'C1', source: 'Facebook' } // trùng id
    ];

    const result = cleanerService.cleanAndNormalize(rawData);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('nên chuẩn hóa trạng thái status đúng chuẩn', () => {
    const rawData = [
      { id: 1, created_at: '2026-06-01T08:00:00Z', status: 'mới' },
      { id: 2, created_at: '2026-06-01T08:00:00Z', status: 'processing' },
      { id: 3, created_at: '2026-06-01T08:00:00Z', status: 'chờ xử lý' },
      { id: 4, created_at: '2026-06-01T08:00:00Z', status: 'done' },
      { id: 5, created_at: '2026-06-01T08:00:00Z', status: 'hành tinh lạ' } // trạng thái không xác định
    ];

    const result = cleanerService.cleanAndNormalize(rawData);
    expect(result[0].status).toBe('new');
    expect(result[1].status).toBe('open');
    expect(result[2].status).toBe('pending');
    expect(result[3].status).toBe('closed');
    expect(result[4].status).toBe('unknown');
  });

  test('nên chuẩn hóa nguồn source đúng chuẩn', () => {
    const rawData = [
      { id: 1, created_at: '2026-06-01T08:00:00Z', source: 'fb' },
      { id: 2, created_at: '2026-06-01T08:00:00Z', source: 'zalooa' },
      { id: 3, created_at: '2026-06-01T08:00:00Z', source: 'zalobusiness' },
      { id: 4, created_at: '2026-06-01T08:00:00Z', source: 'chatwidget' },
      { id: 5, created_at: '2026-06-01T08:00:00Z', source: 'tiktok' } // nguồn khác
    ];

    const result = cleanerService.cleanAndNormalize(rawData);
    expect(result[0].source).toBe('Facebook');
    expect(result[1].source).toBe('ZaloOA');
    expect(result[2].source).toBe('ZaloBusiness');
    expect(result[3].source).toBe('ChatWidget');
    expect(result[4].source).toBe('other');
  });
});
