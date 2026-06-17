import {
  expect,
  goToChartBuilder,
  MOCK_CATALOG,
  MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL,
  test,
  withCatalogMock,
  withConfigsMock,
  withEmptyPreview,
  withPreview400,
} from '../fixtures/index';

const BOOLEAN_PREVIEW = {
  success: true,
  message: 'Tạo bản xem trước biểu đồ thành công.',
  data: {
    mode: 'custom',
    datasetId: 'conversations',
    rows: [
      { no_response_needed: true, metric_conversation_id_1: 18 },
      { no_response_needed: false, metric_conversation_id_1: 9 },
      { no_response_needed: null, metric_conversation_id_1: 3 },
    ],
    series: [
      {
        key: 'metric_conversation_id_1',
        label: 'Số lượng hội thoại',
        color: '#ED5206',
        axisGroup: 'left',
        seriesType: null,
        numberFormat: 'number',
      },
    ],
    dimensionKeys: ['no_response_needed'],
    generatedAt: new Date().toISOString(),
    execution: {
      rowCount: 3,
      executionTimeMs: 12,
      limit: 500,
      truncated: false,
    },
  },
};

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  const settings = page.getByRole('complementary', { name: 'Cài đặt biểu đồ' });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Mở cài đặt biểu đồ' }).click();
  }
}

async function selectChartType(page: import('@playwright/test').Page, label: string): Promise<void> {
  await openSettings(page);
  await page.getByTitle(label, { exact: true }).click();
}

