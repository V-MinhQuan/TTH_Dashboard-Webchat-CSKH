import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export const FASTAPI_URL = String(process.env.FASTAPI_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Math.max(1000, Number(process.env.FASTAPI_TIMEOUT_MS || 30000));
const DEFAULT_CONCURRENCY = Math.max(1, Number(process.env.SENTIMENT_SCRIPT_CONCURRENCY || 3));
const FASTAPI_BEARER_TOKEN = String(process.env.FASTAPI_BEARER_TOKEN || '').trim();
export const VALID_LABELS = new Set(['positive', 'neutral', 'negative']);

function requestJson(pathname, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, authenticated = false } = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(pathname, `${FASTAPI_URL}/`);
    } catch {
      reject(new Error('FASTAPI_URL is invalid.'));
      return;
    }

    const transport = target.protocol === 'https:' ? https : target.protocol === 'http:' ? http : null;
    if (!transport) {
      reject(new Error('FASTAPI_URL must use http or https.'));
      return;
    }

    const bodyText = body === undefined ? null : JSON.stringify(body);
    const headers = { Accept: 'application/json' };
    if (authenticated) {
      if (!FASTAPI_BEARER_TOKEN) {
        reject(new Error('FASTAPI_BEARER_TOKEN is required for sentiment prediction.'));
        return;
      }
      headers.Authorization = `Bearer ${FASTAPI_BEARER_TOKEN}`;
    }
    if (bodyText !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyText);
    }

    const request = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method,
      headers
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        raw += chunk;
        if (raw.length > 1024 * 1024) request.destroy(new Error('Backend response exceeded 1 MiB.'));
      });
      response.on('end', () => {
        let payload;
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          reject(new Error(`Backend returned invalid JSON (HTTP ${response.statusCode}).`));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`Backend sentiment API returned HTTP ${response.statusCode}.`);
          error.statusCode = response.statusCode;
          error.code = payload?.analysisError || payload?.detail?.code || 'backend_error';
          reject(error);
          return;
        }
        resolve(payload);
      });
    });

    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Backend request timed out after ${timeoutMs} ms.`)));
    request.on('error', reject);
    if (bodyText !== null) request.write(bodyText);
    request.end();
  });
}

export async function checkBackendLive() {
  const payload = await requestJson('/api/health/live', { timeoutMs: 5000 });
  if (payload?.status !== 'live') throw new Error('Backend liveness response is invalid.');
  return payload;
}

export async function predictSentiment(text) {
  const payload = await requestJson('/api/sentiment/predict', {
    method: 'POST',
    body: { text: String(text || '') },
    authenticated: true
  });
  const label = payload?.sentiment?.label;
  if (!VALID_LABELS.has(label) || payload?.analysisStatus !== 'completed') {
    throw new Error(`Backend returned no completed sentiment prediction (${payload?.analysisError || 'invalid_response'}).`);
  }
  return payload;
}

export async function predictSentiments(texts, concurrency = DEFAULT_CONCURRENCY) {
  const results = [];
  const width = Math.max(1, Number(concurrency) || DEFAULT_CONCURRENCY);
  for (let index = 0; index < texts.length; index += width) {
    const chunk = texts.slice(index, index + width);
    results.push(...await Promise.all(chunk.map(predictSentiment)));
  }
  return results;
}
