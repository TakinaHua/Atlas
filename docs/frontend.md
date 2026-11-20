# Atlas frontend

Current implementation, updated November 20, 2026.

## Stack and design

Atlas uses Next.js App Router, React, TypeScript, custom CSS, and Leaflet. The active app lives in `frontend/`; archived HTML and vanilla implementations are not its source. The redesign introduces no UI framework, account system, booking flow, or AI planning feature.

The editorial covers, linen trip shelf, and cork day board share warm paper, serif headings, and forest-green selection states. See [DESIGN.md](../DESIGN.md).

## Screens and interactions

- The homepage slideshow previews the Pittsburgh and Oʻahu samples. **My trips** opens a searchable pinboard with up to four saved trips per page and backup tools. Search filters names and destinations without changing exports or stored trips.
- Journey Studio groups numbered stop cards under compact headers with the date and stop count. The board snaps to whole days. Focus the board and use the arrow keys, Home, or End to navigate. **Add day** extends the trip by one calendar day from the final column, up to 60 days.
- Drag a stop card to reorder it or move it to another day. On touch screens, press and hold before dragging. The card actions also support reordering, moving, and saving a place for later. Cards retain their notes, category, and optional coordinates.
- The map follows the leftmost day by default. **Map settings** can show selected days, all days, or saved places. **Fit trip** shows all scheduled stops. Leaflet uses OpenStreetMap tiles and links numbered markers to their cards.
- **Forms:** native modal dialogs have accessible titles, close/cancel actions, focus containment, and Escape handling. Date and coordinate fields are grouped. Existing search, keyboard navigation, validation, manual entry, and retained input after failed saves remain intact. Closing is disabled while a save is pending.
- **Routes:** driving routes preserve stop order and show distance/time and ordered legs. Editing, moving, reordering, or switching days clears stale results. The separate Pittsburgh walking demonstration remains available with its existing graph statistics and limitations.

## Components and state

| File                                        | Responsibility                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `frontend/app/page.tsx`                     | Dashboard, trip filtering, trip/day/stop selection, samples, edits, routes, JSON and browser imports |
| `frontend/app/globals.css`                  | Shared tokens, typography, layouts, controls, responsive and interaction states                      |
| `frontend/app/layout.tsx`                   | Root document, metadata, Leaflet and application styles                                              |
| `frontend/components/TripForm.tsx`          | Trip metadata and date inputs                                                                        |
| `frontend/components/DestinationSearch.tsx` | Destination suggestions, keyboard selection, and manual fallback                                     |
| `frontend/components/PlaceForm.tsx`         | Place lookup, address, coordinates, built-in/custom categories, and notes                            |
| `frontend/components/EditorDialog.tsx`      | Native modal lifecycle, save state, errors, and preserved form input                                 |
| `frontend/components/TravelCover.tsx`       | Homepage slideshow and sample previews                                                               |
| `frontend/components/DestinationPhoto.tsx`  | Bundled and Wikimedia destination photos with credit and fallback                                    |
| `frontend/components/JourneyStudio.tsx`     | Day board, map settings, and saved places                                                            |
| `frontend/components/JourneyCard.tsx`       | Pinned stop cards, automatic photos, credits, and editing actions                                    |
| `frontend/components/useJourneyDrag.ts`     | Pointer and touch dragging, drop targets, and edge scrolling                                         |
| `frontend/components/TripMap.tsx`           | Leaflet lifecycle, markers, selection, bounds, and route overlays                                    |
| `frontend/lib/remote-api.ts`                | Same-origin API requests and user-facing persistence errors                                          |
| `frontend/public/images/`                   | Locally served destination photographs                                                               |

The redesign preserves `/api/itineraries`, revision checks, atomic saves, and the SQLite data model. State updates follow successful saves. Samples stay in memory until Add to my trips is selected. Browser storage is read only for explicit migration; original records are never removed. Dashboard filtering and photography add no persisted fields. See [API integration](frontend-api-integration.md).

## Photography and responsive behavior

The homepage and selected samples use bundled photographs. Atlas looks up freely licensed photos for catalog destinations and located stops through Wikimedia. A stop can use a clearly labeled nearby view if a photo of the stop is unavailable. Stop photos link to their source and license. Stops without a usable photo appear as pinned notes. Credits for bundled photos are in [DESIGN.md](../DESIGN.md).

The planner shows three complete day columns when the board is wide enough, two on narrower desktop layouts, and one on mobile. Below 768px, the mobile navigation switches between Itinerary, Map, and Saved places. Day labels measure 44px high on desktop and keep 44px touch targets on mobile. At small widths, form fields stack. Focus outlines, selected states, a skip link, error/status feedback, and reduced-motion rules support keyboard and responsive use.

## Run and verify

From the repository root, use `npm install` then `npm run dev`. The normal frontend is http://127.0.0.1:3000, proxying the API on port 8000. Use the normal app to access existing stored trips. An isolated review preview, when running on port 3400, uses separate sample data and is not a deployed site.

Use these commands to verify changes.

- `npm test` covers the API, including provider matching and caching.
- `npm run test:browser` covers CRUD, day scrolling, Add day, drag and drop, map filtering, photos, imports, search, and routing.
- `npm run check` verifies TypeScript and formatting.
- `npm run test:production` checks the production build, proxy, catalog, atomic moves, persistence after restart, backup round-trip, and compiled walking graph.

Repeatable tests control external provider responses. Live map tiles, Photon search, Wikimedia photo lookup, and OSRM routing require internet access. The walking graph has bounded Pittsburgh coverage. Follow the [acceptance walkthrough](prototype-acceptance.md) for ongoing reviews.
