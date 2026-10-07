# Atlas architecture

## Request and data flow

The Next.js App Router serves a TypeScript React frontend. Browser requests use `/api/...`; Next rewrites them to Django while forwarding cookies. Django sessions identify the owning browser. CSRF tokens protect all writes, and every trip lookup includes session ownership.

SQLite stores Trip, Day, and Place rows. Trips have UUIDs, metadata, date ranges, and revision numbers. Days are unique per trip/date. Places hold name, address, category, notes, optional coordinates, and a position unique within their day. Cascading deletion removes dependent rows. The API validates string limits, dates, day coverage, coordinates, destination IDs, and count limits before changing the database.

PUT replaces a whole itinerary in one transaction. A conditional revision increment detects stale clients before replacement. A validation error or integrity failure leaves the old trip intact. The React UI changes its saved state only after the server confirms success. Conflicting forms retain entered data so the user can copy it before reloading.

The session cookie is not a full account system. Session-scoped access is suitable for a personal demo; account recovery and cross-device access are outside this version. Export/import provides a manual backup and transfer path.

## REST contract

All endpoints omit trailing slashes. JSON writes send `Content-Type: application/json` and `X-CSRFToken`. First call `GET /api/session` and retain its session/CSRF cookies.

| Method | Endpoint                            | Behavior                                                |
| ------ | ----------------------------------- | ------------------------------------------------------- |
| GET    | `/api/health`                       | Service health                                          |
| GET    | `/api/session`                      | Initialize session and return CSRF token                |
| GET    | `/api/trips`                        | List this browser's trips                               |
| POST   | `/api/trips`                        | Create metadata and dated itinerary; returns 201        |
| GET    | `/api/trips/{id}`                   | Fetch a saved trip                                      |
| PUT    | `/api/trips/{id}`                   | Replace trip/day/place data, requiring current revision |
| DELETE | `/api/trips/{id}`                   | Delete trip, requiring `{ "revision": n }`              |
| POST   | `/api/trips/import`                 | Import `{ "trips": [...] }`; deduplicate legacy IDs     |
| POST   | `/api/trips/{id}/days/{date}/route` | Calculate the saved day's driving route                 |

Trip JSON uses `id`, `name`, `destination`, `startDate`, `endDate`, `revision`, and `days`. Each day has `date` and `places`; each place has `id`, `name`, `address`, `category`, `notes`, `latitude`, and `longitude`. Dates are ISO date-only strings, and IDs are UUIDs. New trip POST can omit days to initialize empty days. PUT requires the complete itinerary.

Expected errors: 400 invalid data, 403 CSRF failure, 404 missing/not-owned trip, 405 unsupported method, 409 stale revision or conflicting IDs, 502 unavailable/invalid/unreachable provider route. No automatic retries are performed for writes. Routes support 2–30 destinations per day and require coordinates for all of them.

## Dijkstra's role

1. Request OSRM's directed duration matrix for the selected day's coordinates.
2. Build an adjacency list. A null matrix value omits the edge; zero is a valid travel cost.
3. Run our heap-based Dijkstra implementation for each consecutive required stop.
4. Reconstruct predecessor chains and concatenate paths, retaining the required stop order.
5. Request GeoJSON geometry for those paths from OSRM and display it with Leaflet.

OSRM performs the underlying road-network routing. Our graph has destinations as vertices and provider travel times as edges. In ordinary complete road-cost matrices, a direct destination-to-destination edge is usually already shortest; Dijkstra can also handle cheaper indirect connections and disconnected graphs. An intermediate destination can appear as a transit point before its scheduled stop; required itinerary order still defines the requested legs.

One search costs O((V + E) log V); at most V − 1 searches calculate a day. Matrix construction is O(V²). The 30-stop cap bounds cost and provider requests. The graph minimizes duration, not distance. Reported distance and duration come from the final geometry response and may differ slightly from the matrix due to provider snapping or routing constraints. `graphDurationSeconds` is returned separately for inspection.

Routes are cached for five minutes using provider URL and ordered coordinates. Any geometry-changing edit produces a different key. Frontend route state is cleared when dates, stops, or trip data change, and a request generation counter rejects stale successful responses.

## Mapping and limitations

Leaflet provides map drag/zoom, selection, bounds fitting, markers, and route polylines. Place names enter popups as text nodes. OpenStreetMap attribution remains visible. Tiles and OSRM need internet; no offline map, geocoding, live traffic, or optimal visit-order feature is implied.

Provider base URLs come only from server configuration. Requests have connection/read timeouts. The public provider is appropriate for small demonstrations; use a suitable hosted/self-hosted service for deployment. Routes are not persisted in the database because editing a trip would invalidate them.

## References

- [Django 5.2 documentation](https://docs.djangoproject.com/en/5.2/)
- [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [OSRM HTTP API](https://project-osrm.org/docs/v5.22.0/api/)
- [Leaflet reference](https://leafletjs.com/reference.html)
