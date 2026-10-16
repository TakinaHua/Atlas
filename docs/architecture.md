# Current architecture: persistent itineraries

Browser → Next.js on port 3000 → TypeScript Express on port 8000 → SQLite in `backend/data/atlas.sqlite`.

TypeScript/React owns trip/day/place navigation; Leaflet displays optional coordinates using OpenStreetMap tiles. `frontend/lib/remote-api.ts` sends same-origin requests through the Next proxy. The UI changes saved state only after a successful server response; failures retain form input. Sample trips stay in memory until explicitly added.

`/api/itineraries` provides the frontend's dated-day/place representation and saves complete itinerary changes atomically. `/api/trips` retains the Phase 1 nested CRUD contract. Both use the same persisted Trip/DayPlan/Destination aggregates, with address/category/destination metadata and revision numbers. Every mutation increments the revision; itinerary PUT/DELETE requests reject stale revisions with 409.

Browser storage is read only for explicit migration of old preview trips. Imports validate the complete batch, skip existing IDs, and commit in one transaction. No local data is deleted. JSON export/import remains available.

U.S. destination suggestions use the GeoNames catalog; place/address lookup uses Photon with manual-entry fallback. OSRM provides ordered driving routes and distance/time summaries. A separate bounded Pittsburgh walking demonstration uses Atlas’s own Dijkstra implementation. Calculated routes are derived state and are invalidated after itinerary changes. Authentication and automatic stop-order optimization are not implemented. Existing JavaScript preview and Python backends remain inactive prior work. Browser tests run a separate server with a disposable database; they do not reset development data.

## Frontend structure

`frontend/app/page.tsx` owns dashboard filtering, selected trip/day/place, sample state, editing, imports/exports, and route requests. `frontend/components/` contains `TripForm`, `PlaceForm`, `DestinationSearch`, `EditorDialog`, `DestinationPhoto`, and `TripMap`. Leaflet is dynamically imported with server rendering disabled because it needs the browser DOM.

The current UI uses custom global CSS with shared Atlas colors and spacing. The dashboard has photo-led discovery and searchable saved-trip cards. The planner pairs compact stop rows and a horizontally scrolling day strip with a sticky map on desktop; below 900px the map stacks beneath the itinerary. Category tags distinguish built-in categories while preserving custom text. Native dialogs retain keyboard focus and preserve entered values when saves fail.

Destination photos are local static assets, matched only to curated destinations. Unknown destinations and image failures use a labeled fallback. No photo URLs or new UI preferences are added to stored trip records. Dashboard search filters the in-memory list without changing the server query, export, or persistence contracts. See the [frontend guide](frontend.md) and [design rules](../DESIGN.md).
