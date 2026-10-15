# Independent Dijkstra walking demonstration

On the dashboard, choose **Explore walking demo**. Open **Shortest walking path · Pittsburgh demo** and select **Find shortest demo path**. The sample stays unsaved until explicitly added to your trips. The same control works with 2–30 located itinerary stops within the snapshot. Road driving routes remain a separate OSRM option.

## Algorithm and graph

`backend/src/dijkstra.ts` implements Dijkstra with a binary min-heap, a distance map, predecessor reconstruction, and lazy duplicate entries. Stale heap entries are skipped. Inputs require known endpoints and finite nonnegative edge lengths; disconnected endpoints return no path. Zero-length edges and identical endpoints are supported. Heap search is O((V + E) log E) with lazy duplicates, plus O(V + E) validation; for this sparse road graph this is commonly expressed as O((V + E) log V).

`backend/assets/pittsburgh-walking.json` bundles 2,396 OSM nodes and 5,740 directed edges within west -80.016, south 40.437, east -79.999, north 40.447. Nodes include intersections and geometry points. Every edge joins consecutive nodes of an included OSM way and retains the way ID. Weights are haversine segment lengths in meters rounded to millimeters. Junctions connect only through shared OSM node IDs; geometric line crossings alone do not connect.

The importer includes footway/path/pedestrian/steps and selected local road classes, checks foot/access tags, honors oneway:foot, and ignores vehicle-only one-way tags for pedestrian travel. It conservatively omits areas, indoor ways, conditionally tagged ways/nodes, inaccessible nodes, and barriers lacking explicit pedestrian access. It excludes ways outside its highway allowlist. The exact transform is versioned in `backend/scripts/build-walking-graph.py`.

This is an educational snapshot, not navigation guidance. It does not fully model sidewalks, crossings, access defaults, turn restrictions, directional foot access other than oneway:foot, construction updates, opening times, stairs accessibility, elevation, or real-time conditions. Filtering and bounding can disconnect paths that are reachable in reality. Never bridge disconnected nodes with an invented straight line.

## API and result semantics

`POST /api/routes/walking-demo` accepts the same ordered `stops` body as `/api/routes`. It runs locally without external routing calls. Coordinates must be within the snapshot; each stop snaps to its nearest graph node within 150 meters. Outside coverage or disconnected nodes produce 422; malformed/missing coordinates produce 400. The nearest node may be on a disconnected component; the service reports that rather than quietly choosing a more distant path.

Dijkstra runs separately between consecutive snapped stops, preserving required stop order. Output includes the chosen node IDs and geometry, total/per-leg distance, snap gaps, graph size, node-visit count across legs, and snapshot date. Distances exclude the off-network gaps between original stops and snapped nodes. No travel-time estimate is invented. Geometry follows the graph rather than the original place coordinates. Two stops snapped to the same node have zero graph distance.

Frontend state keeps driving and demo results separate and displays only the selected result on the map. Saves, reorders, moves, navigation and clearing invalidate either result; the existing cancellation/generation mechanism rejects stale responses. Derived paths are not persisted or exported. Graph computation can work offline, although map tiles still require internet.

## Evidence and manual checks

The example uses Gateway-area node 5472105438 and Market Square-area node 8909089575. Its path has 35 nodes and length 423.927 meters in this snapshot. This demonstrates graph shortest distance, not guaranteed fastest walking time or globally optimized trip order.

Tests cover known shortest paths, a cheaper indirect path, zero-cost cycles/ties, invalid weights/nodes, directionality/unreachable cases, source=target, and agreement with independent Bellman-Ford distances across 20 deterministic random graphs. Snapshot tests verify graph-edge membership and summed path costs, multi-stop order, API errors, and no saved-data mutation. The importer has a Python test for pedestrian access, one-way handling, conditional tags, areas and barriers. Playwright uses the actual local algorithm and snapshot to check the sample, rendered path, mobile width, reorder invalidation, reverse route and clearing.

Manual checks: open the sample, calculate, expand “How this path was found”, inspect the path, reorder and recalculate, then try stops outside Pittsburgh. Confirm driving routes still work separately. Do not describe this as nationwide custom road routing; the active TypeScript algorithm is independently implemented, while the retained Django implementation remains inactive.

## Provenance and reproduction

Source: https://api.openstreetmap.org/api/0.6/map?bbox=-80.016,40.437,-79.999,40.447

The graph is an adapted OpenStreetMap database, © OpenStreetMap contributors, under ODbL 1.0. Its exact retrieval timestamp/source SHA-256 are embedded in the snapshot; licensing is in `backend/assets/pittsburgh-walking.LICENSE.md`. Raw OSM user metadata is not included in the graph. The snapshot is committed alongside the importer so a demonstration uses consistent data.

To intentionally refresh:

```sh
curl --fail 'https://api.openstreetmap.org/api/0.6/map?bbox=-80.016,40.437,-79.999,40.447' -o /tmp/atlas-pittsburgh.osm
python3 backend/scripts/build-walking-graph.py /tmp/atlas-pittsburgh.osm
python3 backend/scripts/test_walking_graph.py
npm test
npm run test:browser
```

A refreshed extract can change connectivity or sample nodes: review the generated graph, examples and documentation before committing. No automatic background downloads occur.
