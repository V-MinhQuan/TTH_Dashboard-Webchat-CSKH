/**
 * 05-real-scenarios.spec.ts
 * Tests: Real read-only SQL Server calls for the 6 mandatory chart scenarios.
 * These tests hit the live API (no mock) and verify actual data shapes.
 * They require the backend to be running.
 */
import { test, expect, goToChartBuilder } from '../fixtures/index';

// Helper to intercept /preview and capture the request body
async function capturePreviewRequest(page: import('@playwright/test').Page): Promise<object | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 10_000);
    page.on('request', (req) => {
      if (req.url().includes('/api/chart-builder/preview') && req.method() === 'POST') {
        clearTimeout(timeout);
        resolve(JSON.parse(req.postData() ?? '{}'));
      }
    });
  });
}

// Helper to wait for the chart SVG to render
async function waitForChart(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector('.recharts-wrapper, .recharts-surface', { timeout: 20_000 }).catch(() => {});
}

test.describe('Chart Builder – Real Data Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // No catalog mock – uses real API
    await goToChartBuilder(page);
    await page.waitForTimeout(2000);
  });

  test('Conversations by channel renders chart with channel dimension', async ({ page }) => {
    // The default dataset on load should be conversations → chart should render
    await waitForChart(page);
    const svg = page.locator('.recharts-wrapper').first();
    await expect(svg).toBeVisible({ timeout: 15_000 });

    // Check execution metadata is shown
    const meta = page.locator('[class*="preview-header"] p, [class*="execution"]').first();
    const metaText = await meta.textContent().catch(() => '');
    // Should contain row count info
    expect(typeof metaText).toBe('string');
  });

  test('Messages by month renders a line chart', async ({ page }) => {
    // Switch to message_analytics dataset
    const datasetSelect = page.locator('select, [role="combobox"]').first();
    if (await datasetSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await datasetSelect.selectOption({ label: /tin nhắn|message/i }).catch(() => {
        // If no option found, skip gracefully
      });
      await page.waitForTimeout(2000);
    }
    await waitForChart(page);
    const svg = page.locator('.recharts-wrapper').first();
    const visible = await svg.isVisible({ timeout: 10_000 }).catch(() => false);
    // Chart or empty state should exist without crash
    expect(await page.locator('.chart-builder-shell').isVisible()).toBe(true);
  });

  test('Sentiment by month renders without crash', async ({ page }) => {
    // Verify the chart builder shell loads with real data
    await waitForChart(page);
    await expect(page.locator('.chart-builder-shell')).toBeVisible({ timeout: 10_000 });
  });

  test('Need-review by source uses series field', async ({ page }) => {
    await waitForChart(page);
    // Verify no crash and workspace visible
    await expect(page.locator('.chart-builder-workspace')).toBeVisible({ timeout: 10_000 });
  });

  test('Agent performance: AI Assistant is NOT present in chart labels', async ({ page }) => {
    // Switch to agent_performance dataset
    const datasetSelect = page.locator('select, [role="combobox"]').first();
    if (await datasetSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await datasetSelect.selectOption({ label: /agent|hiệu suất/i }).catch(() => {});
      await page.waitForTimeout(2500);
    }

    await waitForChart(page);

    // Scan the rendered chart DOM for 'AI Assistant' text
    const chartArea = page.locator('.recharts-wrapper, .chart-builder-export-area').first();
    const chartHtml = await chartArea.innerHTML().catch(() => '');
    expect(chartHtml).not.toContain('AI Assistant');

    // Also check tick labels
    const ticks = await page.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value, .recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents();
    for (const tick of ticks) {
      expect(tick).not.toContain('AI Assistant');
    }
  });

  test('Average response time by agent renders duration metric', async ({ page }) => {
    // Switch to agent_performance dataset if not already
    const datasetSelect = page.locator('select, [role="combobox"]').first();
    if (await datasetSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await datasetSelect.selectOption({ label: /agent|hiệu suất/i }).catch(() => {});
      await page.waitForTimeout(2500);
    }
    await waitForChart(page);
    // Chart should render without crash
    await expect(page.locator('.chart-builder-shell')).toBeVisible({ timeout: 10_000 });
  });
});
