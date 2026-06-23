/**
 * Auth fixture: injects a manager-role auth token into localStorage
 * so that every test starts already logged in and the login screen
 * is never shown.  No real credentials are used.
 */
import { test as base, Page } from '@playwright/test';

const AUTH_KEY = 'flic_dashboard_auth';
const ACTIVE_SCREEN_KEY = 'dashboard_activeScreen';

const MOCK_AUTH = JSON.stringify({
  role: 'manager',
  user: {
    username: 'thuynt',
    name: 'Thu Thuy (Test)',
    email: 'thuynt@flic.edu.vn',
    role: 'manager',
    shortName: 'TT',
  },
});

export async function injectAuth(page: Page, screen = 'chartbuilder'): Promise<void> {
  const originalGoto = page.goto.bind(page);
  page.goto = ((url: Parameters<Page['goto']>[0], options?: Parameters<Page['goto']>[1]) => {
    if (url === '/') {
      return originalGoto(`/?activeScreen=${encodeURIComponent(screen)}`, options);
    }
    return originalGoto(url, options);
  }) as Page['goto'];

  await page.addInitScript(
    ({ authKey, authValue, screenKey, screenValue }: {
      authKey: string; authValue: string; screenKey: string; screenValue: string;
    }) => {
      window.localStorage.setItem(authKey, authValue);
      window.localStorage.setItem(screenKey, screenValue);
    },
    {
      authKey: AUTH_KEY,
      authValue: MOCK_AUTH,
      screenKey: ACTIVE_SCREEN_KEY,
      screenValue: screen,
    },
  );
}

/** Base fixture that automatically injects auth + chart builder screen before every test. */
export const test = base.extend<{ authed: void }>({
  authed: [
    async ({ page }, use) => {
      await injectAuth(page, 'chartbuilder');
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
