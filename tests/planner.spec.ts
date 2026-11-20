import { test, expect, type Page } from '@playwright/test';

// Remove only records created by this test; never clear a developer's database.
let initialIds = new Set<string>();
test.beforeEach(async ({ page, request }) => {
  await page.route('**/api/place-photo?*', (route) =>
    route.fulfill({ json: { photo: null } }),
  );
  const response = await request.get('/api/itineraries');
  expect(response.ok()).toBe(true);
  const { trips } = await response.json();
  initialIds = new Set(trips.map((trip: { id: string }) => trip.id));
});
test.afterEach(async ({ request }) => {
  const { trips } = await (await request.get('/api/itineraries')).json();
  for (const trip of trips)
    if (!initialIds.has(trip.id))
      await request.delete(`/api/itineraries/${encodeURIComponent(trip.id)}`, {
        data: { revision: trip.revision },
      });
});

async function createTrip(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Plan a trip' }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Pittsburgh weekend');
  await page.getByLabel('Destination', { exact: true }).fill('Pittsburgh');
  await page.getByLabel('Start date').fill('2026-10-10');
  await page.getByLabel('End date').fill('2026-10-11');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pittsburgh weekend' })).toBeVisible();
}

async function addPlace(page: Page, name: string, latitude: string, longitude: string) {
  await page.getByRole('button', { name: 'Add place', exact: true }).click();
  await page.getByLabel('Place name').fill(name);
  await page.getByText('Map coordinates (optional)', { exact: true }).click();
  await page.getByLabel('Latitude', { exact: true }).fill(latitude);
  await page.getByLabel('Longitude', { exact: true }).fill(longitude);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
}

test('new event cards pin matching photos automatically and refresh when edited', async ({
  page,
}) => {
  await page.route('**/api/place-photo?*', (route) => {
    const { searchParams } = new URL(route.request().url());
    return route.fulfill({
      json: {
        photo:
          searchParams.get('name') === 'Point State Park' &&
          searchParams.get('latitude') === '40.4417'
            ? {
                url: '/images/journey/gateway.webp',
                sourceUrl: 'https://commons.wikimedia.org/wiki/File:Park.jpg',
                author: 'Photo author',
                license: 'CC BY 4.0',
                licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
              }
            : null,
      },
    });
  });
  await createTrip(page);
  await addPlace(page, 'Point State Park', '40.4417', '-80.0128');
  const card = page.locator('.studio-card').filter({ hasText: 'Point State Park' });
  const image = card
    .locator('figure.studio-print')
    .getByRole('img', { name: 'Point State Park' });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(card.getByRole('link', { name: 'Photo author' })).toHaveAttribute(
    'href',
    'https://commons.wikimedia.org/wiki/File:Park.jpg',
  );
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: /^Open itinerary:/ }).click();
  await expect(image).toBeVisible();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Place name').fill('Meet for lunch');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const renamed = page.locator('.studio-card').filter({ hasText: 'Meet for lunch' });
  await expect(renamed).toBeVisible();
  await expect(renamed.locator('figure.studio-print')).toHaveCount(0);
});

