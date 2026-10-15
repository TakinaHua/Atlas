import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceSearch } from '../src/place-search.js';
import { createRouting } from '../src/routing.js';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';
import request from 'supertest';
const feature = {
  geometry: { type: 'Point', coordinates: [-80, 40] },
  properties: { countrycode: 'US', name: 'Park' },
};
const routeData = {
  code: 'Ok',
  waypoints: [{}, {}],
  routes: [
    {
      distance: 100,
      duration: 10,
      legs: [{ distance: 100, duration: 10 }],
      geometry: {
        type: 'LineString',
        coordinates: [
          [-80, 40],
          [-79, 41],
        ],
      },
    },
  ],
};
const stops = [
  { latitude: 40, longitude: -80 },
  { latitude: 41, longitude: -79 },
];
test('search keys include location; empty results cache, expire at 24 hours, and query whitespace is normalized', async () => {
  let now = 0,
    calls = 0;
  const search = createPlaceSearch(
    (async () => {
      calls++;
      return Response.json({ features: [] });
    }) as typeof fetch,
    'https://photon.example/api/',
    () => now,
  );
  const input = { q: 'Park', latitude: 40, longitude: -80 };
  await search(input);
  await search({ ...input, q: ' Park ' });
  assert.equal(calls, 1);
  now = 1100;
  await search({ ...input, latitude: 41 });
  assert.equal(calls, 2);
  now = 86399999;
  await search(input);
  assert.equal(calls, 2);
  now = 86400000;
  await search(input);
  assert.equal(calls, 3);
});
test('route keys distinguish stop order and coordinate edits; successful routes expire after one hour', async () => {
  let now = 0;
  const calls: string[] = [];
  const route = createRouting(
    (async (url: URL) => {
      calls.push(url.pathname);
      return Response.json(routeData);
    }) as typeof fetch,
    'https://osrm.example',
    () => now,
  );
  await route({ stops });
  await route({ stops });
  assert.equal(calls.length, 1);
  now = 1100;
  await route({ stops: [...stops].reverse() });
  now = 2200;
  await route({ stops: [stops[0], { latitude: 41.01, longitude: -79 }] });
  assert.equal(new Set(calls).size, 3);
  now = 3599999;
  await route({ stops });
  assert.equal(calls.length, 3);
  now = 3600000;
  await route({ stops });
  assert.equal(calls.length, 4);
});
test('both real adapters share simultaneous misses, recover from 429s, and keep cached hits during backoff', async () => {
  for (const kind of ['search', 'route']) {
    let now = 0,
      calls = 0;
    let mode = 'ok';
    const fetcher = (async () => {
      calls++;
      await Promise.resolve();
      return mode === 'ok'
        ? Response.json(kind === 'search' ? { features: [feature] } : routeData)
        : new Response('', { status: 429 });
    }) as typeof fetch;
    const search = createPlaceSearch(fetcher, 'https://photon.example/api/', () => now);
    const route = createRouting(fetcher, 'https://osrm.example', () => now);
    const get = (changed = false) =>
      kind === 'search'
        ? search({ q: changed ? 'Museum' : 'Park' })
        : route({ stops: changed ? [...stops].reverse() : stops });
    await Promise.all([get(), get(), get()]);
    assert.equal(calls, 1);
    now = 1100;
    mode = 'limited';
    await assert.rejects(get(true), { status: 503 });
    assert.equal(calls, 2);
    await get();
    assert.equal(calls, 2);
    now = 61099;
    await assert.rejects(get(true), { status: 429 });
    now = 61100;
    mode = 'ok';
    await get(true);
    assert.equal(calls, 3);
  }
});
test('provider caches enforce their actual 200/50 entry limits and retain recently read keys', async () => {
  for (const kind of ['search', 'route']) {
    const limit = kind === 'search' ? 200 : 50;
    let now = 0,
      calls = 0;
    const fetcher = (async () => {
      calls++;
      return Response.json(kind === 'search' ? { features: [feature] } : routeData);
    }) as typeof fetch;
    const search = createPlaceSearch(fetcher, 'https://photon.example/api/', () => now);
    const route = createRouting(fetcher, 'https://osrm.example', () => now);
    const get = (i: number) =>
      kind === 'search'
        ? search({ q: `Park ${i}` })
        : route({ stops: [stops[0], { latitude: 41 + i / 1000, longitude: -79 }] });
    for (let i = 0; i < limit; i++) {
      now += 1100;
      await get(i);
    }
    await get(0);
    now += 1100;
    await get(limit);
    await get(0);
    assert.equal(calls, limit + 1);
    now += 1100;
    await get(1);
    assert.equal(calls, limit + 2);
  }
});
test('mutable API responses are no-store; the immutable destination catalog has an explicit public TTL', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  for (const path of ['/api/trips', '/api/itineraries', '/api/places/search?q=x']) {
    const result = await api.get(path);
    assert.equal(result.headers['cache-control'], 'no-store');
  }
  const result = await api.post('/api/routes').send({ stops: [] });
  assert.equal(result.headers['cache-control'], 'no-store');
  const catalog = await api.get('/api/destinations?q=Boston');
  assert.equal(catalog.headers['cache-control'], 'public, max-age=3600');
});
