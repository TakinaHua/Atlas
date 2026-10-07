# Validation · October 7, 2026

## Passing checks

- 15 Django tests: CRUD persistence, ordered destinations, day isolation, ownership, stale-edit conflicts, atomic validation/import, duplicate IDs, CSRF, route API errors, Dijkstra path reconstruction, unreachable/zero/invalid edges, multistop composition, caching, missing coordinates, and malformed provider tables.
- 9 preserved JavaScript frontend regression tests.
- 3 Chrome end-to-end tests: create/edit/reorder/delete, refresh persistence, route polyline rendering, day switching, mobile width, failed saves retaining form input, provider errors, and legacy imports preserving data without duplicates.
- TypeScript strict checking; Django system checks; migration drift check.
- Next.js production build.
- Prettier and Black formatting checks.
- npm dependency audit: zero known vulnerabilities after patching shell-quote.
- Desktop planner, mobile planner, and dashboard screenshots visually inspected.

## Live mapping check

A separate request through the actual Django routing service used Point State Park (40.4417, -80.0128) and Carnegie Museum (40.4433, -79.9500). OSRM returned 8,560.5 meters, 769.9 seconds, and 273 geometry points. Dijkstra returned path indices `[0, 1]`; its graph duration was 769.9 seconds. These are one-time provider results, not performance benchmarks or guaranteed future travel estimates.

The automated browser route fixture deliberately uses fixed numbers and geometry. It checks UI rendering and invalidation; the live check above verifies the real service separately.

## Validation notes

The initial old Express regression invocation could not bind a port inside the tool sandbox; its source was formatting-only at that point. The preserved frontend tests passed. Active Django tests run in a temporary test database; browser integration used local servers with the required execution permission.

One initial browser assertion matched Next.js's accessibility announcer as well as Atlas's error banner. Scoping the assertion to the main content fixed the test; the error display itself already worked. The mobile screenshot now explicitly waits for Leaflet initialization before capture. No runtime browser errors were observed in the main workflow.

## Practical limits

This is a local personal app, not a deployed multi-user service. Session ownership is implemented, but login and account recovery are not. Public mapping services require internet. Coordinate entry is manual. Dijkstra searches a destination graph using provider road costs and preserves the requested stop order; it does not solve the traveling-salesperson problem.
