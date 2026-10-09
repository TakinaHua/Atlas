import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../backend/server.js';

test('Express health works and itinerary backend is explicitly deferred', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).mode, 'frontend-preview');
    const deferred = await fetch(`${origin}/api/trips`, { method: 'POST' });
    assert.equal(deferred.status, 501);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
