import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { walkingDemo } from '../src/walking-demo.js';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';
const a = { latitude: 40.4420279, longitude: -80.0060824 };
const b = { latitude: 40.4410009, longitude: -80.002423 };
const data = JSON.parse(
  readFileSync(new URL('../assets/pittsburgh-walking.json', import.meta.url), 'utf8'),
) as {
  nodes: Record<string, [number, number]>;
  edges: [string, string, number, string][];
};
test('real demo route uses only graph edges, retains stop order, and sums all leg lengths', () => {
  const result = walkingDemo({ stops: [a, b, a] });
  assert.equal(result.algorithm, 'Dijkstra');
  assert.equal(result.legs.length, 2);
  assert.ok(result.distanceMeters > 500 && result.distanceMeters < 2000);
  assert.equal(
    result.distanceMeters,
    result.legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
  );
  for (let i = 0; i < result.legs.length; i++) {
    const leg = result.legs[i];
    assert.equal(leg.nodeIds[0], result.snapped[i].nodeId);
    assert.equal(leg.nodeIds.at(-1), result.snapped[i + 1].nodeId);
    let sum = 0;
    for (let j = 1; j < leg.nodeIds.length; j++) {
      const edges = data.edges.filter(
        ([a, b]) => a === leg.nodeIds[j - 1] && b === leg.nodeIds[j],
      );
      assert.ok(edges.length);
      sum += Math.min(...edges.map((e) => e[2]));
    }
    assert.ok(Math.abs(sum - leg.distanceMeters) < 0.001);
  }
  for (const [from, to, weight] of data.edges) {
    assert.ok(data.nodes[from] && data.nodes[to]);
    assert.ok(Number.isFinite(weight) && weight >= 0);
  }
  const same = walkingDemo({ stops: [a, a] });
  assert.equal(same.distanceMeters, 0);
  assert.equal(same.geometry.coordinates.length, 2);
});
test('demo API rejects outside coverage, disconnected paths and invalid input without external services', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  const ok = await api
    .post('/api/routes/walking-demo')
    .send({ stops: [a, b] })
    .expect(200);
  assert.equal(ok.body.algorithm, 'Dijkstra');
  assert.equal(store.list().length, 0);
  await api
    .post('/api/routes/walking-demo')
    .send({ stops: [a, { latitude: 21.3, longitude: -157.8 }] })
    .expect(422);
  const disconnected = await api
    .post('/api/routes/walking-demo')
    .send({ stops: [{ latitude: 40.4418, longitude: -80.009 }, b] })
    .expect(422);
  assert.equal(disconnected.body.error.code, 'NO_DEMO_PATH');
  await api
    .post('/api/routes/walking-demo')
    .send({ stops: [a, { latitude: null, longitude: 0 }] })
    .expect(400);
});
