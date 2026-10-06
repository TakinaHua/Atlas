# Atlas — Intelligent Trip Planner

A laptop-first frontend MVP with a responsive mobile layout. No dependencies, accounts, backend, routes, or AI calls. The supplied reference skeleton was preserved; all implementation lives in this independent project.

## Run

Requires Python 3 for the static server and Node 18+ for unit tests.

```sh
cd atlas
npm start
```

Open http://localhost:8000. Do not open index.html as a file URL: browser ES modules require HTTP. You can also use any static host. No build step or npm install is required.

```sh
npm test
npm run check
```

Browser regression: install Playwright separately, then run `node tests/browser.cjs`. It resolves Playwright through `CODEX_PRIMARY_RUNTIME_NODE_MODULES` when available, otherwise the local package. Set `ATLAS_TEST_URL` to test another server; default is http://127.0.0.1:8000. The test deliberately blocks external resources to verify fallback behavior.

## Source guide

- `app.js`: hash navigation, event handlers and selected day/place state.
- `pages/`: LandingPage, DashboardPage and TripPlannerPage.
- `components/`: Navbar, TripCard, create/place forms, DaySelector, ItineraryPanel/PlaceCard, separate MapPanel and subtle assistant placeholder.
- `storage/tripStorage.js`: all localStorage access, trip CRUD and immutable day changes. This is the replacement boundary for future REST calls; asynchronous calls would also require awaiting handlers/loading states.
- `utilities/`: inclusive UTC date generation, IDs, HTML escaping and coordinate checks.
- `styles/main.css`: responsive styling with CSS landscape artwork and system font fallback.
- `tests/`: storage/date unit tests and full-browser regression.

## Data and map limitations

Trip data remains on the same browser origin/device; there is no cloud sync. Clearing site data removes it. Changes save immediately. Corrupt stored data is reported without overwriting it. Storage-denied/quota errors are surfaced. No automatic recovery/import UI is included.

MapPanel projects manually entered coordinates onto OpenStreetMap raster tiles. Zoom and fit-place controls are included; free dragging/panning and route lines are not implemented. Coordinate-backed marker numbers match itinerary position. Addresses are not geocoded. Missing coordinates omit a marker; latitude/longitude zero are valid. Both coordinates must be supplied together. Extreme polar latitudes are clamped to the Web Mercator projection limit. Dateline-spanning places may fit inefficiently.

Internet access is needed for OSM tiles and optional Google Fonts. No secret/API key is needed. If either provider is blocked, the system font and map grid fallback remain usable, including markers. Tile requests disclose the viewed map area and normal network metadata to OSM. OSM is a community tile service with no availability guarantee; comply with its tile usage policy for production and switch providers if usage grows. Attribution is visible. No tile prefetching, caching service worker, places API, routing service or route optimization.

Trips are limited to 366 inclusive days for practical UI size. Native HTML date inputs and dialogs are used. All stored user text is escaped for rendering. Built for modern browsers with crypto.randomUUID, ResizeObserver and dialog support; use localhost or HTTPS.
