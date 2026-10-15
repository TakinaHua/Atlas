import { z } from 'zod';
import { ApiError } from './store.js';

const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const routeInput = z
  .object({
    stops: z
      .array(
        z
          .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
          })
          .strict(),
      )
      .min(2)
      .max(30),
  })
  .strict();
const providerRoute = z.object({
  distance: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(coordinate).min(2).max(20000),
  }),
  legs: z.array(
    z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative() }),
  ),
});
export interface DrivingRoute {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  distanceMeters: number;
  durationSeconds: number;
  legs: { distanceMeters: number; durationSeconds: number }[];
  provider: 'OSRM';
  profile: 'driving';
}
export function createRouting(
  fetcher: typeof fetch = fetch,
  base = process.env.OSRM_URL ?? 'https://router.project-osrm.org',
) {
  const cache = new Map<string, { expires: number; route: DrivingRoute }>();
  let busy = false;
  let nextRequest = 0;
  return async (input: z.infer<typeof routeInput>): Promise<DrivingRoute> => {
    const { stops } = routeInput.parse(input);
    const coordinates = stops.map((p) => `${p.longitude},${p.latitude}`).join(';');
    const url = new URL(`${base.replace(/\/$/, '')}/route/v1/driving/${coordinates}`);
    url.search = new URLSearchParams({
      overview: 'simplified',
      geometries: 'geojson',
      steps: 'false',
      alternatives: 'false',
      radiuses: stops.map(() => '1000').join(';'),
    }).toString();
    const key = url.toString();
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.route;
    if (busy || Date.now() < nextRequest)
      throw new ApiError(
        429,
        'ROUTING_BUSY',
        'Routing is busy. Wait a moment and try again.',
      );
    busy = true;
    nextRequest = Date.now() + 1100;
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'AtlasTripPlanner/2.1 (https://github.com/TakinaHua/Atlas)',
          Accept: 'application/json',
        },
      });
      if (response.status === 429) {
        nextRequest = Date.now() + 60000;
        throw new Error('Rate limited');
      }
      const data = await response.json();
      if (data.code === 'NoRoute' || data.code === 'NoSegment')
        throw new ApiError(
          422,
          'NO_ROUTE',
          'No driving route connects these stops, or a stop is too far from a road. Check each location.',
        );
      if (!response.ok || data.code !== 'Ok') throw new Error('Provider failed');
      const parsed = providerRoute.parse(data.routes?.[0]);
      if (
        parsed.legs.length !== stops.length - 1 ||
        !Array.isArray(data.waypoints) ||
        data.waypoints.length !== stops.length
      )
        throw new Error('Incomplete route');
      const route: DrivingRoute = {
        geometry: parsed.geometry,
        distanceMeters: parsed.distance,
        durationSeconds: parsed.duration,
        legs: parsed.legs.map((l) => ({
          distanceMeters: l.distance,
          durationSeconds: l.duration,
        })),
        provider: 'OSRM',
        profile: 'driving',
      };
      if (cache.size >= 50) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 3600000, route });
      return route;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        'ROUTING_UNAVAILABLE',
        'Driving routes are unavailable. Try again later. Your saved stops are unchanged.',
      );
    } finally {
      busy = false;
    }
  };
}
