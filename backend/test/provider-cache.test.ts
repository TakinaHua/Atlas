import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProviderCache } from '../src/provider-cache.js';
const busy = () => new Error('busy');
test('TTL begins at completion, expires exactly at boundary, and cached reads do not extend TTL', async () => {
  let now = 0,
    calls = 0;
  const cache = new ProviderCache<number[]>(2, 2000, busy, () => now);
  const load = async () => {
    calls++;
    now += 1500;
    return [];
  };
  await cache.get('a', load);
  now = 3499;
  assert.deepEqual(await cache.get('a', load), []);
  assert.equal(calls, 1);
  now = 3500;
  await cache.get('a', load);
  assert.equal(calls, 2);
});
test('capacity evicts least recently used; expired entries are removed before live eviction', async () => {
  let now = 0;
  const cache = new ProviderCache<string>(2, 10000, busy, () => now);
  const calls: string[] = [];
  const get = (key: string) =>
    cache.get(key, async () => {
      calls.push(key);
      return key;
    });
  await get('a');
  now = 1100;
  await get('b');
  await get('a');
  now = 2200;
  await get('c');
  await get('a');
  assert.deepEqual(calls, ['a', 'b', 'c']);
  now = 3300;
  await get('b');
  assert.deepEqual(calls, ['a', 'b', 'c', 'b']);
  now = 0;
  const short = new ProviderCache<string>(2, 2000, busy, () => now);
  await short.get('expired', async () => 'old');
  now = 1100;
  await short.get('live', async () => 'keep');
  now = 2200;
  await short.get('new', async () => 'new');
  assert.equal(
    await short.get('live', async () => {
      throw new Error('live entry was evicted');
    }),
    'keep',
  );
});
test('identical in-flight calls share one load; unrelated misses remain limited; results cannot mutate cache', async () => {
  let now = 0,
    calls = 0;
  let release!: (value: { nested: number[] }) => void;
  const loading = new Promise<{ nested: number[] }>((resolve) => {
    release = resolve;
  });
  const cache = new ProviderCache<{ nested: number[] }>(2, 5000, busy, () => now);
  const first = cache.get('a', () => {
    calls++;
    return loading;
  });
  const second = cache.get('a', async () => {
    throw new Error('duplicate load');
  });
  now = 5000;
  await assert.rejects(
    cache.get('b', async () => ({ nested: [] })),
    /busy/,
  );
  release({ nested: [1] });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  a.nested[0] = 9;
  assert.equal(b.nested[0], 1);
  b.nested.push(2);
  assert.deepEqual(await cache.get('a', async () => ({ nested: [] })), { nested: [1] });
});
test('errors are shared but never cached; synchronous failures release in-flight state', async () => {
  let now = 0;
  const cache = new ProviderCache<number>(2, 10000, busy, () => now);
  const fail = () => {
    throw new Error('provider failed');
  };
  const results = await Promise.allSettled([cache.get('a', fail), cache.get('a', fail)]);
  assert.ok(results.every((r) => r.status === 'rejected'));
  await assert.rejects(
    cache.get('a', async () => 1),
    /busy/,
  );
  now = 1100;
  assert.equal(await cache.get('a', async () => 2), 2);
});
test('backoff blocks new loads but allows cache hits, and ends exactly at its boundary', async () => {
  let now = 0;
  const cache = new ProviderCache<number>(2, 100000, busy, () => now);
  await cache.get('a', async () => 1);
  now = 1100;
  await assert.rejects(
    cache.get('b', async () => {
      cache.backoff(60000);
      throw new Error('rate limited');
    }),
  );
  assert.equal(await cache.get('a', async () => 0), 1);
  now = 61099;
  await assert.rejects(
    cache.get('b', async () => 2),
    /busy/,
  );
  now = 61100;
  assert.equal(await cache.get('b', async () => 2), 2);
});
test('independent cache instances do not share provider data or survive recreation', async () => {
  const a = new ProviderCache<number>(1, 1000, busy);
  const b = new ProviderCache<number>(1, 1000, busy);
  assert.equal(await a.get('same', async () => 1), 1);
  assert.equal(await b.get('same', async () => 2), 2);
});
