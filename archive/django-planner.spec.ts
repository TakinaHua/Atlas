import { test, expect, type Page } from '@playwright/test';

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
  await page.getByLabel('Latitude', { exact: true }).fill(latitude);
  await page.getByLabel('Longitude', { exact: true }).fill(longitude);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
}

test('create, edit, reorder, route, persistence, mobile, and delete', async ({
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
  // The API integration is covered by Django tests; this fixture verifies rendering
  // without making browser tests depend on the public OSRM demo's availability.
  await page.route('**/api/trips/*/days/*/route', (route) =>
    route.fulfill({
      json: {
        geometry: {
          type: 'LineString',
          coordinates: [
            [-79.95, 40.4433],
            [-79.98, 40.445],
            [-80.0128, 40.4417],
          ],
        },
        distanceMeters: 6200,
        durationSeconds: 720,
        graphDurationSeconds: 720,
        pathIndices: [0, 1],
        algorithm: 'Dijkstra',
        profile: 'driving',
        provider: 'OSRM',
      },
    }),
  );
  await page.getByRole('button', { name: 'Calculate driving route' }).click();
  await expect(page.getByText('6.2 km · 12 min driving')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  await page.screenshot({
    path: 'artifacts/browser/planner-desktop.png',
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
  await page.screenshot({ path: 'artifacts/browser/planner-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.stops li').first().getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.stops li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete trip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trips in the making' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('failed save keeps form input; route errors stay visible', async ({ page }) => {
  await createTrip(page);
  await addPlace(page, 'Park', '40.44', '-80.01');
  await addPlace(page, 'Museum', '40.45', '-79.95');
  await page.route('**/api/trips/*/days/*/route', (route) =>
    route.fulfill({ status: 502, json: { error: 'Mapping service unavailable.' } }),
  );
  await page.getByRole('button', { name: 'Calculate driving route' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Mapping service unavailable.',
  );
  await page.getByRole('button', { name: 'Edit trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Keep my unsaved title');
  await page.route('**/api/trips/*', async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({
        status: 409,
        json: { error: 'Trip changed in another tab.' },
      });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('dialog').getByRole('alert')).toContainText('another tab');
  await expect(page.getByLabel('Trip name', { exact: true })).toHaveValue(
    'Keep my unsaved title',
  );
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
  await page.getByRole('button', { name: 'Import old browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 1 trips');
  await page.getByRole('button', { name: 'Import old browser trips' }).click();
  await expect(page.getByRole('status')).toContainText('1 already imported');
  expect(await page.evaluate(() => localStorage.getItem('atlas.trips.v1'))).toBe(legacy);
  await page.screenshot({ path: 'artifacts/browser/dashboard.png', fullPage: true });
});
