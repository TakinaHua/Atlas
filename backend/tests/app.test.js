import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(
  () =>
    new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
);

test('health endpoint returns JSON and unknown API routes return 404', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'atlas' });
  const missing = await fetch(`${baseUrl}/api/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'API endpoint not found' });
});

test('website entry point and relocated frontend assets are served', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /src="\/src\/app.js"/);
  assert.match(html, /href="\/src\/styles\/main.css"/);
  for (const [path, type] of [
    ['/src/app.js', /javascript/],
    ['/src/styles/main.css', /css/],
    ['/src/components/MapPanel.js', /javascript/],
    ['/src/storage/tripStorage.js', /javascript/],
  ]) {
    const asset = await fetch(`${baseUrl}${path}`);
    assert.equal(asset.status, 200, path);
    assert.match(asset.headers.get('content-type'), type);
  }
});

test('server does not expose project files, backend code, or archives', async () => {
  for (const path of [
    '/package.json',
    '/.env',
    '/backend/src/server.js',
    '/archive/atlas-frontend-mvp.zip',
    '/tests/browser.cjs',
    '/src/missing.js',
  ]) {
    assert.equal((await fetch(`${baseUrl}${path}`)).status, 404, path);
  }
});