test.describe('Chart Builder - CB-QA fix regressions', () => {
  test('new channel chart does not inherit the dashboard date filter', async ({ page }) => {
    const previewBodies: Array<Record<string, any>> = [];
    await withCatalogMock(page);
    await withConfigsMock(page);
    await page.route('**/api/chart-builder/preview', (route) => {
      previewBodies.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL),
      });
    });

    await goToChartBuilder(page);

    await expect.poll(() => previewBodies.length).toBeGreaterThan(0);
    expect(previewBodies[0].dimensions?.[0]?.fieldId).toBe('channel');
    expect(previewBodies[0].filters).toEqual([]);
  });

  test('field slot map shows valid targets and warns on invalid drops', async ({ page }) => {
    await withCatalogMock(page);
    await withConfigsMock(page);
    await page.route('**/api/chart-builder/preview', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL),
      }),
    );

    await goToChartBuilder(page);

    const channelCard = page
      .locator('.chart-builder-field-card')
      .filter({ hasText: 'Kênh' })
      .first();
    await expect(channelCard.locator('.chart-builder-slot-badge').filter({ hasText: 'X' })).toBeVisible();
    await expect(channelCard.locator('.chart-builder-slot-badge').filter({ hasText: 'F' })).toBeVisible();
    await expect(channelCard.locator('.chart-builder-slot-badge').filter({ hasText: 'T' })).toBeVisible();

    await channelCard.locator('.chart-builder-field-item').click();
    await expect(channelCard.locator('.chart-builder-field-actions')).toContainText('Trục X');
    await expect(channelCard.locator('.chart-builder-field-actions')).toContainText('Bộ lọc');
    await expect(channelCard.locator('.chart-builder-field-actions')).toContainText('Tooltip');

    const slotFilter = page.locator('.chart-builder-slot-filter');
    await slotFilter.getByRole('button', { name: 'Giá trị Y', exact: true }).click();
    await expect(
      page.locator('.chart-builder-field-card').filter({ hasText: 'Số lượng hội thoại' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('.chart-builder-field-card').filter({ hasText: 'Không cần phản hồi' }),
    ).toHaveCount(0);

    await slotFilter.getByRole('button', { name: 'Chú giải', exact: true }).click();
    await expect(
      page.locator('.chart-builder-field-card').filter({ hasText: 'Không cần phản hồi' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('.chart-builder-field-card').filter({ hasText: 'Số lượng hội thoại' }),
    ).toHaveCount(0);

    await page.locator('.chart-builder-drop-zone').first().evaluate((element) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('application/x-flic-chart-field', JSON.stringify({
        datasetId: 'conversations',
        fieldId: 'conversation_id',
        label: 'Số lượng hội thoại',
        dataType: 'number',
        semanticType: 'id',
        roles: ['metric'],
      }));
      element.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }));
    });

    await expect(page.getByText('không phù hợp với vị trí Trục X')).toBeVisible();
  });

  test('stacked bar boolean series resets nullHandling before preview payload', async ({ page }) => {
    const previewBodies: Array<Record<string, any>> = [];
    await withCatalogMock(page);
    await withConfigsMock(page);
    await page.route('**/api/chart-builder/preview', (route) => {
      previewBodies.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL),
      });
    });

    await goToChartBuilder(page);
    await selectChartType(page, 'Cột chồng');

    const seriesSelect = page
      .locator('.chart-builder-control')
      .filter({ hasText: 'Phân nhóm chuỗi dữ liệu' })
      .locator('select')
      .first();
    await seriesSelect.selectOption('no_response_needed');

    await expect.poll(() => previewBodies.some(
      (body) => body.chartType === 'stacked_bar'
        && body.series?.fieldId === 'no_response_needed',
    )).toBe(true);

    const matchingBodies = previewBodies.filter(
      (body) => body.chartType === 'stacked_bar'
        && body.series?.fieldId === 'no_response_needed',
    );
    const latest = matchingBodies[matchingBodies.length - 1];
    expect(latest?.series?.nullHandling).not.toBe('label');
    expect(latest?.series?.nullHandling).toBe('include');
  });

  test('boolean dimensions render Vietnamese labels without React or Recharts warnings', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        warnings.push(message.text());
      }
    });

    await withCatalogMock(page);
    await withConfigsMock(page);
    await page.route('**/api/chart-builder/preview', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BOOLEAN_PREVIEW),
      }),
    );

    await goToChartBuilder(page);
    await openSettings(page);
    const dimensionSelect = page
      .locator('.chart-builder-control')
      .filter({ hasText: 'Chiều phân tích' })
      .locator('select')
      .first();
    await dimensionSelect.selectOption('no_response_needed');

    const preview = page.locator('#chart-builder-export-area');
    await expect(preview.getByText('Không cần phản hồi').first()).toBeVisible();
    await expect(preview.getByText('Cần phản hồi').first()).toBeVisible();
    await expect(preview.getByText('Không xác định').first()).toBeVisible();
    expect(warnings.filter((text) => /Warning:|Recharts|Objects are not valid/.test(text))).toEqual([]);
  });

  test('scatter with one numeric metric shows invalid config and blocks preview/save/export', async ({ page }) => {
    const previewRequests: string[] = [];
    await withCatalogMock(page);
    await withConfigsMock(page);
    await page.route('**/api/chart-builder/preview', (route) => {
      previewRequests.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL),
      });
    });

    await goToChartBuilder(page);
    await expect.poll(() => previewRequests.length).toBeGreaterThan(0);
    previewRequests.length = 0;

    await selectChartType(page, 'Phân tán');
    await page.waitForTimeout(900);

    expect(previewRequests).toHaveLength(0);
    await expect(page.getByText('Cấu hình biểu đồ chưa hợp lệ.')).toBeVisible();
    await expect(page.getByText('Biểu đồ phân tán cần ít nhất hai chỉ số số.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu biểu đồ' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'PNG' })).toBeDisabled();
  });

  test('preview lifecycle states are explicit and never blank', async ({ page }) => {
    await withCatalogMock(page);
    await withConfigsMock(page);
    await withEmptyPreview(page);
    await goToChartBuilder(page);
    await expect(page.locator('[data-preview-state="no-data"]')).toContainText(
      'Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại.',
    );

    await page.unroute('**/api/chart-builder/preview');
    await withPreview400(page, 'Validation failed');
    await page.getByTitle('Làm mới biểu đồ').click();
    await expect(page.locator('[data-preview-state="api-error"]')).toContainText(
      'Không thể tải dữ liệu biểu đồ.',
    );
  });

  test('not configured and loading states show explicit preview messages', async ({ page }) => {
    await page.route('**/api/chart-builder/catalog', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_CATALOG,
          data: { ...MOCK_CATALOG.data, datasets: [] },
        }),
      }),
    );
    await withConfigsMock(page);
    await goToChartBuilder(page);
    await expect(page.locator('[data-preview-state="not-configured"]')).toContainText(
      'Chưa cấu hình biểu đồ.',
    );

    await page.unroute('**/api/chart-builder/catalog');
    await page.unroute('**/api/chart-builder/configs');
    await withCatalogMock(page);
    await withConfigsMock(page);
    await page.route('**/api/chart-builder/preview', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PREVIEW_CONVERSATIONS_BY_CHANNEL),
      });
    });
    await page.reload();
    await expect(page.locator('[data-preview-state="loading"]')).toContainText(
      'Đang tạo biểu đồ...',
    );
  });
});
