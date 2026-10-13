import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';

function setup(t: TestContext) {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  return request(createApp(store));
}

test('complete nested CRUD, reordering, and cascading deletion', async (t) => {
  const api = setup(t);
  const trip = (
    await api
      .post('/api/trips')
      .send({ name: 'Hawaii', startDate: '2027-06-01', endDate: '2027-06-03' })
      .expect(201)
  ).body;
  const root = `/api/trips/${trip.id}`;
  const day1 = (await api.post(`${root}/days`).send({ title: 'Beach' }).expect(201)).body;
  const day2 = (await api.post(`${root}/days`).send({}).expect(201)).body;
  const route = `${root}/days/${day1.id}/destinations`;
  const a = (
    await api
      .post(route)
      .send({ name: 'Waikiki', latitude: 21.279, longitude: -157.829 })
      .expect(201)
  ).body;
  const b = (
    await api
      .post(route)
      .send({ name: 'Diamond Head', latitude: 21.262, longitude: -157.805 })
      .expect(201)
  ).body;
  await api.patch(`${root}`).send({ name: 'Oahu' }).expect(200);
  await api
    .patch(`${root}/days/${day1.id}`)
    .send({ notes: 'Bring sunscreen' })
    .expect(200);
  await api
    .patch(`${route}/${a.id}`)
    .send({ notes: 'Swim', latitude: 21.28 })
    .expect(200);
  assert.equal((await api.get(`${route}/${a.id}`).expect(200)).body.notes, 'Swim');
  assert.equal((await api.get(route).expect(200)).body.length, 2);
  assert.deepEqual(
    (
      await api
        .put(`${route}/reorder`)
        .send({ ids: [b.id, a.id] })
        .expect(200)
    ).body.map((x: { id: string }) => x.id),
    [b.id, a.id],
  );
  const reordered = (
    await api
      .put(`${root}/days/reorder`)
      .send({ ids: [day2.id, day1.id] })
      .expect(200)
  ).body;
  assert.deepEqual(
    reordered.map((x: { dayNumber: number }) => x.dayNumber),
    [1, 2],
  );
  assert.equal(reordered[0].id, day2.id);
  await api.delete(`${route}/${b.id}`).expect(204);
  await api.get(`${route}/${b.id}`).expect(404);
  await api.delete(`${root}/days/${day2.id}`).expect(204);
  assert.equal((await api.get(`${root}/days/${day1.id}`).expect(200)).body.dayNumber, 1);
  assert.equal((await api.get(`${root}/days`).expect(200)).body.length, 1);
  await api.delete(root).expect(204);
  await api.get(route).expect(404);
  assert.deepEqual((await api.get('/api/trips').expect(200)).body, []);
});

test('validation, atomic rollback, and parent scoping', async (t) => {
  const api = setup(t);
  for (const body of [
    {},
    { name: ' ' },
    { name: 'X', unexpected: true },
    { name: 'X', startDate: '2027-02-30' },
    { name: 'X', startDate: '2027-05-02', endDate: '2027-05-01' },
  ]) {
    await api.post('/api/trips').send(body).expect(400);
  }
  const trip = (
    await api
      .post('/api/trips')
      .send({ name: 'Trip', startDate: '2027-05-01', endDate: '2027-05-03' })
  ).body;
  const other = (await api.post('/api/trips').send({ name: 'Other' })).body;
  const root = `/api/trips/${trip.id}`;
  const day = (await api.post(`${root}/days`).send({})).body;
  const d2 = (await api.post(`${root}/days`).send({})).body;
  const route = `${root}/days/${day.id}/destinations`;
  await api.patch(root).send({ startDate: '2027-05-04' }).expect(400);
  assert.equal((await api.get(root)).body.startDate, '2027-05-01');
  await api.patch(root).send({}).expect(400);
  await api.patch(root).send({ id: 'replace-id' }).expect(400);
  await api.post(route).send({ name: 'Bad', latitude: 91, longitude: 0 }).expect(400);
  await api.post(route).send({ name: 'Bad', latitude: '21', longitude: 0 }).expect(400);
  await api.get(`/api/trips/${other.id}/days/${day.id}`).expect(404);
  const stop = (await api.post(route).send({ name: 'Stop', latitude: 0, longitude: 0 }))
    .body;
  await api
    .patch(`${root}/days/${d2.id}/destinations/${stop.id}`)
    .send({ name: 'Wrong day' })
    .expect(404);
  for (const ids of [[], [day.id, day.id], [day.id, other.id]]) {
    await api.put(`${root}/days/reorder`).send({ ids }).expect(400);
  }
  await api.put(`${route}/reorder`).send({ ids: [] }).expect(400);
  assert.deepEqual(
    (await api.get(`${root}/days`)).body.map((x: { id: string }) => x.id),
    [day.id, d2.id],
  );
  await api.patch(root).send({ startDate: null }).expect(200);
  assert.equal((await api.get(root)).body.startDate, null);
  await api.delete(`${root}/days/${day.id}`).expect(204);
  await api.get(`${route}/${stop.id}`).expect(404);
});

test('consistent errors and CORS', async (t) => {
  const api = setup(t);
  assert.equal((await api.get('/api/health').expect(200)).body.status, 'ok');
  await api
    .get('/api/health')
    .set('Origin', 'http://localhost:5173')
    .expect('Access-Control-Allow-Origin', 'http://localhost:5173');
  await api
    .options('/api/trips')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .expect(204);
  await api.get('/api/health').set('Origin', 'https://unknown.example').expect(403);
  assert.equal(
    (
      await api
        .post('/api/trips')
        .set('Content-Type', 'application/json')
        .send('{broken')
        .expect(400)
    ).body.error.code,
    'INVALID_JSON',
  );
  await api.post('/api/trips').set('Content-Type', 'text/plain').send('hi').expect(415);
  await api
    .post('/api/trips')
    .send({ name: 'x'.repeat(110000) })
    .expect(413);
  assert.equal((await api.get('/missing').expect(404)).body.error.code, 'NOT_FOUND');
});

test('SQLite persists nested updates and deletes when reopened', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-test-'));
  const path = join(directory, 'atlas.sqlite');
  let store = new TripStore(path);
  try {
    let api = request(createApp(store));
    const trip = (await api.post('/api/trips').send({ name: 'Persistent' }).expect(201))
      .body;
    const root = `/api/trips/${trip.id}`;
    const day = (await api.post(`${root}/days`).send({}).expect(201)).body;
    await api
      .post(`${root}/days/${day.id}/destinations`)
      .send({ name: 'Saved', latitude: 1, longitude: 2 })
      .expect(201);
    store.close();
    store = new TripStore(path);
    api = request(createApp(store));
    assert.equal(
      (await api.get(root).expect(200)).body.days[0].destinations[0].name,
      'Saved',
    );
    await api.delete(root).expect(204);
    store.close();
    store = new TripStore(path);
    assert.deepEqual(store.list(), []);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
