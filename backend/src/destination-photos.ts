import { z } from 'zod';
import { ApiError } from './store.js';
import {
  destinationById,
  searchDestinations,
  type DestinationLocation,
} from './destinations.js';

export interface DestinationPhoto {
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  title: string;
  locationLabel: string;
  credit: string;
}
// A capital is a clearly labeled, geographically relevant state overview image.
const capitals: Record<string, string> = {
  AL: 'Montgomery',
  AK: 'Juneau',
  AZ: 'Phoenix',
  AR: 'Little Rock',
  CA: 'Sacramento',
  CO: 'Denver',
  CT: 'Hartford',
  DE: 'Dover',
  FL: 'Tallahassee',
  GA: 'Atlanta',
  HI: 'Honolulu',
  ID: 'Boise',
  IL: 'Springfield',
  IN: 'Indianapolis',
  IA: 'Des Moines',
  KS: 'Topeka',
  KY: 'Frankfort',
  LA: 'Baton Rouge',
  ME: 'Augusta',
  MD: 'Annapolis',
  MA: 'Boston',
  MI: 'Lansing',
  MN: 'Saint Paul',
  MS: 'Jackson',
  MO: 'Jefferson City',
  MT: 'Helena',
  NE: 'Lincoln',
  NV: 'Carson City',
  NH: 'Concord',
  NJ: 'Trenton',
  NM: 'Santa Fe',
  NY: 'Albany',
  NC: 'Raleigh',
  ND: 'Bismarck',
  OH: 'Columbus',
  OK: 'Oklahoma City',
  OR: 'Salem',
  PA: 'Harrisburg',
  RI: 'Providence',
  SC: 'Columbia',
  SD: 'Pierre',
  TN: 'Nashville',
  TX: 'Austin',
  UT: 'Salt Lake City',
  VT: 'Montpelier',
  VA: 'Richmond',
  WA: 'Olympia',
  WV: 'Charleston',
  WI: 'Madison',
  WY: 'Cheyenne',
  DC: 'Washington',
};
const pagesSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        pageimage: z.string().optional(),
        coordinates: z.array(z.object({ lat: z.number(), lon: z.number() })).optional(),
        imageinfo: z
          .array(
            z.object({
              thumburl: z.string().optional(),
              descriptionurl: z.string().optional(),
              mime: z.string().optional(),
              width: z.number().optional(),
              height: z.number().optional(),
              extmetadata: z
                .record(z.string(), z.object({ value: z.string() }))
                .optional(),
            }),
          )
          .optional(),
      }),
    ),
  }),
});
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
// Provider HTML is converted to text and React escapes it; never render raw markup.
function plain(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(?:amp|quot|apos|lt|gt|nbsp);/g,
      (s) =>
        ({
          '&amp;': '&',
          '&quot;': '"',
          '&apos;': "'",
          '&lt;': '<',
          '&gt;': '>',
          '&nbsp;': ' ',
        })[s]!,
    )
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
      const n =
        code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}
function safeUrl(value: string | undefined, host: string, path: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' &&
      url.hostname === host &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith(path)
      ? url.href
      : '';
  } catch {
    return '';
  }
}
function matches(
  location: DestinationLocation,
  page: z.infer<typeof pagesSchema>['query']['pages'][number],
) {
  if (location.kind === 'state') {
    const title = ['Georgia', 'Washington', 'New York'].includes(location.name)
      ? `${location.name} (state)`
      : location.name;
    return normalize(page.title) === normalize(title);
  }
  // Exact city name (optionally with its state) and nearby article coordinates.
  if (
    ![location.name, `${location.name}, ${location.state}`].some(
      (title) => normalize(title) === normalize(page.title),
    )
  )
    return false;
  const c = page.coordinates?.[0];
  if (!c) return false;
  const radians = Math.PI / 180;
  const a =
    Math.sin(((c.lat - location.latitude) * radians) / 2) ** 2 +
    Math.cos(c.lat * radians) *
      Math.cos(location.latitude * radians) *
      Math.sin(((c.lon - location.longitude) * radians) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) < 30;
}

