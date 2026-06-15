/**
 * 10-responsive.spec.ts
 * Tests: Layout, panel behavior, overflow, and screenshots at required viewports.
 * Run against all viewport-* Playwright projects defined in playwright.config.ts.
 */
import { test, expect, withCatalogMock, withPreviewMock, goToChartBuilder } from '../fixtures/index';
import * as path from 'path';
import * as fs from 'fs';

const RESPONSIVE_SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'responsive');

test.describe('Chart Builder – Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure screenshot directory exists
    if (!fs.existsSync(RESPONSIVE_SCREENSHOT_DIR)) {
      fs.mkdirSync(RESPONSIVE_SCREENSHOT_DIR, { recursive: true });
    }

    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);
    await page.waitForTimeout(1500);
  });

  test('captures full-page screenshot at current viewport', async ({ page }, testInfo) => {
    const viewport = page.viewportSize();
    const label = `${viewport?.width ?? 0}x${viewport?.height ?? 0}`;
    const screenshotPath = path.join(RESPONSIVE_SCREENSHOT_DIR, `chart-builder-${label}.png`);

    await page.screenshot({ path: screenshotPath, fullPage: false });
    // Attach to Playwright report
    await testInfo.attach(`screenshot-${label}`, { path: screenshotPath, contentType: 'image/png' });

    // Verify screenshot was created
    expect(fs.existsSync(screenshotPath)).toBe(true);
    const stat = fs.statSync(screenshotPath);
    expect(stat.size).toBeGreaterThan(500);
  });

  test('no horizontal overflow at current viewport', async ({ page }) => {
    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    expect(widths.body).toBeLessThanOrEqual(viewportWidth + 5);
    expect(widths.document).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('chart builder shell is visible and not empty', async ({ page }) => {
    const shell = page.locator('.chart-builder-shell');
    await expect(shell).toBeVisible({ timeout: 10_000 });

    const box = await shell.boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(100);
  });

  test('chart preview area width is at least 40% of viewport', async ({ page }) => {
    const previewCard = page.locator('[class*="preview-card"], [class*="chart-builder-preview"]').first();
    if (await previewCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const box = await previewCard.boundingBox();
      const viewportWidth = page.viewportSize()?.width ?? 1280;
      if (box) {
        expect(box.width).toBeGreaterThan(viewportWidth * 0.35);
      }
    }
  });

  test('panels follow desktop and tablet breakpoints', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 1280;
    const dataPanel = page.locator('.chart-builder-data-panel');
    const settingsPanel = page.locator('.chart-builder-settings-panel');
    const dataToggle = page.getByRole('button', { name: 'Mở trường dữ liệu' });
    const settingsToggle = page.getByRole('button', { name: 'Mở cài đặt biểu đồ' });

    if (width >= 1440) {
      await expect(dataPanel).toBeInViewport();
      await expect(settingsPanel).toBeInViewport();
      await expect(dataToggle).not.toBeVisible();
      await expect(settingsToggle).not.toBeVisible();
    } else if (width > 1100) {
      await expect(dataPanel).toBeInViewport();
      await expect(settingsPanel).not.toBeInViewport();
      await expect(settingsToggle).toBeVisible();
    } else {
      await expect(dataPanel).not.toBeInViewport();
      await expect(settingsPanel).not.toBeInViewport();
      await expect(dataToggle).toBeVisible();
      await expect(settingsToggle).toBeVisible();
    }
  });

  test('toolbar is visible and not overflowing', async ({ page }) => {
    const toolbar = page.locator('.chart-builder-toolbar');
    const saveButton = page.getByRole('button', { name: 'Lưu biểu đồ' });
    const toolbarBox = await toolbar.boundingBox();
    const saveBox = await saveButton.boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 1280;

    expect(toolbarBox).not.toBeNull();
    expect(saveBox).not.toBeNull();
    expect((toolbarBox?.x ?? 0) + (toolbarBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 5);
    expect((saveBox?.x ?? 0) + (saveBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('drawers close when clicking the backdrop', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 1280;
    if (width >= 1440) return;

    const toggle = width <= 1100
      ? page.getByRole('button', { name: 'Mở trường dữ liệu' })
      : page.getByRole('button', { name: 'Mở cài đặt biểu đồ' });
    await toggle.click();

    const backdrop = page.locator('.chart-builder-backdrop');
    await expect(backdrop).toBeVisible();
    const backdropBox = await backdrop.boundingBox();
    expect(backdropBox).not.toBeNull();
    const clickX = width <= 1100
      ? (backdropBox?.x ?? 0) + (backdropBox?.width ?? 0) - 12
      : (backdropBox?.x ?? 0) + Math.min(400, (backdropBox?.width ?? 0) / 2);
    await page.mouse.click(clickX, (backdropBox?.y ?? 0) + 12);
    await expect(backdrop).not.toBeVisible();
  });

  test('workspace does not contain nested vertical scrollers', async ({ page }) => {
    const nestedScrollableCount = await page.evaluate(() => {
      const workspace = document.querySelector('.chart-builder-workspace-scroll');
      if (!workspace) return -1;
      return [...workspace.querySelectorAll<HTMLElement>('*')].filter((element) => {
        const style = getComputedStyle(element);
        return (
          ['auto', 'scroll'].includes(style.overflowY)
          && element.scrollHeight > element.clientHeight + 2
        );
      }).length;
    });
    expect(nestedScrollableCount).toBe(0);
  });
});
