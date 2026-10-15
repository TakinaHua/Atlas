# Atlas first-prototype acceptance

Status: implementation is ready for user acceptance testing. This is a local prototype; it has not been deployed publicly. The checks below cover the active TypeScript/Express/SQLite backend and Next.js frontend. Preserved Django and preview-server code are inactive.

## Included

- Create/edit/delete trips and dates; U.S. city/state suggestions and destination map centering.
- Search names/addresses through Photon; confirm a result and save coordinates automatically; manual fallback.
- Add/edit/remove/reorder places, move between days, retain notes/categories/coordinates, and select map pins.
- SQLite persistence, atomic saves, stale-edit conflicts, explicit browser migration, and JSON import/export.
- OSRM driving paths in chosen stop order, total/per-leg distance/time, missing-location/error handling and stale-route invalidation.
- Independent local Dijkstra demo on an attributed downtown Pittsburgh walking graph; graph statistics, snapshot/sample, coverage and access limitations.

## Automated acceptance

Run from the repository root with Node.js 24+, npm dependencies, and Google Chrome installed:

```sh
npm test
python3 backend/scripts/test_walking_graph.py
npm run test:browser
npm run test:production
npm run build
npm run check
```

The browser suite uses ports 3300/8300, a temporary database, and separate build output. The production check selects available ports, builds a separate frontend, launches the compiled backend, and accesses the API through the production Next proxy. It saves and moves a place, restarts the actual API process against the same temporary SQLite file, and verifies that the reopened itinerary exactly matches the saved version. It also checks the production page, destination dataset, export/import duplicate handling, and compiled Dijkstra snapshot loading. It stops its processes and removes its temporary database/build output after finishing.

External search/routing responses are mocked in repeatable browser/provider tests. Earlier live implementation checks returned a Photon place result and an OSRM Pittsburgh driving route; these are point-in-time evidence, not availability guarantees. The local graph tests call the real Dijkstra implementation and compare shortest distances with an independent Bellman-Ford reference.

The production test deliberately does not use or modify `backend/data/atlas.sqlite`. Do not set `ATLAS_TEST_URL` to your real app when running browser acceptance unless you intentionally want test trips in that database.

## User acceptance walkthrough (about 10–15 minutes)

1. Run `npm run dev` once and open http://127.0.0.1:3000. If it is already running, use that instance; duplicate starts cause port conflicts.
2. Create “Prototype review”, select Pittsburgh from destination suggestions, and choose two days. Verify the end date cannot precede the start date.
3. Add two nearby places with search (e.g. Point State Park and Market Square). Confirm the result address before selecting. Add a category/note, save, and check the pins.
4. Reorder a place. Move it to day 2, verify details and selection, then move it back. Refresh and reopen; verify both days.
5. Calculate the driving route. Confirm ordered leg names, geometry, miles and estimated minutes. Edit or reorder a stop; confirm the old route disappears. Recalculate.
6. Export a JSON backup. Import the same file: existing trip IDs should be skipped, not duplicated. Keep a copy of the backup if desired.
7. Stop the development process with Ctrl+C, start it again, and reopen the trip. Names, dates, stops and notes should remain; calculated routes must be requested again.
8. In another tab, edit/save the same trip. A stale save from the first tab should show a conflict; reload rather than overwrite newer data.
9. Return to the dashboard and choose **Explore walking demo**. Open **Shortest walking path · Pittsburgh demo**, then **Find shortest demo path**. Check the 424-meter example, map line and expanded search statistics. The sample is unsaved unless you choose Add to my trips.
10. Check a narrow/mobile window. Pin/path bounds should refit. If tiles fail, editing still works and route coordinates remain; restore internet for the basemap.
11. Delete only your disposable review trip when finished. Record anything unexpected with the action, expected behavior and actual result.

## Known limits and deferred scope

- No accounts, authentication, multi-user ownership, or public production hosting. Use locally.
- No automatic best-stop-order optimization, visit scheduling, budgets, or AI features. An Unscheduled list and visit-time controls remain optional future decisions.
- GeoNames city search omits many small towns and territories. Photon coverage varies; confirm results.
- Public Photon/OSRM services can throttle or fail and require internet. They are not production service guarantees. Driving estimates exclude live traffic/visits.
- The custom Dijkstra graph covers a small Pittsburgh area only. It is a walking-distance demonstration with incomplete access modeling, not navigation guidance or a national custom driving engine. Snap gaps are excluded from graph distance.
- Map tiles require internet; routes are derived and cleared after changes/reopening. The local Dijkstra computation itself requires no external routing service.
- Existing Django database records require explicit compatible export/import; they are not automatically migrated.

## Resume-ready description

Accurate claims now include TypeScript/Node.js REST API design, SQLite persistence and validation, search-provider integration, itinerary editing, interactive maps, OSRM route display, and an independently implemented/tested Dijkstra algorithm on a bounded walking graph. Explain the distinction between provider driving routes, custom graph shortest paths, and stop-order optimization. Avoid claiming global custom routing, live traffic, optimal multi-stop ordering, or production deployment.
