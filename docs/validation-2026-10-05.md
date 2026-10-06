# Cloud validation — October 5, 2026

Executed in the cloud workspace; original project_sources/01-index.html was left unchanged.

- `npm test`: 9 tests passed, 0 failed.
- All 14 JavaScript modules passed `node --check`.
- Static HTTP checks: index, stylesheet and all JavaScript modules returned HTTP 200 using a temporary Python server.
- Tests cover inclusive dates (same day, leap year, year boundary and DST), invalid date rejection, create/add/edit/reorder/delete persistence, reloading stored JSON, per-day isolation, zero and invalid coordinates, corrupt-data preservation, storage write errors, marker generation/numbering/selection state, empty map, polar projection, selected-day rendering, HTML escaping and main entry points.

## Not verified in a real browser

The Playwright regression script is included at tests/browser.cjs. Execution was attempted, but this environment has no Chromium executable. The browser installation download failed with an invalid/truncated ZIP. Consequently full DOM interaction, actual refresh/restart, native dialog behavior, rendered responsive layout, marker clicks and live OSM tiles have not been browser-verified. Unit tests verify the underlying data and generated component markup; they do not substitute for a browser run. No screenshots were produced.

To run the browser test with a Playwright-enabled environment, start the app server, install Playwright/Chromium and run the included script. It tests the requested full flow and blocks third-party networking to test map/font fallback.
