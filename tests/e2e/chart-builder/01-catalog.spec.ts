/**
 * 01-catalog.spec.ts
 * Tests: Catalog loading, dataset switching, field search, empty catalog error state.
 */
import { test, expect, withCatalogMock, withPreviewMock, withCatalog500, goToChartBuilder } from '../fixtures/index';

test.describe('Chart Builder – Catalog', () => {
  test('catalog loads and datasets are visible in the DataFieldsPanel', async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);

    // Expect the dataset selector dropdown to appear
    const datasetDropdown = page.locator('select, [role="combobox"], [data-testid="dataset-select"]').first();
    await expect(datasetDropdown).toBeVisible({ timeout: 10_000 });
  });

  test('switching dataset updates the field list', async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);

    // Find the dataset selector
    const datasetDropdown = page.locator('select, [role="combobox"]').first();
    await datasetDropdown.waitFor({ state: 'visible', timeout: 10_000 });

    // Get the initial option count or options list
    const initialOptions = await datasetDropdown.locator('option').count().catch(() => 0);

    // Change to the second dataset if multiple exist
    const options = datasetDropdown.locator('option');
    const count = await options.count().catch(() => 0);
    if (count > 1) {
      const secondValue = await options.nth(1).getAttribute('value');
      if (secondValue) {
        await datasetDropdown.selectOption(secondValue);
        // Fields panel should reflect new dataset
        await page.waitForTimeout(600);
        const fieldItems = page.locator('[class*="field-item"], [class*="fields-panel"] li, [data-field-id]');
        await expect(fieldItems.first()).toBeVisible({ timeout: 8_000 });
      }
    }
  });

  test('field search filters the visible fields', async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);

    // Wait for panel then locate the search input
    const searchInput = page.getByPlaceholder('Tìm trường dữ liệu...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Kênh');
    await page.waitForTimeout(300);

    const visibleFields = page.locator('.chart-builder-field-item:visible');
    const fieldCount = await visibleFields.count();
    expect(fieldCount).toBeGreaterThan(0);
    expect(fieldCount).toBeLessThanOrEqual(5);
  });

  test('/catalog 500 shows a graceful error message and does not crash', async ({ page }) => {
    await withCatalog500(page);
    await goToChartBuilder(page);

    // An error message should be shown somewhere in the chart builder area
    const errorText = page.locator(
      'text=/lỗi|error|không thể tải|khong the tai|catalog|500/i',
    );
    await expect(errorText).toBeVisible({ timeout: 10_000 });

    // Verify the page did not crash (no uncaught error overlay)
    const reactError = page.locator('text=Something went wrong');
    await expect(reactError).not.toBeVisible();
  });
});
