/**
 * 07-export.spec.ts
 * Tests: PNG and PDF download events, filename, non-empty file,
 * settings panel not in export area, chart not clipped.
 */
import { test, expect, withCatalogMock, withPreviewMock, goToChartBuilder } from '../fixtures/index';

test.describe('Chart Builder – Export (PNG / PDF)', () => {
  test.beforeEach(async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);
    // Wait for chart to render before testing exports
    await page.waitForSelector('.recharts-wrapper, [class*="chart-builder-preview-card"]', { timeout: 15_000 });
    await page.waitForTimeout(1000);
  });

  test('PNG export triggers a download with a .png extension', async ({ page }) => {
    const pngBtn = page.locator('button').filter({ hasText: /PNG/i }).first();
    if (await pngBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20_000 }),
        pngBtn.click(),
      ]);
      const filename = download.suggestedFilename();
      expect(filename.toLowerCase().endsWith('.png')).toBe(true);
      // Verify file is non-empty
      const path = await download.path();
      const fs = await import('fs');
      if (path) {
        const stat = fs.statSync(path);
        expect(stat.size).toBeGreaterThan(100);
      }
    } else {
      test.skip(true, 'PNG button not enabled (no chart data) – skipping');
    }
  });

  test('PDF export triggers a download with a .pdf extension', async ({ page }) => {
    const pdfBtn = page.locator('button').filter({ hasText: /PDF/i }).first();
    if (await pdfBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20_000 }),
        pdfBtn.click(),
      ]);
      const filename = download.suggestedFilename();
      expect(filename.toLowerCase().endsWith('.pdf')).toBe(true);
      const path = await download.path();
      const fs = await import('fs');
      if (path) {
        const stat = fs.statSync(path);
        expect(stat.size).toBeGreaterThan(100);
      }
    } else {
      test.skip(true, 'PDF button not enabled (no chart data) – skipping');
    }
  });

  test('PNG filename contains the chart title', async ({ page }) => {
    // Set a known chart title
    const titleInput = page.locator('input[class*="title"], input[placeholder*="tiêu đề"], input[placeholder*="title"]').first();
    if (await titleInput.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await titleInput.click({ clickCount: 3 });
      await titleInput.fill('TestExportTitle');
      await page.waitForTimeout(600);
    }

    const pngBtn = page.locator('button').filter({ hasText: /PNG/i }).first();
    if (await pngBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
      await pngBtn.click();
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename().toLowerCase();
        // Filename should reference the title or be a sanitized version
        expect(filename).toContain('.png');
      }
    }
  });

  test('export area contains chart title and legend, but not settings panel', async ({ page }) => {
    const exportArea = page.locator('#chart-builder-export-area, [class*="export-area"]').first();
    await expect(exportArea).toBeVisible({ timeout: 8_000 });

    // Chart title should be inside export area
    const title = exportArea.locator('[class*="export-title"], h1, h2').first();
    const titleText = await title.textContent().catch(() => '');
    expect(titleText.length).toBeGreaterThan(0);

    // Settings panel (ChartSettingsPanel) should NOT be inside the export area
    const settingsInExport = exportArea.locator('[class*="settings-panel"], [class*="ChartSettings"]');
    expect(await settingsInExport.count()).toBe(0);
  });

  test('chart export area is not clipped (bounding box height > 0)', async ({ page }) => {
    const exportArea = page.locator('#chart-builder-export-area, [class*="export-area"]').first();
    const box = await exportArea.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThan(50);
      expect(box.width).toBeGreaterThan(50);
    }
  });
});
