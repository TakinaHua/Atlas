# Current architecture: persistent itineraries

Browser → Next.js on port 3000 → TypeScript Express on port 8000 → SQLite in `backend/data/atlas.sqlite`.

TypeScript/React owns trip/day/place navigation; Leaflet displays optional coordinates using OpenStreetMap tiles. `frontend/lib/remote-api.ts` sends same-origin requests through the Next proxy. The UI changes saved state only after a successful server response; failures retain form input. Sample trips stay in memory until explicitly added.

`/api/itineraries` provides the frontend's dated-day/place representation and saves complete itinerary changes atomically. `/api/trips` retains the Phase 1 nested CRUD contract. Both use the same persisted Trip/DayPlan/Destination aggregates, with address/category/destination metadata and revision numbers. Every mutation increments the revision; itinerary PUT/DELETE requests reject stale revisions with 409.

Browser storage is read only for explicit migration of old preview trips. Imports validate the complete batch, skip existing IDs, and commit in one transaction. No local data is deleted. JSON export/import remains available.

Authentication, geocoding, driving routes, and route optimization are not implemented. Existing JavaScript preview and Python backends remain inactive prior work. Browser tests run a separate server with a disposable database; they do not reset development data.
