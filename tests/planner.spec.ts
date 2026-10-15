import { test, expect, type Page } from '@playwright/test';

// Remove only records created by this test; never clear a developer's database.
let initialIds = new Set<string>();
test.beforeEach(async ({ request }) => {
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
  await page.getByRole('button', { name: 'Add place' }).click();
  await page.getByLabel('Place name').fill(name);
  await page.getByText('Map coordinates (optional)', { exact: true }).click();
  await page.getByLabel('Latitude', { exact: true }).fill(latitude);
  await page.getByLabel('Longitude', { exact: true }).fill(longitude);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
}

test('create, edit, reorder, day navigation, persistence, mobile, and delete', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createTrip(page);
  await addPlace(page, 'Point State Park', '40.4417', '-80.0128');
  await addPlace(page, 'Carnegie Museum', '40.4433', '-79.9500');
  await expect(page.locator('.map-pin')).toHaveCount(2);
  await page.getByRole('button', { name: 'Move Carnegie Museum up' }).click();
  await expect(page.locator('.stops li').first()).toContainText('Carnegie Museum');
  await page
    .locator('.stops li')
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
  await page.getByRole('button', { name: /DAY 2/ }).click();
  await expect(page.locator('.stops li')).toHaveCount(0);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  await page.getByRole('button', { name: /DAY 1/ }).click();
  await expect(page.locator('.stops li')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Open itinerary' }).click();
  await expect(page.locator('.stops li')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.map-pin')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/planner-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.stops li').first().getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.stops li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete trip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trips in the future' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('invalid import leaves existing trips untouched', async ({ page }) => {
  await createTrip(page);
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
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
  await page.getByRole('button', { name: 'Import browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 1 trips');
  await page.getByRole('button', { name: 'Import browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('1 already imported');
  expect(await page.evaluate(() => localStorage.getItem('atlas.trips.v1'))).toBe(legacy);
  await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
});

test('sample trip is usable and failed API saves retain form input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a sample trip' }).click();
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
  await page.getByRole('button', { name: 'Explore a sample trip' }).click();
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
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'A little aloha' })).toBeVisible();
});

test('sample stays unsaved until explicitly added and displays readable dates', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a sample trip' }).click();
  await expect(page.getByRole('button', { name: 'DAY 1 Nov 14' })).toBeVisible();
  await page.getByRole('button', { name: 'My trips', exact: true }).click();
  await expect(page.locator('.trip-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.trip-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore a sample trip' }).click();
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('My Hawaii plans');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Add to my trips' }).click();
  await expect(page.getByRole('button', { name: 'Add to my trips' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'My Hawaii plans' })).toBeVisible();
});

test('Other category accepts custom text and preserves it when editing', async ({
  page,
}) => {
  await createTrip(page);
  await page.getByRole('button', { name: 'Add place' }).click();
  await page.getByLabel('Place name').fill('Evening concert');
  await page.getByLabel('Category', { exact: true }).selectOption('Other');
  await expect(page.getByLabel('Custom category')).toHaveValue('');
  await page.getByLabel('Custom category').fill('Live music');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.stops li')).toContainText('Live music');
  await page.reload();
  await page.getByRole('button', { name: 'Open itinerary' }).click();
  await page
    .locator('.stops li')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('Other');
  await expect(page.getByLabel('Custom category')).toHaveValue('Live music');
  await page.getByLabel('Category', { exact: true }).selectOption('Nature');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.stops li')).toContainText('Nature');
  await expect(page.locator('.stops li')).not.toContainText('Live music');
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
    await expect(
      other.getByRole('heading', { name: 'Pittsburgh weekend' }),
    ).toBeVisible();
    await other.getByRole('button', { name: 'Open itinerary' }).click();
    await expect(other.locator('.stops li')).toContainText('Saved without coordinates');
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
  await other.getByRole('button', { name: 'Open itinerary' }).click();
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
  await page.getByRole('button', { name: 'Open itinerary' }).click();
  await expect(
    page.getByText('Trip area: Honolulu, Hawaii', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: /DAY 2/ }).click();
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
  await expect(page.locator('.stops li')).toContainText('Saved stop');
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
  await expect(page.locator('.stops li')).toContainText('Saved stop');
});

test('place search selection saves a map pin; changing address clears it; failures allow manual entry', async ({
  page,
}) => {
  await createTrip(page);
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
  await page.getByRole('button', { name: 'Add place' }).click();
  await page.getByLabel('Find a place or address').fill('Point State Park Pittsburgh');
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Search places', exact: true }).click();
  await page.getByRole('button', { name: /Point State Park.*601 Commonwealth/ }).click();
  await expect(page.getByLabel('Place name')).toHaveValue('Point State Park');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.map-pin')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Open itinerary' }).click();
  await expect(page.locator('.map-pin')).toHaveCount(1);
  await page
    .locator('.stops li')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByLabel('Address', { exact: true }).fill('A different address');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.map-pin')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add place' }).click();
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
  await expect(page.locator('.stops li')).toHaveCount(2);
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
  await page.getByRole('button', { name: /DAY 2/ }).click();
  await addPlace(page, 'Existing stop', '', '');
  await page.getByRole('button', { name: /DAY 1/ }).click();
  await page.route('**/api/itineraries/*', (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 503,
          json: { error: { message: 'Move could not be saved' } },
        })
      : route.continue(),
  );
  await page.getByLabel('Move Park to move to another day').selectOption('2026-10-11');
  await expect(page.locator('.error[role=alert]')).toContainText(
    'Atlas could not complete this request',
  );
  await expect(page.locator('.stops li')).toContainText('Park to move');
  await page.getByRole('button', { name: /DAY 2/ }).click();
  await expect(page.locator('.stops li')).toHaveCount(1);
  await page.getByRole('button', { name: /DAY 1/ }).click();
  await page.unroute('**/api/itineraries/*');
  await page.getByLabel('Move Park to move to another day').selectOption('2026-10-11');
  await expect(page.locator('.stops li')).toHaveCount(2);
  await expect(page.locator('.stops li').last()).toContainText('Park to move');
  await expect(page.locator('.stops li.selected')).toContainText('Park to move');
  await expect(page.locator('.map-pin')).toHaveCount(1);
  const { trips: after } = await (await request.get('/api/itineraries')).json();
  const moved = after.find((trip: { id: string }) => trip.id === original.id);
  expect(moved.days[0].places).toEqual([]);
  expect(moved.days[1].places[1]).toEqual(savedPlace);
  await page.reload();
  await page.getByRole('button', { name: 'Open itinerary' }).click();
  await expect(page.locator('.stops li')).toHaveCount(0);
  await page.getByRole('button', { name: /DAY 2/ }).click();
  await expect(page.locator('.stops li')).toHaveCount(2);
  await page.getByLabel('Move Park to move to another day').selectOption('2026-10-10');
  await expect(page.locator('.stops li')).toHaveCount(1);
  await expect(page.locator('.map-pin')).toHaveCount(1);
});
