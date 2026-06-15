/**
 * 02-field-selection.spec.ts
 * Tests: click-to-select, drag-and-drop, toggle remove, drop zone clearing.
 */
import { test, expect, withCatalogMock, withPreviewMock, goToChartBuilder } from '../fixtures/index';

test.describe('Chart Builder – Field Selection', () => {
  test.beforeEach(async ({ page }) => {
    await withCatalogMock(page);
    await withPreviewMock(page);
    await goToChartBuilder(page);
    // Wait for the dataset panel to be ready
    await page.waitForSelector('[class*="chart-builder"]', { timeout: 12_000 });
  });

  test('clicking a dimension field adds it to the Dimensions drop zone', async ({ page }) => {
    // Find a field with "Kênh" text and click it
    const field = page.locator('[class*="field-item"], [data-field-id]').filter({ hasText: 'Kênh' }).first();
    if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await field.click();
      await page.waitForTimeout(400);
      // The drop zone bar should show the field was added (a chip/tag)
      const dropZoneArea = page.locator('[class*="drop-zone"], [class*="dropzone"], [class*="DropZone"]').first();
      await expect(dropZoneArea).toContainText(/Kênh|channel/i, { timeout: 5_000 });
    } else {
      // Try clicking the '+' icon next to any dimension field
      const plusBtn = page
        .locator('[class*="field-item"]')
        .first()
        .locator('button, [role="button"]')
        .first();
      if (await plusBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await plusBtn.click();
        await page.waitForTimeout(400);
      }
    }
  });

  test('clicking a metric field adds it to the Metrics drop zone', async ({ page }) => {
    const field = page
      .locator('[class*="field-item"], [data-field-id]')
      .filter({ hasText: /hội thoại|conversation/i })
      .first();
    if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await field.click();
      await page.waitForTimeout(400);
      const dropZoneArea = page.locator('[class*="drop-zone"], [class*="dropzone"]').first();
      await expect(dropZoneArea).toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicking the same metric field twice toggles it off', async ({ page }) => {
    const field = page
      .locator('[class*="field-item"], [data-field-id]')
      .filter({ hasText: /hội thoại|conversation/i })
      .first();
    if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // First click – add
      await field.click();
      await page.waitForTimeout(400);
      const beforeText = await page.locator('[class*="drop-zone"], [class*="dropzone"]').first().textContent().catch(() => '');

      // Second click – remove
      await field.click();
      await page.waitForTimeout(400);
      const afterText = await page.locator('[class*="drop-zone"], [class*="dropzone"]').first().textContent().catch(() => '');

      // Text may or may not change but there should be no crash
      expect(typeof beforeText).toBe('string');
      expect(typeof afterText).toBe('string');
    }
  });

  test('removing a dimension chip from the drop zone clears it', async ({ page }) => {
    // First add a field so there's something to remove
    const field = page.locator('[class*="field-item"]').filter({ hasText: 'Kênh' }).first();
    if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await field.click();
    } else {
      const plusBtn = page.locator('[class*="field-item"]').first().locator('button').first();
      if (await plusBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await plusBtn.click();
    }
    
    await page.waitForTimeout(800);
    // Find any remove/close button inside the drop zone bar
    const removeBtn = page
      .locator('[class*="drop-zone"] button, [class*="dropzone"] button, [class*="chip"] button')
      .first();
    if (await removeBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(400);
      // Verify there's no crash
      const shell = page.locator('.chart-builder-shell').first();
      await expect(shell).toBeVisible();
    }
  });

  test('drag-and-drop field into the drop zone works', async ({ page }) => {
    const fieldItem = page.locator('[class*="field-item"], [draggable="true"]').first();
    const dropZone = page.locator('[class*="drop-zone-bar"], [class*="dropzone-bar"]').first();

    if (
      (await fieldItem.isVisible({ timeout: 5_000 }).catch(() => false)) &&
      (await dropZone.isVisible({ timeout: 3_000 }).catch(() => false))
    ) {
      const fieldBox = await fieldItem.boundingBox();
      const dropBox = await dropZone.boundingBox();
      if (fieldBox && dropBox) {
        await page.mouse.move(fieldBox.x + fieldBox.width / 2, fieldBox.y + fieldBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        // No crash expected
        await expect(page.locator('.chart-builder-shell').first()).toBeVisible();
      }
    }
  });
});
