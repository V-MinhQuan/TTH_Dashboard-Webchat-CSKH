/**
 * Auth fixture: injects a manager-role auth token into localStorage
 * so that every test starts already logged in and the login screen
 * is never shown.  No real credentials are used.
 */
import { test as base, Page } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const AUTH_KEY = 'flic_dashboard_auth';
const ACTIVE_SCREEN_KEY = 'dashboard_activeScreen';

function base64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function readDotEnvValue(key: string) {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));
  if (!line) return undefined;
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}

function issueE2eToken() {
  if (process.env.E2E_AUTH_TOKEN) return process.env.E2E_AUTH_TOKEN;
  const secret = process.env.APP_AUTH_SECRET || readDotEnvValue('APP_AUTH_SECRET');
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return undefined;

  const issuedAt = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.APP_AUTH_TTL_SECONDS || readDotEnvValue('APP_AUTH_TTL_SECONDS')) || 3600;
  const payload = JSON.stringify({
    exp: issuedAt + ttl,
    iat: issuedAt,
    role: 'manager',
    sub: 'codex-e2e',
    v: 1,
  });
  const encodedPayload = base64Url(payload);
  const signature = base64Url(
    crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(encodedPayload, 'ascii').digest(),
  );
  return `${encodedPayload}.${signature}`;
}

function makeMockAuth() {
  return JSON.stringify({
    role: 'manager',
    user: {
      username: 'codex-e2e',
      name: 'Codex E2E',
      email: 'codex-e2e@flic.edu.vn',
      role: 'manager',
      accessToken: issueE2eToken(),
    },
  });
}

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
      authValue: makeMockAuth(),
      screenKey: ACTIVE_SCREEN_KEY,
      screenValue: screen,
    },
  );

  await page.route('**/api/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'ok', data: {} }),
  }));

  await page.route('**/api/admin/sheet-chatbot**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      message: 'ok',
      data: [],
      total: 0,
      page: 1,
      pageSize: 5,
      stats: { total: 0, pending: 0, approved: 0 },
    }),
  }));
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
