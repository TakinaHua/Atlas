# Atlas frontend

The browser application uses native JavaScript modules and plain CSS. Start it from the project root with `npm run dev` or `npm start`; the backend serves `public/` and maps `src/` to `/src/`. Open http://localhost:8000.

Run frontend tests from the root with `npm test --workspace=@atlas/frontend`. The optional browser regression is documented in the root README.

## Source guide

- `public/index.html`: HTML entry point.
- `src/app.js`: hash navigation, handlers, and selected day/place state.
- `src/pages/`: landing page, dashboard, and trip planner.
- `src/components/`: navigation, cards, dialogs, itinerary, and map.
- `src/storage/tripStorage.js`: localStorage access, trip CRUD, and immutable day changes.
- `src/utilities/`: inclusive UTC date generation, IDs, HTML escaping, and coordinate checks.
- `src/styles/main.css`: responsive styling and CSS artwork.
- `tests/`: unit tests and optional Playwright regression.

## Data and map limitations

Trip data remains on the same browser origin/device; there is no cloud sync. Clearing site data removes it. Changes save immediately. Corrupt stored data is reported without overwriting it. Storage-denied/quota errors are surfaced. No automatic recovery/import UI is included.

MapPanel projects manually entered coordinates onto OpenStreetMap raster tiles. Zoom and fit-place controls are included; free dragging/panning and route lines are not implemented. Coordinate-backed marker numbers match itinerary position. Addresses are not geocoded. Missing coordinates omit a marker; latitude/longitude zero are valid. Both coordinates must be supplied together. Extreme polar latitudes are clamped to the Web Mercator projection limit. Dateline-spanning places may fit inefficiently.

Internet access is needed for OSM tiles and optional Google Fonts. No secret/API key is needed. If either provider is blocked, the system font and map grid fallback remain usable, including markers. Tile requests disclose the viewed map area and normal network metadata to OSM. OSM is a community tile service with no availability guarantee; comply with its tile usage policy for production and switch providers if usage grows. Attribution is visible. No tile prefetching, caching service worker, places API, routing service or route optimization.

Trips are limited to 366 inclusive days for practical UI size. Native HTML date inputs and dialogs are used. All stored user text is escaped for rendering. Built for modern browsers with crypto.randomUUID, ResizeObserver and dialog support; use localhost or HTTPS.
