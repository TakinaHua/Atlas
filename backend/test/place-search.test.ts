import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createPlaceSearch } from '../src/place-search.js';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';
const result = {
  geometry: { type: 'Point', coordinates: [-80.01, 40.44] },
  properties: {
    name: 'Point State Park',
    city: 'Pittsburgh',
    state: 'Pennsylvania',
    countrycode: 'US',
  },
};
test('place search normalizes valid U.S. results, biases query and caches repeats', async () => {
  let calls = 0;
  const search = createPlaceSearch((async (url: URL) => {
    calls++;
    assert.equal(url.searchParams.get('countrycode'), 'US');
    assert.equal(url.searchParams.get('lat'), '40');
    return Response.json({
      features: [result, {}, { ...result, properties: { countrycode: 'DE' } }],
    });
  }) as typeof fetch);
  const input = { q: 'Point State Park', latitude: 40, longitude: -80 };
  const results = await search(input);
  assert.deepEqual(results, [
    {
      name: 'Point State Park',
      address: 'Pittsburgh, Pennsylvania',
      latitude: 40.44,
      longitude: -80.01,
    },
  ]);
  assert.deepEqual(await search(input), results);
  assert.equal(calls, 1);
  await assert.rejects(search({ q: 'Another park' }), { status: 429 });
});
test('provider failure/malformed response produces retryable errors', async () => {
  for (const response of [
    new Response('', { status: 429 }),
    Response.json({ invalid: true }),
  ]) {
    const search = createPlaceSearch((async () => response) as typeof fetch);
    await assert.rejects(search({ q: 'Museum' }), { status: 503 });
  }
});
test('search validates query and location pair and respects CORS without external calls', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  for (const query of [
    'q=ab',
    'q=test&latitude=20',
    'q=test&latitude=91&longitude=20',
    'q=x&q=y',
  ])
    await api.get(`/api/places/search?${query}`).expect(400);
  await api
    .get('/api/places/search?q=park')
    .set('Origin', 'https://not-atlas.example')
    .expect(403);
});

test('malformed-only features are not cached as empty results and retry can recover', async () => {
  let now = 0;
  let calls = 0;
  const search = createPlaceSearch(
    (async () => {
      calls++;
      return Response.json({ features: calls === 1 ? [{}] : [result] });
    }) as typeof fetch,
    'https://example.test/api/',
    () => now,
  );
  await assert.rejects(search({ q: 'Museum' }), { status: 503 });
  now = 1100;
  assert.equal((await search({ q: 'Museum' })).length, 1);
  assert.equal((await search({ q: 'Museum' })).length, 1);
  assert.equal(calls, 2);
});
