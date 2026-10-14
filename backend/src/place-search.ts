import { z } from 'zod';
import { ApiError } from './store.js';

export const placeQuery = z
  .object({
    q: z.string().trim().min(3).max(200),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine(
    (v) => (v.latitude === undefined) === (v.longitude === undefined),
    'Provide both coordinates',
  );
export interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}
const feature = z.object({
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
  properties: z.record(z.string(), z.unknown()),
});
export function createPlaceSearch(
  fetcher: typeof fetch = fetch,
  endpoint = process.env.PHOTON_URL ?? 'https://photon.komoot.io/api/',
) {
  const cache = new Map<string, { until: number; results: PlaceResult[] }>();
  let busy = false;
  let nextRequest = 0;
  return async (input: z.infer<typeof placeQuery>): Promise<PlaceResult[]> => {
    const url = new URL(endpoint);
    url.searchParams.set('q', input.q);
    url.searchParams.set('limit', '6');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('countrycode', 'US');
    if (input.latitude !== undefined && input.longitude !== undefined) {
      url.searchParams.set('lat', String(input.latitude));
      url.searchParams.set('lon', String(input.longitude));
    }
    const key = url.toString();
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.results;
    if (busy || Date.now() < nextRequest)
      throw new ApiError(
        429,
        'SEARCH_BUSY',
        'Search is busy. Please wait a moment and try again.',
      );
    busy = true;
    nextRequest = Date.now() + 1100;
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'AtlasTripPlanner/2.1 (https://github.com/TakinaHua/Atlas)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        if (response.status === 429) nextRequest = Date.now() + 60000;
        throw new Error('Provider unavailable');
      }
      const data = z
        .object({ features: z.array(z.unknown()).max(100) })
        .parse(await response.json());
      const results: PlaceResult[] = [];
      for (const raw of data.features) {
        const parsed = feature.safeParse(raw);
        if (!parsed.success) continue;
        const p = parsed.data.properties;
        if (String(p.countrycode).toUpperCase() !== 'US') continue;
        const str = (key: string) =>
          typeof p[key] === 'string' ? (p[key] as string) : '';
        const street = [str('housenumber'), str('street')].filter(Boolean).join(' ');
        const name = str('name') || street || str('city');
        if (!name) continue;
        const address = [
          ...new Set(
            [
              street,
              str('city') || str('district'),
              str('state'),
              str('postcode'),
              str('country'),
            ].filter(Boolean),
          ),
        ].join(', ');
        const [longitude, latitude] = parsed.data.geometry.coordinates;
        results.push({
          name: name.slice(0, 150),
          address: address.slice(0, 300),
          latitude,
          longitude,
        });
        if (results.length === 6) break;
      }
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + 86400000, results });
      return results;
    } catch {
      throw new ApiError(
        503,
        'SEARCH_UNAVAILABLE',
        'Place search is unavailable. Try again later or enter a place manually.',
      );
    } finally {
      busy = false;
    }
  };
}