test('create, edit, reorder, day navigation, persistence, mobile, and delete', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createTrip(page);
  await addPlace(page, 'Point State Park', '40.4417', '-80.0128');
  await addPlace(page, 'Carnegie Museum', '40.4433', '-79.9500');
  const customPostcard = page
    .locator('.studio-card-content')
    .filter({ hasText: 'Point State Park' });
  await expect(customPostcard.locator('img')).toHaveCount(0);
  await expect
    .poll(() =>
      customPostcard.evaluate((card) => getComputedStyle(card, '::before').content),
    )
    .toBe('""');
  await expect(page.locator('.map-pin')).toHaveCount(2);
  await page.getByRole('button', { name: 'Move Carnegie Museum up' }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li').first(),
  ).toContainText('Carnegie Museum');
  await page
    .locator('.studio-day[data-active=true] .studio-stops > li')
    .first()
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByLabel('Notes').fill('Book tickets before arrival.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Book tickets before arrival.')).toBeVisible();
  await page.screenshot({
    path: 'test-results/planner-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(0);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  await page.getByRole('button', { name: 'Day 1', exact: true }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: /^Open itinerary:/ }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('navigation', { name: 'Journey Studio views' })
    .getByRole('button', { name: 'Map', exact: true })
    .click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.map-pin')).toHaveCount(2);
  await page
    .getByRole('navigation', { name: 'Journey Studio views' })
    .getByRole('button', { name: 'Itinerary' })
    .click();
  await page.screenshot({ path: 'test-results/planner-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  page.on('dialog', (dialog) => dialog.accept());
  const firstStop = page
    .locator('.studio-day[data-active=true] .studio-stops > li')
    .first();
  await firstStop.getByRole('button', { name: /More actions for/ }).click();
  await firstStop.getByRole('button', { name: 'Remove' }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete trip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My trips' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('invalid import leaves existing trips untouched', async ({ page }) => {
  await createTrip(page);
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByText('Import and export', { exact: true }).click();
  await page.getByLabel('Import JSON backup').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[{"id":"broken"}]'),
  });
  await expect(page.locator('main').getByRole('alert')).toContainText('Invalid input');
  await expect(page.getByRole('heading', { name: 'Pittsburgh weekend' })).toBeVisible();
});

test('legacy import preserves local data and avoids duplicates', async ({ page }) => {
  const legacy = JSON.stringify([
    {
      id: 'legacy-trip',
      name: 'Old trip',
      destination: 'Hawaii',
      startDate: '2026-12-01',
      endDate: '2026-12-01',
      days: [{ date: '2026-12-01', places: [] }],
    },
  ]);
  await page.addInitScript(
    (value) => localStorage.setItem('atlas.trips.v1', value),
    legacy,
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByText('Import and export', { exact: true }).click();
  await page.getByRole('button', { name: 'Import browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 1 trips');
  await page.getByRole('button', { name: 'Import browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('1 already imported');
  expect(await page.evaluate(() => localStorage.getItem('atlas.trips.v1'))).toBe(legacy);
  await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
});

test('sample trip is usable and failed API saves retain form input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Next destination' }).click();
  await page.getByRole('button', { name: 'Preview the coastal itinerary' }).click();
  await page.getByRole('button', { name: 'Add to my trips' }).click();
  await expect(page.getByRole('heading', { name: 'A little aloha' })).toBeVisible();
  await expect(page.locator('.map-pin')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Unsaved name');
  await page.route('**/api/itineraries/*', (route) =>
    route.request().method() === 'PUT' ? route.abort() : route.continue(),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('dialog').getByRole('alert')).toContainText(
    'Could not confirm the save',
  );
  await expect(page.getByLabel('Trip name', { exact: true })).toHaveValue('Unsaved name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little aloha' })).toBeVisible();
});

test('dashboard delete can be canceled and persists without removing other trips', async ({
  page,
}) => {
  await createTrip(page);
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Next destination' }).click();
  await page.getByRole('button', { name: 'Preview the coastal itinerary' }).click();
  await page.getByRole('button', { name: 'Add to my trips' }).click();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  const remove = page.getByRole('button', {
    name: 'Delete Pittsburgh weekend',
    exact: true,
  });
  page.once('dialog', (dialog) => dialog.dismiss());
  await remove.click();
  await expect(page.locator('.trip-card')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'A little aloha' })).toBeVisible();
});

test('sample stays unsaved until explicitly added and displays readable dates', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Next destination' }).click();
  await page.getByRole('button', { name: 'Preview the coastal itinerary' }).click();
  await expect(
    page.getByRole('region', { name: 'Day 1', exact: true }).locator('time'),
  ).toContainText('Nov 14');
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await expect(page.locator('.trip-card')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await expect(page.locator('.trip-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Next destination' }).click();
  await page.getByRole('button', { name: 'Preview the coastal itinerary' }).click();
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('My Hawaii plans');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Add to my trips' }).click();
  await expect(page.getByRole('button', { name: 'Add to my trips' })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'My Hawaii plans' })).toBeVisible();
});

test('Other category accepts custom text and preserves it when editing', async ({
  page,
}) => {
  await createTrip(page);
  await page.getByRole('button', { name: 'Add place', exact: true }).click();
  await page.getByLabel('Place name').fill('Evening concert');
  await page.getByLabel('Category', { exact: true }).selectOption('Other');
  await expect(page.getByLabel('Custom category')).toHaveValue('');
  await page.getByLabel('Custom category').fill('Live music');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toContainText('Live music');
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: /^Open itinerary:/ }).click();
  await page
    .locator('.studio-day[data-active=true] .studio-stops > li')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('Other');
  await expect(page.getByLabel('Custom category')).toHaveValue('Live music');
  await page.getByLabel('Category', { exact: true }).selectOption('Nature');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toContainText('Nature');
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).not.toContainText('Live music');
});

