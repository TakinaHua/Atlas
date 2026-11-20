# Current architecture: persistent itineraries

Browser → Next.js on port 3000 → TypeScript Express on port 8000 → SQLite in `backend/data/atlas.sqlite`.

TypeScript/React owns trip/day/place navigation; Leaflet displays optional coordinates using OpenStreetMap tiles. `frontend/lib/remote-api.ts` sends same-origin requests through the Next proxy. The UI changes saved state only after a successful server response; failures retain form input. Sample trips stay in memory until explicitly added.

`/api/itineraries` provides the frontend's dated-day/place representation and saves complete itinerary changes atomically. `/api/trips` retains the Phase 1 nested CRUD contract. Both use the same persisted Trip/DayPlan/Destination aggregates, with address/category/destination metadata and revision numbers. Every mutation increments the revision; itinerary PUT/DELETE requests reject stale revisions with 409.

Browser storage is read only for explicit migration of old preview trips. Imports validate the complete batch, skip existing IDs, and commit in one transaction. No local data is deleted. JSON export/import remains available.

U.S. destination suggestions use the GeoNames catalog; place/address lookup uses Photon with manual-entry fallback. OSRM provides ordered driving routes and distance/time summaries. A separate bounded Pittsburgh walking demonstration uses Atlas’s own Dijkstra implementation. Calculated routes are derived state and are invalidated after itinerary changes. Authentication and automatic stop-order optimization are not implemented. Existing JavaScript preview and Python backends remain inactive prior work. Browser tests run a separate server with a disposable database; they do not reset development data.

## Frontend structure

`frontend/app/page.tsx` owns dashboard filtering, selected trip/day/place, sample state, editing, imports/exports, and route requests. `JourneyStudio.tsx` renders the day board, saved places and map controls. `JourneyCard.tsx` renders pinned stops, and `useJourneyDrag.ts` handles pointer and touch dragging. Leaflet is dynamically imported with server rendering disabled because it needs the browser DOM.

The current UI uses custom global CSS with shared Atlas colors and spacing. My trips presents searchable saved itineraries in pages of up to four pinned prints. The planner pairs a horizontally scrolling card board with a sticky map on desktop. Below 768px, the mobile navigation switches between Itinerary, Map, and Saved places. Native dialogs retain keyboard focus and preserve entered values when saves fail.

The dashboard uses bundled photos and `GET /api/destination-photo` for selected catalog destinations. The board uses bundled photos for matching sample stops and `GET /api/place-photo` for other located stops. The latter takes a name and coordinates and returns a credited photo, a labeled nearby view, or an empty result. The Express adapter shares a bounded Wikimedia cache across both endpoints. Photo URLs and map filters are derived state outside stored trip records. See the [frontend guide](frontend.md), [design rules](../DESIGN.md), and [cache behavior](cache-behavior.md).
