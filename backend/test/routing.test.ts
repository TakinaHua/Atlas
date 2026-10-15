import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createRouting } from '../src/routing.js';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';
const stops = [
  { latitude: 40.44, longitude: -80.01 },
  { latitude: 40.45, longitude: -79.95 },
];
const data = {
  code: 'Ok',
  waypoints: [{}, {}],
  routes: [
    {
      distance: 5000,
      duration: 600,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-80.01, 40.44],
          [-79.95, 40.45],
        ],
      },
      legs: [{ distance: 5000, duration: 600 }],
    },
  ],
};
test('routes preserve coordinate order, normalize units, cache, and throttle uncached work', async () => {
  let calls = 0;
  const calculate = createRouting((async (url: URL) => {
    calls++;
    assert.ok(url.pathname.endsWith('-80.01,40.44;-79.95,40.45'));
    assert.equal(url.searchParams.get('geometries'), 'geojson');
    assert.equal(url.searchParams.get('radiuses'), '1000;1000');
    return Response.json(data);
  }) as typeof fetch);
  const route = await calculate({ stops });
  assert.equal(route.distanceMeters, 5000);
  assert.equal(route.durationSeconds, 600);
  assert.deepEqual(route.legs, [{ distanceMeters: 5000, durationSeconds: 600 }]);
  assert.deepEqual(await calculate({ stops }), route);
  assert.equal(calls, 1);
  await assert.rejects(calculate({ stops: [...stops].reverse() }), { status: 429 });
});
test('no route and unsnappable stops are distinct from provider failures', async () => {
  for (const code of ['NoRoute', 'NoSegment']) {
    const calculate = createRouting((async () =>
      Response.json({ code }, { status: 400 })) as typeof fetch);
    await assert.rejects(calculate({ stops }), { status: 422, code: 'NO_ROUTE' });
  }
  for (const response of [
    Response.json({ code: 'Ok', routes: [] }),
    Response.json({ ...data, waypoints: [] }),
    new Response('', { status: 429 }),
    Response.json({ ...data, routes: [{ ...data.routes[0], distance: -1 }] }),
  ]) {
    const calculate = createRouting((async () => response) as typeof fetch);
    await assert.rejects(calculate({ stops }), { status: 503 });
  }
  await assert.rejects(
    createRouting((async () => {
      throw new Error('timeout');
    }) as typeof fetch)({ stops }),
    { status: 503 },
  );
});
test('route endpoint rejects missing coordinates, excessive stops and invalid bodies before provider call', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  for (const body of [
    { stops: [] },
    { stops: [stops[0]] },
    { stops: Array(31).fill(stops[0]) },
    { stops: [stops[0], { latitude: null, longitude: 0 }] },
    { stops: [stops[0], { latitude: 91, longitude: 0 }] },
  ])
    await api.post('/api/routes').send(body).expect(400);
  await api
    .post('/api/routes')
    .set('Origin', 'https://not-atlas.example')
    .send({ stops })
    .expect(403);
});