test('server trips appear in a fresh browser; preview import preserves original data', async ({
  page,
  browser,
}) => {
  await createTrip(page);
  await addPlace(page, 'Saved without coordinates', '', '');
  const fresh = await browser.newContext();
  try {
    const other = await fresh.newPage();
    await other.goto(page.url());
    await other.getByRole('button', { name: 'My trips', exact: true }).click();
    await expect(
      other.getByRole('heading', { name: 'Pittsburgh weekend' }),
    ).toBeVisible();
    await other.getByRole('button', { name: /^Open itinerary:/ }).click();
    await expect(
      other.locator('.studio-day[data-active=true] .studio-stops > li'),
    ).toContainText('Saved without coordinates');
  } finally {
    await fresh.close();
  }
  const preview = JSON.stringify([
    {
      id: 'preview-import',
      name: 'Browser trip',
      destination: 'Oahu',
      startDate: '2027-01-01',
      endDate: '2027-01-01',
      revision: 4,
      days: [{ date: '2027-01-01', places: [] }],
    },
  ]);
  await page.evaluate(
    (value) => localStorage.setItem('atlas.preview.trips.v1', value),
    preview,
  );
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByText('Import and export', { exact: true }).click();
  await page.getByRole('button', { name: 'Import browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 1 trips');
  await page.getByRole('button', { name: 'Import browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('1 already imported');
  expect(await page.evaluate(() => localStorage.getItem('atlas.preview.trips.v1'))).toBe(
    preview,
  );
});

test('a stale tab cannot overwrite a newer edit', async ({ page, context }) => {
  await createTrip(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByRole('button', { name: 'My trips', exact: true }).click();
  await other.getByRole('button', { name: /^Open itinerary:/ }).click();
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Newer name');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Newer name' })).toBeVisible();
  await other.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await other.getByLabel('Trip name', { exact: true }).fill('Stale name');
  await other.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(other.locator('dialog').getByRole('alert')).toContainText(
    'changed elsewhere',
  );
  await other.reload();
  await other.getByRole('button', { name: 'My trips', exact: true }).click();
  await expect(other.getByRole('heading', { name: 'Newer name' })).toBeVisible();
  await other.close();
});

test('U.S. destination search selects and persists a city, supports keyboard and clears stale selection', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plan a trip' }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Destination search trip');
  const destination = page.getByRole('combobox', { name: 'Destination', exact: true });
  await destination.fill('Portland');
  await expect(
    page.getByRole('option', { name: 'Portland, Oregon City / town', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Portland, Maine City / town', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('option', { name: 'Portland, Maine City / town', exact: true })
    .click();
  await destination.fill('Honolulu');
  await expect(
    page.getByRole('option', { name: 'Honolulu, Hawaii City / town', exact: true }),
  ).toBeVisible();
  await destination.press('ArrowDown');
  await destination.press('Enter');
  await expect(destination).toHaveValue('Honolulu, Hawaii');
  await page.getByLabel('Start date').fill('2027-06-01');
  await page.getByLabel('End date').fill('2027-06-02');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Interactive map for Honolulu, Hawaii')).toBeVisible();
  await page.screenshot({
    path: 'test-results/destination-honolulu.png',
    fullPage: true,
  });
  const { trips } = await (await request.get('/api/itineraries')).json();
  const saved = trips.find((t: { name: string }) => t.name === 'Destination search trip');
  expect(saved.destinationLocation.latitude).toBeCloseTo(21.30694);
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: /^Open itinerary:/ }).click();
  await expect(
    page.getByText('Trip area: Honolulu, Hawaii', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(page.getByLabel('Interactive map for Honolulu, Hawaii')).toBeVisible();
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await destination.fill('CA');
  await page
    .getByRole('option', { name: 'California, United States State', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Trip area: California, United States', { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/destination-california.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await destination.fill('zzzxxyyqq');
  await expect(page.getByText('No matches.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Trip area:', { exact: false })).toHaveCount(0);
});

test('existing trip destination can be selected without losing places; search failures allow manual entry', async ({
  page,
}) => {
  await createTrip(page);
  await addPlace(page, 'Saved stop', '', '');
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  const destination = page.getByRole('combobox', { name: 'Destination', exact: true });
  await destination.fill('Pittsburgh');
  await page
    .getByRole('option', { name: 'Pittsburgh, Pennsylvania City / town', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toContainText('Saved stop');
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await page.route('**/api/destinations?*', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await destination.fill('Remote area');
  await expect(
    page.getByText('Destination search is unavailable.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toContainText('Saved stop');
});

test('place search selection saves a map pin; changing address clears it; failures allow manual entry', async ({
  page,
}) => {
  await createTrip(page);
  await page.route('**/api/place-photo?*', (route) =>
    route.fulfill({
      json: {
        photo: {
          url: '/images/journey/gateway.webp',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gateway.jpg',
          author: 'Photo author',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          locationLabel: 'Gateway area',
          nearby: true,
        },
      },
    }),
  );
  let calls = 0;
  await page.route('**/api/places/search?*', (route) => {
    calls++;
    return route.fulfill({
      json: {
        results: [
          {
            name: 'Point State Park',
            address: '601 Commonwealth Place, Pittsburgh, Pennsylvania',
            latitude: 40.4417,
            longitude: -80.0128,
          },
        ],
      },
    });
  });
  await page.getByRole('button', { name: 'Add place', exact: true }).click();
  await page.getByLabel('Find a place or address').fill('Point State Park Pittsburgh');
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Search places', exact: true }).click();
  await page.getByRole('button', { name: /Point State Park.*601 Commonwealth/ }).click();
  await expect(page.getByLabel('Place name')).toHaveValue('Point State Park');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.map-pin')).toHaveCount(1);
  const card = page.locator('.studio-card').filter({ hasText: 'Point State Park' });
  await expect(card.getByRole('img', { name: 'Gateway area' })).toBeVisible();
  await expect(card.locator('figcaption')).toContainText('Nearby · Gateway area');
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: /^Open itinerary:/ }).click();
  await expect(page.locator('.map-pin')).toHaveCount(1);
  await page
    .locator('.studio-day[data-active=true] .studio-stops > li')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByLabel('Place name', { exact: true }).fill('Afternoon walk');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.map-pin')).toHaveAttribute('title', 'Afternoon walk');
  await page
    .locator('.studio-day[data-active=true] .studio-stops > li')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByLabel('Address', { exact: true }).fill('A different address');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.map-pin')).toHaveCount(0);
  await expect(page.locator('.studio-card img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add place', exact: true }).click();
  await page.unroute('**/api/places/search?*');
  await page.route('**/api/places/search?*', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: 'Place search unavailable' } },
    }),
  );
  await page.getByLabel('Find a place or address').fill('Museum');
  await page.getByRole('button', { name: 'Search places', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Place search unavailable');
  await page.getByLabel('Place name').fill('Manual museum');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(2);
});

test('moving a place between days is atomic, preserves details and persists after reopening', async ({
  page,
  request,
}) => {
  await createTrip(page);
  await addPlace(page, 'Park to move', '40.44', '-80.01');
  const { trips: before } = await (await request.get('/api/itineraries')).json();
  const original = before.find((trip: { id: string }) => !initialIds.has(trip.id));
  const savedPlace = original.days[0].places[0];
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await addPlace(page, 'Existing stop', '', '');
  await page.getByRole('button', { name: 'Day 1', exact: true }).click();
  await page.route('**/api/itineraries/*', (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 503,
          json: { error: { message: 'Move could not be saved' } },
        })
      : route.continue(),
  );
  await page
    .getByRole('button', { name: 'More actions for Park to move', expanded: false })
    .click();
  await page.getByLabel('Move Park to move to another day').selectOption('2026-10-11');
  await expect(page.locator('.error[role=alert]')).toContainText(
    'Atlas could not complete this request',
  );
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toContainText('Park to move');
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Day 1', exact: true }).click();
  await page.unroute('**/api/itineraries/*');
  await page.getByLabel('Move Park to move to another day').selectOption('2026-10-11');
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(2);
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li').last(),
  ).toContainText('Park to move');
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li.selected'),
  ).toContainText('Park to move');
  await expect(page.locator('.map-pin')).toHaveCount(1);
  const { trips: after } = await (await request.get('/api/itineraries')).json();
  const moved = after.find((trip: { id: string }) => trip.id === original.id);
  expect(moved.days[0].places).toEqual([]);
  expect(moved.days[1].places[1]).toEqual(savedPlace);
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: /^Open itinerary:/ }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'More actions for Park to move' }).click();
  await page.getByLabel('Move Park to move to another day').selectOption('2026-10-10');
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(1);
  await expect(page.locator('.map-pin')).toHaveCount(1);
});

