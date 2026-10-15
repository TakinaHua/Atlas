# Atlas — Intelligent Trip Planner

A trip planner using TypeScript, Next.js, Leaflet, and Node.js + Express. Create trips, switch between days, add/edit/remove/reorder places, and select numbered markers on an interactive map. Desktop-first, with a stacked layout on mobile.

## Run locally

Requires Node.js 24+ and npm. From this repository:

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. Keep the terminal running; Ctrl+C stops both servers. The frontend runs on port 3000 and the TypeScript Express API on 127.0.0.1:8000. `/api/*` is proxied through the frontend. The API persists trip/day/destination CRUD in SQLite; the itinerary UI saves through the API. If either port is occupied, stop your other Atlas instance first. Server trips are shared across browsers connected to this local API. Old browser-only trips remain on their original browser address until explicitly imported.

## Review the frontend

- Choose **Explore a sample trip** to explore an unsaved three-day Hawaii itinerary with two mapped stops. Choose **Add to my trips** to keep it, or **Plan a trip** to start your own.
- Search a U.S. city or state in the trip form and select a suggestion to center the map. Text-only destinations remain supported. See [destination search](docs/destination-search.md).
- Open a trip, choose a day, and add places with names, categories, notes, and optional coordinates.
- Edit, reorder, select, or remove stops. Coordinates are required for map markers; addresses are not automatically geocoded.
- Return to **My trips** to switch trips. Changes survive refresh, server restarts, and opening another browser.
- Export JSON backups, or choose **Import browser trips** to copy older `atlas.preview.trips.v1` and `atlas.trips.v1` records into SQLite. Duplicate IDs are skipped; the original browser data is never removed.

Map tiles require internet and use OpenStreetMap. Markers and itinerary editing still work if tiles fail. Sample content is illustrative, not current travel advice.

## Scope and storage

Trips are saved in `backend/data/atlas.sqlite`. The frontend uses `/api/itineraries` for atomic whole-trip saves, revision checks, and import; the Phase 1 `/api/trips` endpoints remain available and use the same records. Addresses, categories, notes, optional coordinates, dates, and stop order are preserved. Concurrent stale saves or deletes return a conflict rather than overwriting a newer edit. Accounts, route optimization, AI agents, and driving-route services remain unimplemented.

The previous JavaScript preview scaffold, Python backend, and Django database remain untouched in `backend/` for recovery. They are inactive and are not needed for npm setup. Existing Django database trips are not automatically migrated; compatible itinerary JSON exports can be imported through the interface. Historical architecture and validation notes describe prior versions, not current behavior.

## Files and checks

- `frontend/app/page.tsx`: dashboard, trip/day navigation, and place editing.
- `frontend/components/`: forms, accessible dialogs, and Leaflet map.
- `frontend/lib/remote-api.ts`: same-origin API requests and user-facing error handling. `preview-store.ts` is retained as inactive prior work.
- `backend/src/`: active TypeScript REST API with SQLite persistence. See [backend setup and manual tests](backend/README-phase1.md).
- `tests/`: browser integration checks; previous backend-dependent browser tests are preserved in `archive/`.

```sh
npm test
npm run check
npm run build
npm run test:browser
```

Browser tests use installed Google Chrome and automatically launch an isolated app on ports 3300/8300 with a temporary database and separate Next output. They leave development data untouched. `npm run build` builds the frontend and backend; `npm start` runs the build and Express. This is a local app, not a hosted production deployment.

Optional settings are in `.env.example`. Express loads root `.env`; for a custom API origin export `ATLAS_API_URL` in the shell before starting Next.

Place/address lookup is available in Add/Edit place through Photon, with automatic coordinates and manual fallback. See [place-search setup and testing](docs/place-search.md).

Stops can now move between itinerary days while preserving their details and coordinates. See [day-move testing](docs/day-moves.md).

Ordered driving routes are available through OSRM, with map geometry, distance, and estimated time. See [road-routing setup and tests](docs/road-routing.md). An independent, limited Pittsburgh walking-graph demonstration is also available.

Choose **Explore walking demo** to try Atlas’s own Dijkstra implementation. See [algorithm, dataset and limitations](docs/dijkstra-demo.md).
