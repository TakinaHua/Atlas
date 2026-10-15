import { readFileSync } from 'node:fs';
import { dijkstra, type Graph } from './dijkstra.js';
import { routeInput } from './routing.js';
import { ApiError } from './store.js';

const data = JSON.parse(
  readFileSync(new URL('../assets/pittsburgh-walking.json', import.meta.url), 'utf8'),
) as {
  bounds: [number, number, number, number];
  nodes: Record<string, [number, number]>;
  edges: [string, string, number, string][];
  retrievedAt: string;
};
const graph: Graph = new Map(Object.keys(data.nodes).map((id) => [id, []]));
for (const [from, to, meters] of data.edges) graph.get(from)!.push({ to, meters });
function distance(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((a[1] - b[1]) * rad) / 2) ** 2 +
    Math.cos(a[1] * rad) *
      Math.cos(b[1] * rad) *
      Math.sin(((a[0] - b[0]) * rad) / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function walkingDemo(input: unknown) {
  const { stops } = routeInput.parse(input);
  const snapped = stops.map((stop, index) => {
    const point: [number, number] = [stop.longitude, stop.latitude];
    const [west, south, east, north] = data.bounds;
    if (point[0] < west || point[0] > east || point[1] < south || point[1] > north)
      throw new ApiError(
        422,
        'OUTSIDE_DEMO',
        `Stop ${index + 1} is outside the downtown Pittsburgh demo area. Use driving routes for other areas.`,
      );
    let nearest = '';
    let gap = Infinity;
    for (const [id, location] of Object.entries(data.nodes)) {
      const candidate = distance(point, location);
      if (candidate < gap) {
        nearest = id;
        gap = candidate;
      }
    }
    if (gap > 150)
      throw new ApiError(
        422,
        'NO_DEMO_NODE',
        `Stop ${index + 1} is more than 150 meters from the demo network.`,
      );
    return { nodeId: nearest, distanceMeters: gap, coordinates: data.nodes[nearest] };
  });
  const legs = [];
  const path: string[] = [];
  let visitedNodes = 0;
  for (let i = 1; i < snapped.length; i++) {
    const result = dijkstra(graph, snapped[i - 1].nodeId, snapped[i].nodeId);
    if (!result)
      throw new ApiError(
        422,
        'NO_DEMO_PATH',
        `No connected demo path between stops ${i} and ${i + 1}. The snapshot is incomplete; try nearby street locations.`,
      );
    legs.push({ distanceMeters: result.distanceMeters, nodeIds: result.nodeIds });
    visitedNodes += result.visitedNodes;
    path.push(...(i === 1 ? result.nodeIds : result.nodeIds.slice(1)));
  }
  const coordinates = path.map((id) => data.nodes[id]);
  if (coordinates.length === 1) coordinates.push(coordinates[0]);
  return {
    geometry: { type: 'LineString' as const, coordinates },
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    legs,
    snapped,
    visitedNodes,
    graphNodes: graph.size,
    graphEdges: data.edges.length,
    snapshotDate: data.retrievedAt.slice(0, 10),
    algorithm: 'Dijkstra',
    profile: 'walking-demo',
    attribution: '© OpenStreetMap contributors — ODbL 1.0',
  };
}