test('driving routes display ordered legs, invalidate on edits and ignore late responses after day changes', async ({
  page,
}) => {
  await createTrip(page);
  await expect(
    page.getByRole('button', { name: 'Calculate driving route' }),
  ).toBeDisabled();
  await addPlace(page, 'Park', '40.44', '-80.01');
  await addPlace(page, 'Museum', '40.45', '-79.95');
  const result = {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-80.01, 40.44],
        [-79.98, 40.47],
        [-79.95, 40.45],
      ],
    },
    distanceMeters: 5000,
    durationSeconds: 600,
    legs: [{ distanceMeters: 5000, durationSeconds: 600 }],
    provider: 'OSRM',
    profile: 'driving',
  };
  await page.route('**/api/routes', async (route) => {
    expect(route.request().postDataJSON().stops).toEqual([
      { latitude: 40.44, longitude: -80.01 },
      { latitude: 40.45, longitude: -79.95 },
    ]);
    await route.fulfill({ json: result });
  });
  await page.getByRole('button', { name: 'Calculate driving route' }).click();
  await expect(page.getByLabel('Driving route summary')).toContainText(
    '3.1 miles · 10 min',
  );
  await expect(page.getByLabel('Driving route summary')).toContainText('Park → Museum');
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  await page.getByRole('button', { name: 'Move Museum up' }).click();
  await expect(page.getByLabel('Driving route summary')).toHaveCount(0);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  await page.unroute('**/api/routes');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route('**/api/routes', async (route) => {
    started();
    await gate;
    await route.fulfill({ json: result }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Calculate driving route' }).click();
  await pending;
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  release();
  await expect(page.getByLabel('Driving route summary')).toHaveCount(0);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  await page.unroute('**/api/routes');
  await page.route('**/api/routes', (route) =>
    route.fulfill({
      status: 422,
      json: { error: { message: 'No driving route connects these stops.' } },
    }),
  );
  await page.getByRole('button', { name: 'Day 1', exact: true }).click();
  await page.getByRole('button', { name: 'Calculate driving route' }).click();
  await expect(
    page.getByText('No driving route connects these stops.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li'),
  ).toHaveCount(2);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
});

test('local Dijkstra walking demo displays a real graph path without saving the sample', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preview the walk', exact: true }).click();
  await page
    .getByText('Shortest walking path · Pittsburgh demo', { exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Find shortest demo path', exact: true })
    .click();
  await expect(page.getByLabel('Walking demo result')).toContainText(
    'Calculated locally by Dijkstra',
  );
  await expect(page.getByLabel('Walking demo result')).toContainText(
    'Gateway area → Market Square area',
  );
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  const { trips } = await (await request.get('/api/itineraries')).json();
  expect(trips.map((trip: { id: string }) => trip.id).sort()).toEqual(
    [...initialIds].sort(),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  const mobileViews = page.getByRole('navigation', { name: 'Journey Studio views' });
  await mobileViews.getByRole('button', { name: 'Map', exact: true }).click();
  await expect
    .poll(async () => {
      const map = await page.locator('.leaflet-container').boundingBox();
      const pins = await page.locator('.map-pin').all();
      if (!map) return false;
      for (const pin of pins) {
        const box = await pin.boundingBox();
        if (
          !box ||
          box.x < map.x ||
          box.x + box.width > map.x + map.width ||
          box.y < map.y ||
          box.y + box.height > map.y + map.height
        )
          return false;
      }
      return true;
    })
    .toBe(true);
  await page.screenshot({ path: 'test-results/walking-demo-mobile.png', fullPage: true });
  await mobileViews.getByRole('button', { name: 'Itinerary' }).click();
  await page.getByRole('button', { name: 'Move Market Square area up' }).click();
  await expect(page.getByLabel('Walking demo result')).toHaveCount(0);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Find shortest demo path', exact: true })
    .click();
  await expect(page.getByLabel('Walking demo result')).toContainText(
    'Market Square area → Gateway area',
  );
  await page.getByRole('button', { name: 'Clear demo path', exact: true }).click();
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
});

test('Journey Studio keeps map and card selection linked across desktop and mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await createTrip(page);
  await addPlace(page, 'Carnegie Museum of Art', '40.4433', '-79.9500');
  await addPlace(page, 'Point State Park', '40.4417', '-80.0128');
  const museumPin = page.locator('.map-pin[title="Carnegie Museum of Art"]');
  await museumPin.focus();
  await museumPin.press('Enter');
  await expect(museumPin).toBeFocused();
  await expect(museumPin).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.stop-title[aria-pressed="true"]')).toContainText(
    'Carnegie Museum of Art',
  );
  const parkCard = page.locator('.stop-title').filter({ hasText: 'Point State Park' });
  await parkCard.hover();
  await expect(page.locator('.studio-marker-hover')).toHaveAttribute(
    'title',
    'Point State Park',
  );
  await parkCard.click();
  await expect(page.locator('.map-pin.selected')).toHaveAttribute(
    'title',
    'Point State Park',
  );
  await page.screenshot({
    path: testInfo.outputPath('planner-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Show selected stop on map/ }).click();
  await expect(page.locator('.map-pin.selected')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('planner-mobile-map.png') });
  await page.getByRole('button', { name: /Return to selected stop/ }).click();
  await expect(
    page.locator('.studio-day[data-active=true] .studio-stops > li.selected'),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath('planner-mobile.png'),
    fullPage: true,
  });
});

test('responsive planner keeps stops and map reachable from 320px to desktop', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preview the walk' }).click();
  const list = page.locator('#edition-list');
  const map = page.locator('#edition-map');
  const nav = page.getByRole('navigation', { name: 'Journey Studio views' });
  const mapControlsFit = async () => {
    const tiles = await map.locator('.leaflet-container').boundingBox();
    const controls = await map.locator('.studio-map-actions').boundingBox();
    return Boolean(
      tiles &&
      controls &&
      controls.x >= tiles.x &&
      controls.y >= tiles.y &&
      controls.x + controls.width <= tiles.x + tiles.width &&
      controls.y + controls.height <= tiles.y + tiles.height,
    );
  };
  for (const width of [1440, 1024, 768, 767, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (width >= 768) {
      await expect(nav).toBeHidden();
      const left = await list.boundingBox();
      const right = await map.boundingBox();
      expect(left).toBeTruthy();
      expect(right).toBeTruthy();
      expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width - 1);
      await expect.poll(mapControlsFit).toBe(true);
    } else {
      await expect(nav).toBeVisible();
      await nav.getByRole('button', { name: 'Map', exact: true }).click();
      await expect(list).toBeHidden();
      await expect(page.locator('.leaflet-container')).toBeInViewport();
      await expect.poll(mapControlsFit).toBe(true);
      await page.getByRole('button', { name: 'Fit trip' }).click();
      await nav.getByRole('button', { name: 'Saved places', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Save a place' })).toBeVisible();
      await nav.getByRole('button', { name: 'Itinerary' }).click();
      await expect(
        page.getByRole('heading', { name: 'Route for the day' }),
      ).toBeVisible();
    }
  }
});

test('pinboard pages hold four prints and preserve the selected cover', async ({
  page,
}) => {
  const trips = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    name: 'Journey ' + i,
    destination: 'Pittsburgh',
    revision: 1,
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    days: [{ date: '2026-07-01', places: [] }],
  }));
  await page.route('**/api/itineraries', (route) => route.fulfill({ json: { trips } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Next destination' }).click();
  await expect(page.getByRole('heading', { name: /along the shore/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/cover.png' });
  await page.getByRole('button', { name: 'My trips' }).click();
  await expect(page.locator('.pinned-print')).toHaveCount(4);
  const positions = await page
    .locator('.pinned-print')
    .evaluateAll((cards) => cards.map((card) => getComputedStyle(card, '::before').left));
  expect(new Set(positions).size).toBe(4);
  await page.screenshot({ path: 'test-results/pinboard.png' });
  await page.getByRole('button', { name: 'Next trip page' }).click();
  await expect(page.locator('.pinned-print')).toHaveCount(1);
  await page.getByRole('button', { name: 'Previous trip page' }).click();
  await expect(page.locator('.pinned-print')).toHaveCount(4);
  await page.getByRole('searchbox').fill('Journey 4');
  await expect(page.locator('.pinned-print')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Trip pages' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/pinboard-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'My trips' })).toBeFocused();
  await expect(page.getByRole('heading', { name: /along the shore/ })).toBeVisible();
});

test('Journey Studio saves, edits, maps and schedules places after reload', async ({
  page,
}) => {
  await createTrip(page);
  await addPlace(page, 'Point State Park', '40.4417', '-80.0128');
  const card = page.locator('.studio-card').filter({ hasText: 'Point State Park' });
  await card.getByRole('button', { name: /More actions/ }).click();
  await card.getByRole('button', { name: 'Save for later' }).click();
  const saved = page.locator('.studio-saved');
  await expect(saved.locator('.studio-card')).toContainText('Point State Park');
  await page.getByText('Map settings', { exact: true }).click();
  await page.getByRole('radio', { name: 'Saved places' }).check();
  await expect(page.locator('.studio-marker-saved')).toHaveAttribute(
    'title',
    'Point State Park',
  );
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: 'Open itinerary: Pittsburgh weekend' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('navigation', { name: 'Journey Studio views' })
    .getByRole('button', { name: 'Saved places' })
    .click();
  await saved.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Notes').fill('Start here if the weather is clear.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(saved.locator('.studio-card')).toContainText(
    'Start here if the weather is clear.',
  );
  await saved.getByRole('button', { name: /More actions/ }).click();
  await saved.getByLabel('Schedule Point State Park').selectOption('2026-10-11');
  await expect(saved.locator('.studio-card')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Journey Studio views' })
    .getByRole('button', { name: 'Itinerary' })
    .click();
  await expect(page.locator('.studio-day[data-active=true]')).toContainText(
    'Point State Park',
  );
  await expect(page.locator('.studio-stops > li')).toHaveCount(1);
  await expect(page.locator('.studio-stops > li')).toContainText(
    'Start here if the weather is clear.',
  );
  await page
    .getByRole('navigation', { name: 'Journey Studio views' })
    .getByRole('button', { name: 'Saved places' })
    .click();
  await saved.getByRole('button', { name: 'Save a place' }).click();
  await page.getByLabel('Place name').fill('A coffee stop for later');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(saved.locator('.studio-card')).toContainText('A coffee stop for later');
});

test('Journey Studio shows multiple days, supports dragging, and navigates to day 60', async ({
  page,
  request,
}) => {
  const days = Array.from({ length: 60 }, (_, index) => ({
    date: new Date(Date.UTC(2027, 0, index + 1)).toISOString().slice(0, 10),
    places: index
      ? []
      : [
          {
            id: 'park',
            name: 'Point State Park',
            address: 'Pittsburgh',
            notes: '',
            category: 'Nature',
            latitude: 40.4417,
            longitude: -80.0128,
          },
        ],
  }));
  expect(
    (
      await request.post('/api/itineraries', {
        data: {
          name: 'Sixty days',
          destination: 'Pittsburgh',
          startDate: days[0].date,
          endDate: days[59].date,
          days,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: 'Open itinerary: Sixty days' }).click();
  const visibleDays = () =>
    page.locator('.studio-board').evaluate((board) => {
      const { left, right } = board.getBoundingClientRect();
      return [...board.querySelectorAll('.studio-day')].flatMap((column, index) => {
        const rect = column.getBoundingClientRect();
        if (Math.min(rect.right, right) - Math.max(rect.left, left) <= 1) return [];
        return [
          { day: index + 1, complete: rect.left >= left - 1 && rect.right <= right + 1 },
        ];
      });
    });
  const expectVisibleDays = (days: number[]) =>
    expect.poll(visibleDays).toEqual(days.map((day) => ({ day, complete: true })));
  await expectVisibleDays([1, 2, 3]);

  await expect(page.getByRole('region', { name: 'Day 2', exact: true })).toBeInViewport();
  const card = page.locator('.studio-card').filter({ hasText: 'Point State Park' });
  await card.dragTo(
    page.getByRole('region', { name: 'Day 2', exact: true }).locator('.studio-add'),
  );
  await expect(page.getByRole('region', { name: 'Day 2', exact: true })).toContainText(
    'Point State Park',
  );
  await page.getByRole('button', { name: 'Fit trip' }).click();
  await expect(page.locator('.map-pin')).toHaveAttribute(
    'aria-label',
    'Day 2, stop 1, Point State Park',
  );
  await page.getByRole('region', { name: 'Itinerary days' }).press('End');
  await expect(page.getByRole('region', { name: 'Day 60', exact: true })).toBeInViewport({
    ratio: 0.5,
  });
  await expectVisibleDays([60]);
  await expect(page.locator('.map-pin')).toHaveCount(1);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'Day 1', exact: true }).click();
  await expectVisibleDays([1, 2]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectVisibleDays([1]);
});

test('the map follows a scrolled board, settings filter days, and Add day extends the trip', async ({
  page,
  request,
}) => {
  const dates = ['2027-12-27', '2027-12-28', '2027-12-29', '2027-12-30', '2027-12-31'];
  const days = dates.map((date, index) => ({
    date,
    places: [
      {
        id: `stop-${index + 1}`,
        name: `Stop ${index + 1}`,
        address: '',
        notes: '',
        category: '',
        latitude: 40.4 + index * 0.01,
        longitude: -80,
      },
    ],
  }));
  const response = await request.post('/api/itineraries', {
    data: {
      name: 'End of year trip',
      destination: 'Pittsburgh',
      startDate: dates[0],
      endDate: dates[4],
      days,
    },
  });
  expect(response.ok()).toBe(true);
  const trip = await response.json();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: 'Open itinerary: End of year trip' }).click();
  const pin = page.locator('.map-pin');
  await expect(pin).toHaveAttribute('title', 'Stop 1');
  const board = page.getByRole('region', { name: 'Itinerary days' });
  await board.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(pin).toHaveAttribute('title', 'Stop 5');
  const fifthDay = page.getByRole('region', { name: 'Day 5', exact: true });
  expect((await fifthDay.boundingBox())!.x - (await board.boundingBox())!.x).toBeLessThan(
    20,
  );

  await page.getByText('Map settings', { exact: true }).click();
  await page.getByRole('radio', { name: 'Choose days' }).check();
  await page.getByRole('checkbox', { name: 'Day 5, Dec 31' }).uncheck();
  await page.getByRole('checkbox', { name: 'Day 1, Dec 27' }).check();
  await page.getByRole('checkbox', { name: 'Day 3, Dec 29' }).check();
  await expect
    .poll(() =>
      pin.evaluateAll((pins) => pins.map((item) => item.getAttribute('title')).sort()),
    )
    .toEqual(['Stop 1', 'Stop 3']);
  await page.getByRole('checkbox', { name: 'Day 3, Dec 29' }).press('Escape');
  await board.press('Home');
  await expect(page.getByRole('button', { name: 'Day 1', exact: true })).toHaveAttribute(
    'aria-current',
    'date',
  );
  await expect(pin).toHaveCount(2);

  await board.press('End');
  await page.getByRole('button', { name: 'Add day', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Day 6', exact: true })).toHaveAttribute(
    'aria-current',
    'date',
  );
  await expect(
    page.getByRole('region', { name: 'Day 6', exact: true }).locator('time'),
  ).toHaveAttribute('datetime', '2028-01-01');
  const updated = await (await request.get(`/api/itineraries/${trip.id}`)).json();
  expect(updated.endDate).toBe('2028-01-01');
  expect(updated.days).toEqual([...days, { date: '2028-01-01', places: [] }]);
});

test('dragging a stop below another updates and saves its order', async ({ page }) => {
  await createTrip(page);
  await addPlace(page, 'Morning coffee', '', '');
  await addPlace(page, 'Museum', '', '');
  const day = page.getByRole('region', { name: 'Day 1', exact: true });
  const cards = day.locator('.studio-card');
  const museum = cards.filter({ hasText: 'Museum' });
  const { width, height } = (await museum.boundingBox())!;
  await cards
    .getByRole('button', { name: 'Morning coffee', exact: true })
    .dragTo(museum, {
      targetPosition: { x: width / 2, y: height - 8 },
    });
  await expect(cards.locator('.stop-title strong')).toHaveText([
    'Museum',
    'Morning coffee',
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await page.getByRole('button', { name: 'Open itinerary: Pittsburgh weekend' }).click();
  await expect(cards.locator('.stop-title strong')).toHaveText([
    'Museum',
    'Morning coffee',
  ]);
});

test.describe('touch dragging', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('a quick swipe over a card scrolls the board without picking it up', async ({
    page,
  }) => {
    await createTrip(page);
    await addPlace(page, 'Morning coffee', '', '');
    const card = page.locator('.studio-card').filter({ hasText: 'Morning coffee' });
    await card.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    const bounds = (await card.boundingBox())!;
    const y = Math.round(bounds.y + bounds.height / 2);
    const x = Math.round(bounds.x + bounds.width - 25);
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (const distance of [45, 125, 235])
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x - distance, y }],
      });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(
      page.getByRole('button', { name: 'Day 2', exact: true }),
    ).toHaveAttribute('aria-current', 'date');
    await expect(card).toHaveCount(1);
    await expect(page.locator('.studio-drag-preview')).toHaveCount(0);
  });

  test('dragging near the edge reveals the next day and lets a stop move there', async ({
    page,
  }) => {
    await createTrip(page);
    await addPlace(page, 'Morning coffee', '', '');
    const card = page.locator('.studio-card').filter({ hasText: 'Morning coffee' });
    await card.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    const cardBounds = (await card.boundingBox())!;
    const board = page.getByRole('region', { name: 'Itinerary days' });
    const bounds = (await board.boundingBox())!;
    const dayTwo = page.getByRole('region', { name: 'Day 2', exact: true });
    const client = await page.context().newCDPSession(page);
    const y = Math.round(cardBounds.y + cardBounds.height / 2);
    const x = Math.round(cardBounds.x + cardBounds.width / 2);
    expect(
      await page.evaluate(
        ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.studio-card')),
        { x, y },
      ),
    ).toBe(true);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await expect(page.locator('.studio-drag-preview')).toBeVisible();
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: Math.round(bounds.x + bounds.width - 8), y }],
    });
    await expect
      .poll(async () => Math.abs((await dayTwo.boundingBox())!.x - bounds.x))
      .toBeLessThan(24);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: Math.round(bounds.x + bounds.width / 2), y }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(dayTwo.locator('.stop-title strong')).toHaveText('Morning coffee');
    await expect(
      page.getByRole('region', { name: 'Day 1', exact: true }).locator('.studio-card'),
    ).toHaveCount(0);
  });
});
