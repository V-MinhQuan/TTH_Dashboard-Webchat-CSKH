import {
  expect,
  goToChartBuilder,
  test,
  withCatalogMock,
  withConfigsMock,
  withPreviewMock,
} from '../fixtures/index';

test.describe('Chart Builder - Acceptance regressions', () => {
  test.beforeEach(async ({ page }) => {
    await withCatalogMock(page);
    await withConfigsMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);
    await page.waitForTimeout(900);
  });

  test('uses complete Vietnamese labels without corrupted Unicode', async ({ page }) => {
    const dataPanel = page.getByRole('complementary', { name: 'Trường dữ liệu' });
    await expect(page.getByText('Bộ dữ liệu phân tích', { exact: true })).toBeVisible();
    await expect(dataPanel.getByText('Chiều phân tích (Dimension)', { exact: true })).toBeVisible();
    await expect(dataPanel.getByText('Chỉ số đo lường (Metric)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu biểu đồ' })).toBeVisible();
    await expect(page.getByText('Số lượng hội thoại', { exact: true }).first()).toBeVisible();

    const pageText = await page.locator('.chart-builder-shell').innerText();
    for (const invalidText of [
      'Bieu do',
      'Cai dat',
      'Loai bieu do',
      'Cot dung',
      'Gia tri null',
      'Luu vao Dashboard',
      'Bi?u',
      'C�i',
      'Th?i gian',
      'Ã¡',
      'Ã ',
      'Ã¢',
      'Ä‘',
      'Æ°',
      'á»',
    ]) {
      expect(pageText).not.toContain(invalidText);
    }
  });

  test('exposes accessible guidance for dimensions and metrics', async ({ page }) => {
    const dataPanel = page.getByRole('complementary', { name: 'Trường dữ liệu' });
    const dimensionHelp = dataPanel.getByRole('button', {
      name: 'Giải thích chiều phân tích',
    });
    const metricHelp = dataPanel.getByRole('button', {
      name: 'Giải thích chỉ số đo lường',
    });

    await expect(dimensionHelp).toHaveAttribute(
      'title',
      'Trường dùng để phân nhóm dữ liệu, chẳng hạn như kênh, trạng thái, ngày hoặc chủ đề.',
    );
    await expect(metricHelp).toHaveAttribute(
      'title',
      'Giá trị dùng để tính toán và so sánh, chẳng hạn như số lượng hội thoại, thời gian phản hồi trung bình hoặc tỷ lệ xử lý.',
    );
  });

  test('does not expose unavailable topic and keyword fields', async ({ page }) => {
    const dataPanel = page.locator('.chart-builder-data-panel');
    await expect(dataPanel.getByText('Chủ đề', { exact: true })).toHaveCount(0);
    await expect(dataPanel.getByText('Từ khóa', { exact: true })).toHaveCount(0);

    const search = page.getByPlaceholder('Tìm trường dữ liệu...');
    await search.fill('topic');
    await expect(page.getByText('Không tìm thấy trường phù hợp.')).toBeVisible();
  });

  test('does not call preview for an incompatible scatter configuration', async ({ page }) => {
    const scatterButton = page.getByRole('button', { name: 'Phân tán' });
    if (!(await scatterButton.isVisible())) {
      await page.getByRole('button', { name: 'Mở cài đặt biểu đồ' }).click();
    }

    const previewRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/chart-builder/preview')) {
        previewRequests.push(request.url());
      }
    });

    await scatterButton.click();
    await page.waitForTimeout(900);

    expect(previewRequests).toHaveLength(0);
    await expect(page.getByText('Cấu hình biểu đồ chưa hợp lệ.')).toBeVisible();
    await expect(page.getByText(/ít nhất hai chỉ số/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu biểu đồ' })).toBeDisabled();
  });
});
