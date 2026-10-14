import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ApiError } from './store.js';

export interface DestinationLocation {
  id: string;
  name: string;
  label: string;
  kind: 'city' | 'state';
  state: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  zoom: number;
}
type Record = DestinationLocation & { population: number; aliases: string[] };
const snapshot = JSON.parse(
  readFileSync(new URL('../assets/us-destinations.json', import.meta.url), 'utf8'),
) as { records: Record[] };
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
const records = snapshot.records.map((record) => ({
  record,
  name: normalize(record.name),
  aliases: record.aliases.map(normalize),
  words: normalize(`${record.name} ${record.state} ${record.stateCode}`).split(' '),
}));
const byId = new Map(snapshot.records.map((record) => [record.id, record]));
function publicLocation(record: Record): DestinationLocation {
  const { population: _population, aliases: _aliases, ...location } = record;
  return location;
}
export const locationInput = z
  .object({
    id: z.string().max(100),
    name: z.string().max(200),
    label: z.string().max(300),
    kind: z.enum(['city', 'state']),
    state: z.string().max(100),
    stateCode: z.string().length(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    zoom: z.number().int().min(1).max(18),
  })
  .strict()
  .nullable()
  .optional();
// Client coordinates are never trusted: resolve saved selections against the snapshot.
export function resolveLocation(
  input: z.infer<typeof locationInput>,
): DestinationLocation | null {
  if (!input) return null;
  const record = byId.get(input.id);
  if (!record)
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'This destination is not in the current catalog. Search and select it again.',
    );
  return publicLocation(record);
}
export function searchDestinations(query: string, limit = 10): DestinationLocation[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ');
  const scores: { record: Record; score: number }[] = [];
  const suffix = tokens.at(-1)!;
  const stateFilter =
    tokens.length > 1 &&
    snapshot.records.some(
      (r) => r.kind === 'state' && r.stateCode.toLowerCase() === suffix,
    )
      ? suffix
      : null;
  for (const item of records) {
    const r = item.record;
    if (stateFilter && r.stateCode.toLowerCase() !== stateFilter) continue;
    let score = 0;
    if (r.kind === 'state' && (item.name === q || r.stateCode.toLowerCase() === q))
      score = 120;
    else if (item.name === q) score = 110;
    else if (item.aliases.includes(q)) score = 100;
    else if (item.name.startsWith(q)) score = 90;
    else if (tokens.every((token) => item.words.some((word) => word.startsWith(token))))
      score = 80;
    else if (item.aliases.some((alias) => alias.startsWith(q))) score = 70;
    if (score) scores.push({ record: r, score });
  }
  return scores
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.record.population - a.record.population ||
        a.record.label.localeCompare(b.record.label) ||
        a.record.id.localeCompare(b.record.id),
    )
    .slice(0, limit)
    .map((r) => publicLocation(r.record));
}
