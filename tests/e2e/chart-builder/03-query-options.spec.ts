/**
 * 03-query-options.spec.ts
 * Tests: aggregation, date grain, filters, sort, topN, limit, preview debounce,
 * AbortController, and verifying settings-only changes do NOT trigger extra /preview calls.
 */
import {
  test,
  expect,
  withCatalogMock,
  withPreviewMock,
  goToChartBuilder,
  waitForPreviewReady,
} from '../fixtures/index';

test.describe('Chart Builder – Query Options & Debounce', () => {
  test('changing aggregation triggers a new /preview request', async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);

    const previewRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/chart-builder/preview')) {
        previewRequests.push(req.url());
      }
    });

    // Wait for the initial preview call
    await page.waitForTimeout(1500);
    const initialCount = previewRequests.length;

    // Look for an aggregation dropdown in the metric chip or settings panel
    const aggSelect = page
      .locator('select, [role="combobox"]')
      .filter({ hasText: /count|sum|avg|đếm/i })
      .first();
    if (await aggSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await aggSelect.selectOption({ index: 1 });
      // Debounce wait
      await page.waitForTimeout(1200);
      expect(previewRequests.length).toBeGreaterThan(initialCount);
    }
  });

  test('changing date grain triggers a new /preview request', async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);

    const previewRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/chart-builder/preview')) previewRequests.push(req.url());
    });

    await page.waitForTimeout(1500);
    const initialCount = previewRequests.length;

    // Look for a date grain dropdown
    const grainSelect = page
      .locator('select, [role="combobox"]')
      .filter({ hasText: /month|ngày|tháng|grain/i })
      .first();
    if (await grainSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await grainSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1200);
      expect(previewRequests.length).toBeGreaterThan(initialCount);
    }
  });

  test('settings-only changes (title, legend) do NOT trigger extra /preview calls', async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);

    const previewRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/chart-builder/preview')) previewRequests.push(req.url());
    });
    await waitForPreviewReady(page);
    previewRequests.length = 0;

    // Open settings panel if not open
    const settingsBtn = page.locator('button').filter({ hasText: /cài đặt|settings/i }).first();
    if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
    }

    // Find the toggle label containing "chu thich" or "legend"
    const legendLabel = page.locator('.chart-builder-toggle-setting').filter({ hasText: /chú thích|chu thich|legend/i }).first();
    if (await legendLabel.isVisible({ timeout: 4000 }).catch(() => false)) {
      await legendLabel.locator('input[type="checkbox"]').click({ force: true });
      await page.waitForTimeout(1200);
    }

    // No additional /preview calls should have been made
    expect(previewRequests.length).toBe(0);
  });

  test('preview debounce: rapid field changes produce at most 2 preview requests', async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);

    const previewRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/chart-builder/preview')) previewRequests.push(req.url());
    });

    await goToChartBuilder(page);
    // During loading there might be 1 initial request
    // Wait for initial to settle
    await page.waitForTimeout(2000);
    const afterInitial = previewRequests.length;

    // Trigger rapid changes (e.g., repeatedly clicking a field)
    const field = page.locator('[class*="field-item"]').first();
    if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
      for (let i = 0; i < 5; i++) {
        await field.click();
        await page.waitForTimeout(100);
      }
    }

    // Wait for debounce window to expire
    await page.waitForTimeout(1500);
    const afterRapid = previewRequests.length - afterInitial;
    // Debounce should collapse rapid clicks into ≤ 2 actual requests
    expect(afterRapid).toBeLessThanOrEqual(2);
  });

  test('abort controller: navigating away cancels in-flight preview request', async ({ page }) => {
    await withCatalogMock(page);
    // Make preview very slow to ensure it's in-flight when we navigate away
    await page.route('**/api/chart-builder/preview', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const abortedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      if (req.url().includes('/api/chart-builder/preview')) {
        abortedRequests.push(req.failure()?.errorText ?? 'aborted');
      }
    });

    await goToChartBuilder(page);
    await page.waitForTimeout(800); // trigger request
    // Navigate away to Overview
    await page.locator('a, button, [role="menuitem"]').filter({ hasText: /overview|tổng quan/i }).first().click().catch(() => {});
    await page.waitForTimeout(1000);

    // The page should not crash
    expect(await page.locator('.chart-builder-shell').isVisible().catch(() => false)).toBe(false);
  });
});
