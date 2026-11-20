import type { CalculatedRoute, Day, WalkingDemoRoute } from '../lib/types';

export interface JourneyRouteState {
  route: CalculatedRoute | null;
  demoRoute: WalkingDemoRoute | null;
  routing: 'driving' | 'demo' | null;
  routeError: string;
  clearRoute: () => void;
  calculateDayRoute: (mode?: 'driving' | 'demo') => void;
}

export default function JourneyRoutes({
  day,
  busy,
  route,
  demoRoute,
  routing,
  routeError,
  clearRoute,
  calculateDayRoute,
}: JourneyRouteState & { day?: Day; busy: boolean }) {
  return (
    <section
      className="studio-routes route-box"
      id="edition-route"
      tabIndex={-1}
      aria-labelledby="studio-route-title"
    >
      <h3 id="studio-route-title">Route for the day</h3>
      <button
        disabled={
          busy ||
          routing !== null ||
          !day ||
          day.places.length < 2 ||
          day.places.some((p) => p.latitude === null || p.longitude === null)
        }
        onClick={() => void calculateDayRoute()}
      >
        {routing === 'driving' ? 'Calculating driving route…' : 'Calculate driving route'}
      </button>
      {!day || day.places.length < 2 ? (
        <p className="muted">Add at least two stops to calculate a route.</p>
      ) : day.places.some((p) => p.latitude === null || p.longitude === null) ? (
        <p className="muted">Select a map location for every stop before calculating.</p>
      ) : null}
      {routeError && (
        <p className="error" role="alert">
          {routeError}
        </p>
      )}
      {route && (
        <div className="route-summary" role="status" aria-label="Driving route summary">
          <p>
            <strong>
              {(route.distanceMeters / 1609.344).toFixed(1)} miles ·{' '}
              {Math.ceil(route.durationSeconds / 60)} min driving
            </strong>
          </p>
          <ol>
            {route.legs.map((leg, index) => (
              <li key={index}>
                {day?.places[index]?.name} → {day?.places[index + 1]?.name}:{' '}
                {(leg.distanceMeters / 1609.344).toFixed(1)} mi ·{' '}
                {Math.ceil(leg.durationSeconds / 60)} min
              </li>
            ))}
          </ol>
          <button className="text-button" onClick={clearRoute}>
            Clear route
          </button>
        </div>
      )}
      <details className="walking-demo">
        <summary>Shortest walking path · Pittsburgh demo</summary>
        <p>
          This local demonstration uses Atlas’s own Dijkstra algorithm on a small downtown
          street/path snapshot. Try Gateway and Market Square. It keeps your stop order.
        </p>
        <button
          disabled={
            busy ||
            routing !== null ||
            !day ||
            day.places.length < 2 ||
            day.places.some((p) => p.latitude === null || p.longitude === null)
          }
          onClick={() => void calculateDayRoute('demo')}
        >
          {routing === 'demo' ? 'Calculating walking path…' : 'Find shortest demo path'}
        </button>
        <p className="muted">
          Limited coverage; paths may be disconnected. Stops snap to the nearest node
          within 150 m. Distance excludes the gap from each stop to its snapped node.
          Access conditions, crossings, stairs and accessibility are not fully modeled:
          this is not navigation guidance.
        </p>
      </details>
      {demoRoute && (
        <div role="status" aria-label="Walking demo result">
          <p>
            <strong>
              {Math.round(demoRoute.distanceMeters)} m · shortest path in the demo graph
            </strong>
          </p>
          <p>Calculated locally by Dijkstra. Snapshot: {demoRoute.snapshotDate}.</p>
          <ol>
            {demoRoute.legs.map((leg, index) => (
              <li key={index}>
                {day?.places[index]?.name} → {day?.places[index + 1]?.name}:{' '}
                {Math.round(leg.distanceMeters)} m
              </li>
            ))}
          </ol>
          <p className="muted">
            Snap gaps:{' '}
            {demoRoute.snapped
              .map(
                (stop, index) =>
                  `stop ${index + 1}: ${Math.round(stop.distanceMeters)} m`,
              )
              .join('; ')}
            .
          </p>
          <details>
            <summary>How this path was found</summary>
            <p>
              {demoRoute.graphNodes.toLocaleString()} nodes,{' '}
              {demoRoute.graphEdges.toLocaleString()} directed edges, and{' '}
              {demoRoute.visitedNodes.toLocaleString()} node visits across all legs. Edge
              weights are segment lengths. Dijkstra chooses the lowest total distance
              between the snapped nodes; it does not reorder your stops.
            </p>
          </details>
          <p className="muted">
            Graph data:{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap contributors · ODbL
            </a>
          </p>
          <button className="text-button" onClick={clearRoute}>
            Clear demo path
          </button>
        </div>
      )}
      <p className="muted">
        Driving routes follow your stop order. Estimated driving time excludes visits and
        live traffic. Locations are sent to the routing provider when you calculate.
      </p>
      <p className="muted">
        Routing by{' '}
        <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">
          OSRM
        </a>{' '}
        ·{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </section>
  );
}
