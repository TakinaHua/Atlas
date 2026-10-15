# Driving routes — October 14, 2026

Open a day with 2–30 located stops and select **Calculate driving route**. Atlas draws the road path and shows total/leg distance in miles and estimated driving minutes, keeping the chosen stop order. This does not optimize the stop order. Estimates exclude live traffic and visits.

## Implementation

`POST /api/routes` accepts `{ "stops": [{ "latitude": 40.44, "longitude": -80.01 }, { "latitude": 40.45, "longitude": -79.95 }] }`. Missing/null/out-of-range coordinates, fewer than two stops, and more than 30 stops are rejected before contacting the provider. The service in `backend/src/routing.ts` calls OSRM Route with ordered longitude/latitude pairs and simplified GeoJSON. Routes and legs are validated for finite nonnegative distance/duration, coordinate bounds, and expected leg/waypoint counts. The snapping radius is limited to 1 km: a remote stop may need a closer road-access point. NoRoute/NoSegment produce 422; provider failure/malformed response/timeout produce 503; local throttling produces 429.

The default is https://router.project-osrm.org. [Demo policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server): reasonable non-commercial use only, no more than one request/second, no uptime or data-update guarantees. Atlas sends only coordinates, on explicit calculation; it does not send names/notes. `OSRM_URL` configures another compatible driving server. Restart after changing it. API details: https://project-osrm.org/docs/v5.24.0/api/.

One outbound request runs at a time, with 1.1 seconds minimum between starts; provider 429s trigger 60-second backoff. Up to 50 routes are cached in memory for one hour using provider URL and ordered coordinates. Cache clears on restart. Multi-instance/public deployment requires shared throttling and a suitable hosted/self-hosted service. OSM attribution appears with route controls and on the map.

Routes are derived, not saved in SQLite or included in exports. Recalculate after reopening. Every itinerary save, day/trip switch, or reload clears route state. Request cancellation plus a generation counter prevents a delayed response from showing on a different day. Errors never alter saved stops. Frontend response waiting is bounded to 15 seconds; provider requests to 10 seconds.

## Manual verification

1. Add two or more places using search; calculate and confirm the line and ordered leg labels.
2. Reorder a stop: the previous line and summary disappear; calculate again.
3. Move/edit/remove a stop, switch days, and reopen the trip: stale routes must not remain.
4. A day with fewer than two stops or an unlocated stop cannot calculate; guidance explains why.
5. Try disconnected regions (e.g. Hawaii/mainland) or a point far from roads: an error should leave stops intact.
6. An unavailable provider should show a retryable message without a straight-line substitute.

Verification: unit/API tests mock provider responses and cover request validation, normalization, caching/throttling, no-route errors and malformed/provider failures. Browser coverage includes route display, ordering, reorder invalidation, day changes during requests, and failure preservation. A separate live Pittsburgh request returned an 8,553.6 m / 769.3 s road route with 24 geometry points.

## Dijkstra: next implementation, not yet active

OSRM computes this road route. The preserved Django `backend/trips/routing.py` contains an older Dijkstra implementation, but the active TypeScript service does not call it. Running Dijkstra on an all-pairs shortest-travel-time matrix would largely repeat already-solved paths and does not establish an independent road-routing algorithm.

Proposed meaningful demonstration: a bounded road-network graph for one demo region, with intersections as nodes and directed road segments as edges. Store a versioned, attributed OSM-derived extract; respect one-way direction, use nonnegative segment length in meters, and run our own Dijkstra between snapped demo endpoints. Render the chosen segments and compare with an expected known path. Explicitly label it a limited shortest-distance demonstration: driving access, turn restrictions, traffic, and full nationwide navigation need more than this graph. Connect consecutive required stops in their given order; choosing the best stop order is a different problem.

Before implementation, choose the demo area/data extract and define supported access/turn rules. Test known shortest paths, unreachable nodes, equal-cost ties, zero/negative/invalid weights, and directionality. Keep this graph result and its distance distinct from OSRM's estimated driving route and duration.
