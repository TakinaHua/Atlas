# Atlas · Trip planner

Atlas is a TypeScript/Next.js trip planner with a Django REST backend, SQLite persistence, a heap-based Dijkstra implementation, and a Leaflet map. It supports multi-day itineraries, destination editing and ordering, and driving routes from OSRM.

## Start locally

Requirements: Node 24+, Python 3.12+, and internet access for map tiles and routing.

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
npm ci
.venv/bin/python backend/manage.py migrate
npm run dev
```

Open http://127.0.0.1:3000. Django runs at http://127.0.0.1:8000. Keep the same browser address when returning to your trips. Stop both servers with Ctrl+C.

This is a personal, local application. Trips belong to an opaque browser session and are stored in `backend/db.sqlite3`. There is no account login or cross-device synchronization. The cookie lasts one year; deleting it loses access to that session's trips. Export JSON backups from the dashboard before clearing cookies. Back up the SQLite file as well for database recovery.

## Use the planner

1. Create a trip with a name, destination, and start/end dates (up to 60 days).
2. Choose a day and add places. Enter both latitude and longitude to show a marker and calculate driving routes. Addresses are saved as text; automatic geocoding is not implemented.
3. Edit notes and places, reorder stops with the arrows, or remove them. Saved changes persist across reloads. Trip date edits cannot silently remove days containing places in the UI.
4. Select **Calculate driving route** after adding at least two stops with coordinates. The map displays the road geometry, distance, and estimated driving time. Editing or reordering stops clears the previous route.
5. Drag/zoom the map, click a marker, or select a stop in the itinerary.

Public OSRM and OpenStreetMap services require internet and have no availability guarantee. Routes share destination coordinates with OSRM; tiles contact OpenStreetMap. Set `OSRM_BASE_URL` to your own compatible driving service for sustained use. Provider failures show a useful message; the app never substitutes a straight line and calls it a driving route.

## Bring back older trips

The dashboard offers **Import old browser trips** when `atlas.trips.v1` exists on the current origin. Imports are explicit, atomic, and deduplicated by original trip ID within this browser session. Existing localStorage is never erased.

Browser storage is origin-specific. If the old app ran on port 8000, its data is not available to port 3000. While visiting the old app's original address, export the value with the browser console:

```js
copy(localStorage.getItem('atlas.trips.v1'));
```

Save the copied JSON as a file, then select **Import JSON backup** in the new dashboard. `copy()` is a Chrome DevTools utility. Exported JSON contains your trip data; keep it private as appropriate. Imports support up to 100 trips and a 900 KB browser upload. A repeated import skips the original trip; it does not overwrite edits made after import.

## Code guide

- `frontend/app/page.tsx`: planner state and user actions, with save-before-update behavior.
- `frontend/components/`: dialogs, forms, and the interactive Leaflet map.
- `frontend/lib/`: typed API records, HTTP/CSRF helpers, and date arithmetic.
- `backend/trips/models.py`: Trip → Day → Place relationships and database constraints.
- `backend/trips/itineraries.py`: validation, serialization, and atomic itinerary replacement.
- `backend/trips/views.py`: session-scoped REST endpoints and conflict detection.
- `backend/trips/routing.py`: mapping-provider boundary and documented Dijkstra algorithm.
- `backend/trips/tests.py`: backend and algorithm tests.
- `tests/planner.spec.ts`: end-to-end browser tests.
- `archive/`: formatted earlier code, original supplied ZIP, and former Express scaffold.

JavaScript/TypeScript/CSS use two spaces; Python uses four. Run `npm run format` to maintain consistent spacing. Comments explain responsibilities, assumptions, and non-obvious decisions rather than repeating each statement.

## Verify

```sh
npm test
npm run check
npm run build
# In another terminal, with npm run dev already running:
npm run test:browser
```

Browser tests use installed Google Chrome by default. They create session-isolated test trips. Route rendering uses a deterministic fixture; Django routing tests mock provider data. A separate live-provider smoke check is recorded in `docs/validation-2026-10-07.md`.

## Routing and the resume

The application implements Dijkstra itself using a priority queue. OSRM's table service supplies directed, nonnegative driving-time costs between saved destinations. Dijkstra finds the minimum travel-time path in that destination graph for each consecutive required stop; those paths are joined and OSRM returns road geometry. Missing connections are unreachable, not zero-cost edges. Dijkstra does not search a locally stored road network or optimize the order of all stops. See `docs/architecture.md` for the distinction and complexity.

The code supports the resume claims about data models and REST APIs, Dijkstra, TypeScript/Next.js itinerary editing, and interactive route maps. Do not claim deployment, account authentication, automatic geocoding, global stop-order optimization, or measured performance improvements without implementing or measuring them.

## Production boundary

`npm run build` builds Next.js; `npm start` serves that build. Django must run separately. For deployment, use a production WSGI server for `config.wsgi`, set a strong `DJANGO_SECRET_KEY`, set `DJANGO_DEBUG=0`, configure allowed hosts and trusted HTTPS origins, and provide HTTPS, database backups, rate limits, and account authentication if needed. The development server is not a production deployment.

Environment variables are listed in `.env.example`. Django reads the process environment; it does not load `.env` automatically. Next reads its own `frontend/.env.local`. Export variables in your shell when running both with `npm run dev`.

## Version history

The earlier main history and original ZIP are retained. The formatting-only checkpoint precedes the backend and frontend implementation, allowing separate review. See `docs/versions.md` for checkpoints and safe ways to inspect older versions.
