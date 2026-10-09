# Atlas — Intelligent Trip Planner

A browser-visible frontend preview using TypeScript, Next.js, Leaflet, and Node.js + Express. Create trips, switch between days, add/edit/remove/reorder places, and select numbered markers on an interactive map. Desktop-first, with a stacked layout on mobile.

## Run locally

Requires Node.js 24+ and npm. From this repository:

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. Keep the terminal running; Ctrl+C stops both servers. The frontend runs on port 3000 and the minimal Express API on 127.0.0.1:8000. `/api/health` is proxied through the frontend. If either port is occupied, stop your other Atlas instance first. Use the same browser address every time: localhost and 127.0.0.1 have separate browser storage.

## Review the frontend

- Choose **Explore a sample trip** for a three-day Hawaii itinerary with two mapped stops, or **Plan a trip** to start your own.
- Open a trip, choose a day, and add places with names, categories, notes, and optional coordinates.
- Edit, reorder, select, or remove stops. Coordinates are required for map markers; addresses are not automatically geocoded.
- Return to **My trips** to switch trips. Changes survive refresh in the same browser.
- Export JSON backups before clearing browser data. Import backups or older `atlas.trips.v1` trips explicitly; duplicate IDs are skipped and original data is preserved.

Map tiles require internet and use OpenStreetMap. Markers and itinerary editing still work if tiles fail. Sample content is illustrative, not current travel advice.

## Scope and storage

This milestone is for frontend review. Trips are saved in localStorage under `atlas.preview.trips.v1`. No account, database, route optimization, AI agent, or driving-route backend is active. The Express scaffold exposes health only; other API calls return 501. Full backend work is deferred until UI approval.

The previous Python backend and its database remain untouched in `backend/` for recovery. They are inactive and are not needed for npm setup. Existing Django database trips are not automatically migrated; JSON exports can be imported into this preview. Historical architecture and validation notes describe prior versions, not current behavior.

## Files and checks

- `frontend/app/page.tsx`: dashboard, trip/day navigation, and place editing.
- `frontend/components/`: forms, accessible dialogs, and Leaflet map.
- `frontend/lib/preview-store.ts`: validated browser persistence and import/export boundary.
- `backend/server.js`: minimal Express scaffold.
- `tests/`: current preview checks; previous backend-dependent browser tests are preserved in `archive/`.

```sh
npm test
npm run check
npm run build
# With npm run dev running in another terminal:
npm run test:browser
```

Browser tests use installed Google Chrome. `npm run build` builds the frontend; `npm start` runs the build and Express. This is a local review app, not a hosted production deployment.

Optional settings are in `.env.example`. Express loads root `.env`; for a custom API origin export `ATLAS_API_URL` in the shell before starting Next.
