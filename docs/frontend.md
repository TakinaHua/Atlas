# Atlas frontend

Current implementation, updated October 16, 2026.

## Stack and design

Atlas uses Next.js App Router, React, TypeScript, custom CSS, and Leaflet. The active app lives in `frontend/`; archived HTML and vanilla implementations are not its source. The redesign introduces no UI framework, account system, booking flow, or AI planning feature.

[DESIGN.md](../DESIGN.md) defines the Atlas-specific visual system and links both original VoltAgent references. Airbnb is the dominant influence for white surfaces, generous spacing, rounded cards, inviting photography, and action hierarchy. Notion informs compact planning rows, category labels, and clear separation of names, addresses, notes, and controls. System sans-serif typography and a restrained forest-green accent unify the product.

## Screens and interactions

- **Dashboard:** a photo feature, two clearly labeled sample entry points, saved-trip cards, and backup/import tools. Search filters trip names and destinations case-insensitively. The count represents all saved trips; despite the existing “Trips in the future” heading, past trips are not hidden. Filtering does not change exports or storage. A no-match state provides Clear search.
- **Trip overview:** destination thumbnail, name, dates, day count, and edit/delete or explicit sample-save actions. Day buttons show dates and stop counts and expose the current day accessibly.
- **Itinerary:** compact numbered rows separate place names, pastel category tags, addresses, and notes. Edit, reorder, move-to-day, and remove controls remain available. Custom categories are preserved with a neutral tag. Notes retain line breaks. Stops without coordinates remain editable and explain how to add a map pin.
- **Map:** Leaflet uses OpenStreetMap tiles, numbered markers, linked itinerary selection, and route geometry. The map stays alongside the itinerary on desktop and stacks below it on smaller screens. Missing tiles produce feedback without disabling editing.
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
| `frontend/components/DestinationPhoto.tsx`  | Curated destination matching and image-error fallback                                                |
| `frontend/components/TripMap.tsx`           | Leaflet lifecycle, markers, selection, bounds, and route overlays                                    |
| `frontend/lib/remote-api.ts`                | Same-origin API requests and user-facing persistence errors                                          |
| `frontend/public/images/`                   | Locally served destination photographs                                                               |

The redesign preserves `/api/itineraries`, revision checks, atomic saves, and the SQLite data model. State updates follow successful saves. Samples stay in memory until Add to my trips is selected. Browser storage is read only for explicit migration; original records are never removed. Dashboard filtering and photography add no persisted fields. See [API integration](frontend-api-integration.md).

## Photography and responsive behavior

Photos are bundled locally, so they do not depend on an image-provider request at runtime. Oʻahu/Honolulu/Waikīkī (and the generic destination Hawaii) use the Waikīkī photograph; Pittsburgh uses its city photograph. Other destinations and failed image loads render a destination-labeled Atlas tile. Credits, source links, and license references are in [DESIGN.md](../DESIGN.md). Photography stays in discovery, trip cards, and the overview; daily itinerary rows stay photo-free.

Trip cards use three columns on wide screens, two at 1100px and below, and one at 650px and below. The planner stacks at 900px and below. Day navigation scrolls horizontally inside the page. At small widths, form fields stack and itinerary controls have larger touch targets. Focus outlines, selected states, a skip link, error/status feedback, and reduced-motion rules support keyboard and responsive use.

## Run and verify

From the repository root, use `npm install` then `npm run dev`. The normal frontend is http://127.0.0.1:3000, proxying the API on port 8000. Use the normal app to access existing stored trips. An isolated review preview, when running on port 3400, uses separate sample data and is not a deployed site.

Completed redesign checks:

- `npm test`: 46 tests passed across backend, server, and archived frontend checks.
- `npm run test:browser`: all 15 integration tests passed, covering CRUD, persistence, imports, retained input on save failure, conflicts, categories, destination/place lookup, day moves, driving routes, and the local walking demo.
- `npm run check`: TypeScript and formatting passed.
- `npm run test:production`: build, proxy, catalog, atomic move, process-restart persistence, backup round-trip, and compiled walking graph passed.
- `git diff --check`: passed.
- Visual review covered desktop, intermediate width, 390px mobile, and 320px overflow checks; dashboard, populated itinerary, selected map/stop state, both editors, empty day, loading/disabled states, and a mobile validation error. Dashboard filtering and clear-search recovery were exercised manually.

External search/routing responses are controlled in repeatable tests; these checks do not guarantee provider uptime. Map tiles, Photon search, and OSRM routing still require network availability. The walking graph has bounded Pittsburgh coverage. No full screen-reader audit was performed. Follow the [acceptance walkthrough](prototype-acceptance.md) for ongoing reviews.
