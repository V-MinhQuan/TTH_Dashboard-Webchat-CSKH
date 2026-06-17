/**
 * Composable fixture that merges auth injection with the api-mock helpers.
 * Import `test` and `expect` from this file in all chart-builder specs.
 */
export { test, expect } from './auth';
export * from './api-mocks';

/**
 * Navigate to the Chart Builder screen and wait for it to be ready.
 * The auth fixture already sets dashboard_activeScreen='chartbuilder' in localStorage
 * before page load, so the app will open directly into Chart Builder.
 */
export async function goToChartBuilder(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  // Wait for the chart builder workspace to appear
  await page.waitForSelector('.chart-builder-shell', { timeout: 20_000 });
}

/** Wait for the loading spinner to disappear. */
export async function waitForPreviewReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector(
    [
      '[data-preview-state="has-data"]',
      '[data-preview-state="no-data"]',
      '[data-preview-state="invalid"]',
      '[data-preview-state="api-error"]',
    ].join(', '),
    { timeout: 15_000 },
  );
  await page
    .locator('[data-preview-state="loading"], .chart-builder-spinner')
    .first()
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => {
      // Loading indicators may already be gone when the settled state appears.
    });
}
