import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';
const input = () => ({
  name: 'Weekend',
  destination: 'Pittsburgh',
  startDate: '2027-06-01',
  endDate: '2027-06-02',
  days: [
    {
      date: '2027-06-01',
      places: [
        {
          id: 'place-one',
          name: 'Concert',
          address: 'Main St',
          category: 'Live music',
          notes: 'Tickets',
          latitude: null,
          longitude: null,
        },
        {
          id: 'place-two',
          name: 'Park',
          address: '',
          category: 'Nature',
          notes: '',
          latitude: 0,
          longitude: 0,
        },
      ],
    },
    { date: '2027-06-02', places: [] },
  ],
});

test('itinerary saves metadata and optional coordinates in the same SQLite rows; survives reopen', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-itinerary-'));
  let store = new TripStore(join(dir, 'test.sqlite'));
  try {
    let api = request(createApp(store));
    const created = (await api.post('/api/itineraries').send(input()).expect(201)).body;
    assert.equal(created.revision, 1);
    const raw = (await api.get(`/api/trips/${created.id}`).expect(200)).body;
    assert.equal(raw.destination, 'Pittsburgh');
    assert.equal(raw.days[0].destinations[0].category, 'Live music');
    assert.equal(raw.days[0].destinations[0].latitude, null);
    created.days[0].places.reverse();
    created.days[0].places[1].address = 'New address';
    const saved = (
      await api.put(`/api/itineraries/${created.id}`).send(created).expect(200)
    ).body;
    assert.equal(saved.revision, 2);
    store.close();
    store = new TripStore(join(dir, 'test.sqlite'));
    api = request(createApp(store));
    const loaded = (await api.get(`/api/itineraries/${created.id}`).expect(200)).body;
    assert.deepEqual(loaded, saved);
    assert.equal(loaded.days[0].places[1].address, 'New address');
    await api
      .delete(`/api/itineraries/${loaded.id}`)
      .send({ revision: loaded.revision })
      .expect(204);
    await api.get(`/api/trips/${loaded.id}`).expect(404);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stale saves and deletes cannot overwrite edits through either API', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  const a = (await api.post('/api/itineraries').send(input())).body;
  await api
    .put(`/api/itineraries/${a.id}`)
    .send({ ...a, name: 'New name' })
    .expect(200);
  await api
    .put(`/api/itineraries/${a.id}`)
    .send({ ...a, name: 'Stale' })
    .expect(409);
  await api.delete(`/api/itineraries/${a.id}`).send({ revision: a.revision }).expect(409);
  const fresh = (await api.get(`/api/itineraries/${a.id}`)).body;
  await api.patch(`/api/trips/${a.id}`).send({ name: 'REST edit' }).expect(200);
  await api.put(`/api/itineraries/${a.id}`).send(fresh).expect(409);
  assert.equal((await api.get(`/api/itineraries/${a.id}`)).body.name, 'REST edit');
});

test('invalid imports and invalid whole-trip saves leave data unchanged', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  const a = (await api.post('/api/itineraries').send(input())).body;
  const invalid = structuredClone(a);
  invalid.days[0].places[0].latitude = 12;
  await api.put(`/api/itineraries/${a.id}`).send(invalid).expect(400);
  await api
    .put(`/api/itineraries/${a.id}`)
    .send({ ...a, startDate: '2027-06-02', days: [a.days[1]] })
    .expect(400);
  await api
    .put(`/api/itineraries/${a.id}`)
    .send({ ...a, id: 'wrong-id' })
    .expect(400);
  await api
    .post('/api/itineraries/import')
    .send({ trips: [{ ...input(), id: 'valid-import' }, { id: 'broken' }] })
    .expect(400);
  assert.equal(store.list().length, 1);
  assert.deepEqual((await api.get(`/api/itineraries/${a.id}`)).body, a);
});

test('imports are idempotent, reset revisions, skip existing IDs, and roll back database failures', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  const backup = { ...input(), id: 'legacy-trip', revision: 20 };
  assert.deepEqual(
    (
      await api
        .post('/api/itineraries/import')
        .send({ trips: [backup, backup] })
        .expect(200)
    ).body,
    { imported: 1, skipped: 1 },
  );
  assert.equal((await api.get('/api/itineraries/legacy-trip')).body.revision, 1);
  assert.deepEqual(
    (
      await api
        .post('/api/itineraries/import')
        .send({ trips: [backup] })
        .expect(200)
    ).body,
    { imported: 0, skipped: 1 },
  );
  const create = store.create.bind(store);
  store.create = (trip) => {
    if (trip.id === 'fail') throw new Error('Simulated storage failure');
    return create(trip);
  };
  await api
    .post('/api/itineraries/import')
    .send({
      trips: [
        { ...input(), id: 'would-save' },
        { ...input(), id: 'fail' },
      ],
    })
    .expect(500);
  assert.deepEqual(
    store.list().map((trip) => trip.id),
    ['legacy-trip'],
  );
});

test('Phase 1 records without dates are displayed without losing destinations or changing stored data', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  const trip = (await api.post('/api/trips').send({ name: 'Old API trip' })).body;
  const day = (await api.post(`/api/trips/${trip.id}/days`).send({ title: 'Keep title' }))
    .body;
  await api
    .post(`/api/trips/${trip.id}/days/${day.id}/destinations`)
    .send({ name: 'Existing stop', latitude: 21, longitude: -157 });
  const before = store.get(trip.id);
  const shown = (await api.get(`/api/itineraries/${trip.id}`).expect(200)).body;
  assert.equal(shown.days[0].places[0].name, 'Existing stop');
  assert.deepEqual(store.get(trip.id), before);
  await api.put(`/api/itineraries/${trip.id}`).send(shown).expect(200);
  assert.equal(store.get(trip.id).days[0].title, 'Keep title');
});