/** Bounded metadata cache, duplicate coalescing and a small queue for dashboard grids. */
export function createDestinationPhotos(
  fetcher: typeof fetch = fetch,
  now = () => Date.now(),
) {
  const cache = new Map<string, { expires: number; photo: DestinationPhoto | null }>();
  const pending = new Map<string, Promise<DestinationPhoto | null>>();
  const queue: (() => void)[] = [];
  let active = 0;
  let backoffUntil = 0;
  async function query(host: string, params: Record<string, string>) {
    if (now() < backoffUntil) throw new Error('Provider cooling down');
    const url = new URL(`https://${host}/w/api.php`);
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      ...params,
    }).toString();
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'AtlasTripPlanner/2.1 (https://github.com/TakinaHua/Atlas)',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      if (response.status === 429) backoffUntil = now() + 60000;
      throw new Error('Photo provider unavailable');
    }
    return pagesSchema.parse(await response.json()).query.pages;
  }
  async function lookup(location: DestinationLocation): Promise<DestinationPhoto | null> {
    if (location.kind === 'state') {
      const capitalName = capitals[location.stateCode];
      const capital =
        capitalName &&
        searchDestinations(`${capitalName} ${location.stateCode}`, 50).find(
          (item) =>
            item.kind === 'city' &&
            item.stateCode === location.stateCode &&
            normalize(item.name) === normalize(capitalName),
        );
      if (!capital) return null;
      const photo = await lookup(capital);
      return photo
        ? {
            ...photo,
            locationLabel: `${capital.name} · ${location.name}${location.stateCode === 'DC' ? '' : ' state capital'}`,
          }
        : null;
    }
    const titles = `${location.name}, ${location.state}|${location.name}`;
    const pages = await query('en.wikipedia.org', {
      titles,
      redirects: '1',
      prop: 'pageimages|coordinates',
      piprop: 'name',
      pilicense: 'free',
      colimit: 'max',
    });
    const page = pages.find((p) => p.pageimage && matches(location, p));
    if (
      !page?.pageimage ||
      /(?:flag|seal|logo|coat.of.arms|locator|map\b)/i.test(page.pageimage)
    )
      return null;
    const files = await query('commons.wikimedia.org', {
      titles: `File:${page.pageimage}`,
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata',
      iiurlwidth: '960',
      iiextmetadatalanguage: 'en',
      iiextmetadatafilter:
        'Artist|Credit|Attribution|LicenseShortName|LicenseUrl|AttributionRequired|Copyrighted',
    });
    const info = files[0]?.imageinfo?.[0];
    if (
      !info ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime || '') ||
      (info.width || 0) < 400
    )
      return null;
    const meta = info.extmetadata || {};
    const author = plain(meta.Attribution?.value || meta.Artist?.value || '');
    const credit = plain(meta.Credit?.value || '');
    const license = plain(meta.LicenseShortName?.value || '');
    const licenseUrl = safeUrl(
      meta.LicenseUrl?.value?.replace(/^http:/, 'https:'),
      'creativecommons.org',
      '/',
    );
    const publicDomain = /^(public domain|cc0)$/i.test(license);
    if (
      !author ||
      author.length > 600 ||
      (!publicDomain && (!/^CC BY(?:-SA)? \d\.\d$/i.test(license) || !licenseUrl))
    )
      return null;
    const url =
      safeUrl(info.thumburl, 'upload.wikimedia.org', '/wikipedia/commons/') ||
      safeUrl(info.thumburl, 'thumb.wikimedia.org', '/wikipedia/commons/');
    const sourceUrl = safeUrl(
      info.descriptionurl,
      'commons.wikimedia.org',
      '/wiki/File:',
    );
    if (!url || !sourceUrl) return null;
    return {
      url,
      sourceUrl,
      author,
      license,
      licenseUrl: licenseUrl || sourceUrl,
      title: plain(page.pageimage.replace(/_/g, ' ')),
      locationLabel: location.label,
      credit,
    };
  }
  return async (id: string) => {
    const location = destinationById(id); // Resolve catalog data before any outbound request.
    for (const [key, entry] of cache) if (entry.expires <= now()) cache.delete(key);
    const hit = cache.get(id);
    if (hit) {
      cache.delete(id);
      cache.set(id, hit);
      return structuredClone(hit.photo);
    }
    if (pending.has(id)) return structuredClone(await pending.get(id)!);
    if (pending.size >= 64 || now() < backoffUntil)
      throw new ApiError(
        503,
        'PHOTO_UNAVAILABLE',
        'Destination photos are temporarily unavailable.',
      );
    const work = (async () => {
      if (active >= 3) await new Promise<void>((resolve) => queue.push(resolve));
      else active++;
      try {
        const photo = await lookup(location);
        if (cache.size >= 200) cache.delete(cache.keys().next().value!);
        cache.set(id, { photo, expires: now() + (photo ? 86400000 : 3600000) });
        return photo;
      } catch {
        throw new ApiError(
          503,
          'PHOTO_UNAVAILABLE',
          'Destination photos are temporarily unavailable.',
        );
      } finally {
        const next = queue.shift();
        if (next) next();
        else active--;
        pending.delete(id);
      }
    })();
    pending.set(id, work);
    return structuredClone(await work);
  };
}
