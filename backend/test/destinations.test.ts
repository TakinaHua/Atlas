import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { searchDestinations } from '../src/destinations.js';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';

test('catalog covers 50 states/DC; search ranks, disambiguates, and normalizes names', () => {
  const data = JSON.parse(
    readFileSync(new URL('../assets/us-destinations.json', import.meta.url), 'utf8'),
  );
  assert.equal(
    data.records.filter((r: { kind: string }) => r.kind === 'state').length,
    51,
  );
  assert.equal(
    new Set(data.records.map((r: { id: string }) => r.id)).size,
    data.records.length,
  );
  const portlands = searchDestinations('Portland');
  assert.equal(portlands[0].label, 'Portland, Oregon');
  assert.ok(portlands.some((p) => p.label === 'Portland, Maine'));
  assert.equal(searchDestinations('portland, me')[0].label, 'Portland, Maine');
  assert.equal(searchDestinations('CA')[0].label, 'California, United States');
  assert.equal(searchDestinations('SAN JOSÉ')[0].label, 'San Jose, California');
  assert.equal(searchDestinations('Hawaii')[0].kind, 'state');
  assert.equal(searchDestinations('Alaska')[0].zoom, 3);
  assert.deepEqual(searchDestinations('zzzxxyyqq'), []);
  assert.deepEqual(searchDestinations('a'), []);
  assert.ok(searchDestinations('San').length <= 10);
});

test('search endpoint validates requests and exposes bounded public results', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  await api.get('/api/destinations').expect(400);
  await api.get('/api/destinations?q=a').expect(400);
  await api.get('/api/destinations?q=Boston&q=Seattle').expect(400);
  const { body } = await api.get('/api/destinations?q=Boston').expect(200);
  assert.equal(body.results[0].label, 'Boston, Massachusetts');
  assert.equal(body.results[0].aliases, undefined);
  assert.equal((await api.get('/api/destinations?q=zzzxxyyqq')).body.results.length, 0);
});

test('selected location persists across restart/export/import and client coordinates cannot override catalog', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-destination-'));
  let store = new TripStore(join(dir, 'test.sqlite'));
  try {
    let api = request(createApp(store));
    const chosen = searchDestinations('Honolulu')[0];
    const input = {
      name: 'Hawaii',
      destination: 'Forged label',
      destinationLocation: { ...chosen, latitude: 0, longitude: 0 },
      startDate: '2027-06-01',
      endDate: '2027-06-01',
      days: [{ date: '2027-06-01', places: [] }],
    };
    const saved = (await api.post('/api/itineraries').send(input).expect(201)).body;
    assert.deepEqual(saved.destinationLocation, chosen);
    assert.equal(saved.destination, chosen.label);
    store.close();
    store = new TripStore(join(dir, 'test.sqlite'));
    api = request(createApp(store));
    assert.deepEqual(
      (await api.get(`/api/itineraries/${saved.id}`)).body.destinationLocation,
      chosen,
    );
    await api
      .delete(`/api/itineraries/${saved.id}`)
      .send({ revision: saved.revision })
      .expect(204);
    await api
      .post('/api/itineraries/import')
      .send({ trips: [saved] })
      .expect(200);
    assert.deepEqual(
      (await api.get(`/api/itineraries/${saved.id}`)).body.destinationLocation,
      chosen,
    );
    const bad = { ...saved, destinationLocation: { ...chosen, id: 'geonames-missing' } };
    await api.put(`/api/itineraries/${saved.id}`).send(bad).expect(400);
    const cleared = (
      await api
        .put(`/api/itineraries/${saved.id}`)
        .send({ ...saved, destination: 'Custom area', destinationLocation: null })
        .expect(200)
    ).body;
    assert.equal(cleared.destinationLocation, null);
    assert.equal(cleared.destination, 'Custom area');
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy trips gain a location without losing stops and old clients preserve unchanged location', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  const original = (
    await api
      .post('/api/itineraries')
      .send({
        name: 'Old trip',
        destination: 'Boston',
        startDate: '2027-06-01',
        endDate: '2027-06-01',
        days: [
          {
            date: '2027-06-01',
            places: [
              {
                id: 'old-stop',
                name: 'Museum',
                address: '',
                category: 'Culture',
                notes: 'Keep me',
                latitude: null,
                longitude: null,
              },
            ],
          },
        ],
      })
  ).body;
  assert.equal(original.destinationLocation, null);
  const selected = (
    await api
      .put(`/api/itineraries/${original.id}`)
      .send({ ...original, destinationLocation: searchDestinations('Boston')[0] })
      .expect(200)
  ).body;
  assert.deepEqual(selected.days, original.days);
  const { destinationLocation, ...legacy } = selected;
  const retained = (
    await api
      .put(`/api/itineraries/${original.id}`)
      .send({ ...legacy, name: 'New name' })
      .expect(200)
  ).body;
  assert.deepEqual(retained.destinationLocation, destinationLocation);
});
