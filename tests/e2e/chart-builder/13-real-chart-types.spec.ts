import { expect, goToChartBuilder, test } from '../fixtures/index';

const API_BASE = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:5000';
const EXPECTED_CHANNELS = ['ChatWidget', 'Facebook', 'ZaloBusiness', 'ZaloOA'];

const SINGLE_METRIC_CHARTS = [
  { label: 'Cột đứng', selector: '.recharts-bar-rectangle, .recharts-bar' },
  { label: 'Đường', selector: '.recharts-line, .recharts-line-curve' },
  { label: 'Hình tròn', selector: '.recharts-pie' },
  { label: 'Hình khuyên', selector: '.recharts-pie' },
  { label: 'Cột chồng', selector: '.recharts-bar' },
  { label: 'Cột ngang', selector: '.recharts-bar' },
  { label: 'Vùng', selector: '.recharts-area' },
  { label: 'Radar', selector: '.recharts-radar, .recharts-polygon' },
] as const;

const TWO_METRIC_CHARTS = [
  { label: 'Phân tán', selector: '.recharts-scatter' },
  { label: 'Kết hợp', selector: '.recharts-bar, .recharts-line' },
] as const;

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  const settings = page.getByRole('complementary', { name: 'Cài đặt biểu đồ' });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Mở cài đặt biểu đồ' }).click();
  }
}

async function selectChartType(page: import('@playwright/test').Page, label: string): Promise<void> {
  await openSettings(page);
  await page.getByTitle(label, { exact: true }).click();
  await page.waitForTimeout(900);
}

async function expectRenderedOrExplicitNoData(
  page: import('@playwright/test').Page,
  selector: string,
): Promise<void> {
  const chart = page.locator(selector).first();
  const chartSurface = page.locator('#chart-builder-export-area .recharts-surface').first();
  const noData = page.locator('[data-preview-state="no-data"]');
  await expect.poll(async () => (
    await chart.isVisible().catch(() => false)
      || await chartSurface.isVisible().catch(() => false)
      || await noData.isVisible().catch(() => false)
  )).toBe(true);
  await expect(page.locator('[data-preview-state="invalid"]')).toHaveCount(0);
  await expect(page.locator('[data-preview-state="api-error"]')).toHaveCount(0);
}

test.describe('Chart Builder - Real data chart type retest', () => {
  test('live channel preview returns the four operating channels', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/chart-builder/preview`, {
      data: {
        version: 2,
        mode: 'custom',
        datasetId: 'conversations',
        chartType: 'bar',
        dimensions: [{ fieldId: 'channel', alias: 'channel', nullHandling: 'label' }],
        metrics: [
          {
            fieldId: 'conversation_id',
            aggregation: 'count_distinct',
            alias: 'metric_conversation_id_1',
            label: 'Số lượng hội thoại',
          },
        ],
        series: null,
        tooltipFields: [],
        filters: [],
        sort: [{ fieldId: 'metric_conversation_id_1', direction: 'desc' }],
        topN: 20,
        limit: 500,
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    const channels = body.data.rows.map((row: { channel: string }) => row.channel).sort();
    expect(channels).toEqual(EXPECTED_CHANNELS);
  });

  test('renders all supported chart types with live backend data or explicit no-data state', async ({ page }) => {
    await goToChartBuilder(page);
    await expect(page.locator('.chart-builder-shell')).toBeVisible({ timeout: 20_000 });

    for (const chartType of SINGLE_METRIC_CHARTS) {
      await selectChartType(page, chartType.label);
      await expectRenderedOrExplicitNoData(page, chartType.selector);
    }

    const secondMetric = page
      .locator('.chart-builder-field-item')
      .filter({ hasText: 'Thời gian phản hồi (phút)' })
      .first();
    if (await secondMetric.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await secondMetric.click();
      await page.waitForTimeout(900);
    }

    for (const chartType of TWO_METRIC_CHARTS) {
      await selectChartType(page, chartType.label);
      await expectRenderedOrExplicitNoData(page, chartType.selector);
    }
  });
});
