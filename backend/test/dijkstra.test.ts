import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dijkstra, type Graph } from '../src/dijkstra.js';
test('Dijkstra finds a multi-edge shortest path rather than the direct expensive edge', () => {
  const g: Graph = new Map([
    [
      'a',
      [
        { to: 'b', meters: 10 },
        { to: 'c', meters: 2 },
      ],
    ],
    ['b', [{ to: 'd', meters: 1 }]],
    [
      'c',
      [
        { to: 'b', meters: 2 },
        { to: 'd', meters: 9 },
      ],
    ],
    ['d', []],
  ]);
  assert.deepEqual(dijkstra(g, 'a', 'd')?.nodeIds, ['a', 'c', 'b', 'd']);
  assert.equal(dijkstra(g, 'a', 'd')?.distanceMeters, 5);
  assert.equal(dijkstra(g, 'd', 'a'), null);
  assert.equal(dijkstra(g, 'a', 'a')?.distanceMeters, 0);
});
test('zero edges, cycles, ties and invalid graphs', () => {
  const g: Graph = new Map([
    [
      'a',
      [
        { to: 'b', meters: 0 },
        { to: 'c', meters: 0 },
      ],
    ],
    [
      'b',
      [
        { to: 'a', meters: 0 },
        { to: 'd', meters: 2 },
      ],
    ],
    ['c', [{ to: 'd', meters: 2 }]],
    ['d', []],
  ]);
  assert.equal(dijkstra(g, 'a', 'd')?.distanceMeters, 2);
  assert.throws(() => dijkstra(g, 'missing', 'a'));
  for (const meters of [-1, NaN, Infinity])
    assert.throws(() => dijkstra(new Map([['a', [{ to: 'a', meters }]]]), 'a', 'a'));
  assert.throws(() =>
    dijkstra(new Map([['a', [{ to: 'missing', meters: 1 }]]]), 'a', 'a'),
  );
});
test('heap search agrees with independent Bellman-Ford distances over deterministic directed graphs', () => {
  let seed = 731;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let trial = 0; trial < 20; trial++) {
    const g: Graph = new Map(Array.from({ length: 12 }, (_, i) => [String(i), []]));
    for (const [a, edges] of g)
      for (const b of g.keys())
        if (a !== b && random() < 0.2)
          edges.push({ to: b, meters: Math.floor(random() * 20) });
    const distances = new Map([...g.keys()].map((id) => [id, id === '0' ? 0 : Infinity]));
    for (let round = 0; round < 11; round++)
      for (const [a, edges] of g)
        for (const e of edges)
          distances.set(
            e.to,
            Math.min(distances.get(e.to)!, distances.get(a)! + e.meters),
          );
    for (const target of g.keys())
      assert.equal(
        dijkstra(g, '0', target)?.distanceMeters ?? Infinity,
        distances.get(target),
      );
  }
});
