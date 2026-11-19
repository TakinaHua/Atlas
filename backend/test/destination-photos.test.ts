import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDestinationPhotos } from '../src/destination-photos.js';
import { searchDestinations } from '../src/destinations.js';
import { createApp } from '../src/app.js';
import { TripStore } from '../src/store.js';
const boston = searchDestinations('Boston MA')[0];
const article = {
  title: 'Boston',
  pageimage: 'Boston skyline.jpg',
  coordinates: [{ lat: boston.latitude, lon: boston.longitude }],
};
const metadata = {
  title: 'File:Boston skyline.jpg',
  imageinfo: [
    {
      thumburl:
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Boston.jpg/960px-Boston.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Boston.jpg',
      mime: 'image/jpeg',
      width: 1600,
      height: 900,
      extmetadata: {
        Artist: { value: '<a href="https://example.org">A &amp; B</a>' },
        Credit: { value: 'Own work' },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      },
    },
  ],
};
function mock(page = article, file = metadata) {
  return (async (url: URL) =>
    Response.json({
      query: { pages: [url.hostname === 'en.wikipedia.org' ? page : file] },
    })) as typeof fetch;
}
test('photos match canonical city/state coordinates, preserve credits, coalesce and cache safely', async () => {
  let calls = 0,
    now = 0;
  const lookup = createDestinationPhotos(
    (async (url: URL, options) => {
      calls++;
      assert.ok(options?.signal);
      if (url.hostname === 'en.wikipedia.org') {
        assert.equal(url.searchParams.get('titles'), 'Boston, Massachusetts|Boston');
        assert.equal(url.searchParams.get('pilicense'), 'free');
      }
      return mock()(url, options);
    }) as typeof fetch,
    () => now,
  );
  const [a, b] = await Promise.all([lookup(boston.id), lookup(boston.id)]);
  assert.equal(calls, 2);
  assert.deepEqual(a, b);
  assert.equal(a?.author, 'A & B');
  assert.equal(a?.credit, 'Own work');
  a!.author = 'mutated';
  assert.equal((await lookup(boston.id))?.author, 'A & B');
  assert.equal(calls, 2);
  now = 86400001;
  await lookup(boston.id);
  assert.equal(calls, 4);
});
test('same-named wrong cities, unrelated articles and missing coordinates never supply a photo', async () => {
  for (const page of [
    { ...article, coordinates: [{ lat: 0, lon: 0 }] },
    { ...article, title: 'Boston University' },
    { ...article, coordinates: [] },
  ])
    assert.equal(await createDestinationPhotos(mock(page))(boston.id), null);
});
test('unsupported or unsafe images and missing licenses fall back without raw markup', async () => {
  for (const change of [
    { mime: 'image/svg+xml' },
    { thumburl: 'https://evil.example/image.jpg' },
    { descriptionurl: 'javascript:alert(1)' },
    { extmetadata: {} },
    {
      extmetadata: {
        ...metadata.imageinfo[0].extmetadata,
        LicenseShortName: { value: 'All rights reserved' },
      },
    },
  ]) {
    const file = { ...metadata, imageinfo: [{ ...metadata.imageinfo[0], ...change }] };
    assert.equal(await createDestinationPhotos(mock(article, file))(boston.id), null);
  }
  assert.equal(
    await createDestinationPhotos(mock({ ...article, pageimage: 'Flag of Boston.svg' }))(
      boston.id,
    ),
    null,
  );
});
test('state photos resolve to the correct capital and identify it explicitly', async () => {
  const state = searchDestinations('Pennsylvania')[0],
    capital = searchDestinations('Harrisburg PA')[0];
  const lookup = createDestinationPhotos((async (url: URL) => {
    if (url.hostname === 'en.wikipedia.org') {
      assert.equal(url.searchParams.get('titles'), 'Harrisburg, Pennsylvania|Harrisburg');
      return Response.json({
        query: {
          pages: [
            {
              ...article,
              title: 'Harrisburg, Pennsylvania',
              coordinates: [{ lat: capital.latitude, lon: capital.longitude }],
            },
          ],
        },
      });
    }
    return Response.json({ query: { pages: [metadata] } });
  }) as typeof fetch);
  assert.equal(
    (await lookup(state.id))?.locationLabel,
    'Harrisburg · Pennsylvania state capital',
  );
});
test('provider errors are retryable and 429 backoff does not poison successful cache entries', async () => {
  let now = 0,
    calls = 0;
  const lookup = createDestinationPhotos(
    (async (url: URL) => {
      calls++;
      return calls === 1 ? new Response('', { status: 429 }) : mock()(url);
    }) as typeof fetch,
    () => now,
  );
  await assert.rejects(lookup(boston.id), { status: 503 });
  await assert.rejects(lookup(boston.id), { status: 503 });
  assert.equal(calls, 1);
  now = 60001;
  assert.ok(await lookup(boston.id));
  assert.equal(calls, 3);
  const malformed = createDestinationPhotos((async () =>
    Response.json({ bad: true })) as typeof fetch);
  await assert.rejects(malformed(boston.id), { status: 503 });
});
test('negative matches expire after one hour', async () => {
  let now = 0,
    calls = 0;
  const lookup = createDestinationPhotos(
    (async () => {
      calls++;
      return Response.json({ query: { pages: [{ title: 'Boston' }] } });
    }) as typeof fetch,
    () => now,
  );
  assert.equal(await lookup(boston.id), null);
  await lookup(boston.id);
  assert.equal(calls, 1);
  now = 3600001;
  await lookup(boston.id);
  assert.equal(calls, 2);
});
test('different destinations queue instead of dropping dashboard images', async () => {
  let active = 0,
    max = 0;
  const lookup = createDestinationPhotos((async () => {
    active++;
    max = Math.max(max, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return Response.json({ query: { pages: [] } });
  }) as typeof fetch);
  const cities = [
    'Boston MA',
    'Austin TX',
    'Pittsburgh PA',
    'Seattle WA',
    'Portland OR',
  ].map((q) => searchDestinations(q)[0]);
  await Promise.all(cities.map((city) => lookup(city.id)));
  assert.equal(max, 3);
});
test('photo endpoint rejects unknown IDs and invalid requests before provider calls', async (t) => {
  const store = new TripStore(':memory:');
  t.after(() => store.close());
  const api = request(createApp(store));
  for (const query of ['', '?id=unknown', '?id=x&id=y', '?id=' + 'a'.repeat(101)])
    await api.get('/api/destination-photo' + query).expect(400);
  await api
    .get('/api/destination-photo?id=' + boston.id)
    .set('Origin', 'https://evil.example')
    .expect(403);
});
