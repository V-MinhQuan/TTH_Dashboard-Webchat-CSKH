import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';


test('predictSentiment sends the configured HMAC bearer session', async t => {
  let authorization;
  const server = http.createServer((request, response) => {
    authorization = request.headers.authorization;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      analysisStatus: 'completed',
      sentiment: { label: 'positive', confidence: 0.9 }
    }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  process.env.FASTAPI_URL = `http://127.0.0.1:${address.port}`;
  process.env.FASTAPI_BEARER_TOKEN = 'test-session-token';
  const { predictSentiment } = await import(`./sentiment-api-client.js?auth=${Date.now()}`);

  const result = await predictSentiment('Dịch vụ tốt');

  assert.equal(result.sentiment.label, 'positive');
  assert.equal(authorization, 'Bearer test-session-token');
});


test('predictSentiment fails before network access when bearer session is missing', async () => {
  process.env.FASTAPI_URL = 'http://127.0.0.1:1';
  delete process.env.FASTAPI_BEARER_TOKEN;
  const { predictSentiment } = await import(`./sentiment-api-client.js?missing=${Date.now()}`);

  await assert.rejects(
    predictSentiment('Dịch vụ tốt'),
    /FASTAPI_BEARER_TOKEN is required/,
  );
});
