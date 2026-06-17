/**
 * 09-security.spec.ts
 * Tests: SQL injection, invalid datasets/fields/aggregations, excessive limits,
 * LIKE escape injection. All must be rejected or safely parameterized.
 * These tests call the real backend API directly (not via the UI) plus via UI flow.
 */
import { test, expect, withCatalogMock } from '../fixtures/index';

const API_BASE = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5000';

/** Helper to POST to /preview directly */
async function postPreview(request: import('@playwright/test').APIRequestContext, body: object) {
  return request.post(`${API_BASE}/api/chart-builder/preview`, {
    data: body,
    headers: { 'Content-Type': 'application/json' },
  });
}

test.describe('Chart Builder – Security Regression', () => {
  test('live catalog preserves Vietnamese UTF-8 labels', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/chart-builder/catalog`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Số lượng hội thoại');
  });

  test('SQL injection in fieldId is rejected by schema validation (422)', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: "channel'; DROP TABLE dbo.WebChat_Conversations;--" }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      filters: [],
      sort: [],
      limit: 100,
    });
    // Pydantic SAFE_ID_PATTERN rejects this: 422 Unprocessable Entity
    expect([400, 422]).toContain(response.status());
  });

  test('invalid dataset ID returns 400 from /preview', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'users__secret_table',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel' }],
      metrics: [{ fieldId: 'record_id', aggregation: 'count', alias: 'n' }],
      filters: [],
      sort: [],
      limit: 100,
    });
    expect([400, 422]).toContain(response.status());
  });

  test('invalid aggregation for field type returns 400 from /preview', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'message_analytics',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel' }],
      metrics: [{ fieldId: 'record_id', aggregation: 'sum', alias: 'bad_sum' }],
      filters: [],
      sort: [],
      limit: 100,
    });
    expect([400, 422]).toContain(response.status());
  });

  test('unavailable topic field is rejected by the live backend', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'message_analytics',
      chartType: 'bar',
      dimensions: [{ fieldId: 'topic', alias: 'topic' }],
      metrics: [{ fieldId: 'record_id', aggregation: 'count', alias: 'n' }],
      filters: [],
      sort: [],
      limit: 100,
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('chưa được hỗ trợ');
  });

  test('limit > 5000 is rejected by schema validation (422)', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel' }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      filters: [],
      sort: [],
      limit: 99999,  // Exceeds max_limit=5000
    });
    expect([400, 422]).toContain(response.status());
  });

  test('LIKE injection in filter value is safely parameterized (not in SQL string)', async ({ request }) => {
    const maliciousValue = "Face%'; DROP TABLE dbo.WebChat_MessageAnalytics;--";
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel' }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      filters: [{ fieldId: 'channel', operator: 'contains', value: maliciousValue }],
      sort: [],
      limit: 10,
    });
    // Should either succeed (safe) or return 400 (validation error)
    // Must never return 500 with DB error message
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Response must not leak SQL or DROP TABLE in any field
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain('DROP TABLE');
      expect(bodyStr).not.toContain('dbo.WebChat_MessageAnalytics');
    }
  });

  test('wildcard % in filter value does not break the query', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel' }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      filters: [{ fieldId: 'channel', operator: 'contains', value: '%' }],
      sort: [],
      limit: 10,
    });
    // Should not produce a 500 server error
    expect(response.status()).not.toBe(500);
  });

  test('topN values beyond 500 are rejected', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel' }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      filters: [],
      sort: [],
      topN: 9999,
      limit: 100,
    });
    expect([400, 422]).toContain(response.status());
  });

  test('boolean dimension with nullHandling label is rejected before SQL execution', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'stacked_bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel', nullHandling: 'label' }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      series: { fieldId: 'no_response_needed', alias: 'no_response_needed', nullHandling: 'label' },
      filters: [],
      sort: [],
      limit: 100,
    });
    const text = await response.text();
    expect([400, 422]).toContain(response.status());
    expect(text).toContain('Chỉ trường văn bản');
    expect(text).not.toContain('SELECT ');
    expect(text).not.toContain('WebChat_');
  });

  test('custom date filter rejects from date after to date with 4xx', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel', nullHandling: 'label' }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      filters: [
        {
          fieldId: 'last_message_at',
          operator: 'between',
          value: '2026-06-12',
          valueTo: '2026-06-01',
        },
      ],
      sort: [],
      limit: 100,
    });
    const text = await response.text();
    expect([400, 422]).toContain(response.status());
    expect(text).toContain('Ngày bắt đầu');
    expect(text).not.toContain('SELECT ');
    expect(text).not.toContain('WebChat_');
  });

  test('overlong text filter is rejected with 4xx and does not leak SQL', async ({ request }) => {
    const response = await postPreview(request, {
      version: 2,
      mode: 'custom',
      datasetId: 'conversations',
      chartType: 'bar',
      dimensions: [{ fieldId: 'channel', alias: 'channel', nullHandling: 'label' }],
      metrics: [{ fieldId: 'conversation_id', aggregation: 'count_distinct', alias: 'n' }],
      filters: [{ fieldId: 'channel', operator: 'contains', value: 'x'.repeat(501) }],
      sort: [],
      limit: 100,
    });
    const text = await response.text();
    expect([400, 422]).toContain(response.status());
    expect(text).toContain('quá dài');
    expect(text).not.toContain('SELECT ');
    expect(text).not.toContain('WebChat_');
  });

  test('UI does not call port 5173 for API requests (no port 5173 API calls)', async ({ page }) => {
    await withCatalogMock(page);
    const port5173ApiCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes(':5173/api/')) {
        port5173ApiCalls.push(req.url());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);
    expect(port5173ApiCalls).toHaveLength(0);
  });
});
