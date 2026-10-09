import type { Trip } from './types';
import { itineraryDates } from './api';

export const STORAGE_KEY = 'atlas.preview.trips.v1';

function validate(value: unknown): Trip {
  const trip = value as Trip;
  if (
    !trip ||
    typeof trip.id !== 'string' ||
    !trip.id ||
    typeof trip.name !== 'string' ||
    !trip.name.trim() ||
    typeof trip.destination !== 'string' ||
    !trip.destination.trim()
  )
    throw new Error('Every trip needs an ID, name, and destination.');
  const dates = itineraryDates(trip.startDate, trip.endDate);
  if (
    !Array.isArray(trip.days) ||
    trip.days.length !== dates.length ||
    trip.days.some(
      (day, i) =>
        !day ||
        day.date !== dates[i] ||
        !Array.isArray(day.places) ||
        day.places.length > 30,
    )
  )
    throw new Error('Trip days must match the date range, with up to 30 places per day.');
  const ids = new Set<string>();
  for (const day of trip.days)
    for (const place of day.places) {
      if (
        !place ||
        typeof place.id !== 'string' ||
        ids.has(place.id) ||
        typeof place.name !== 'string' ||
        !place.name.trim() ||
        !['address', 'category', 'notes'].every(
          (key) => typeof place[key as keyof typeof place] === 'string',
        )
      )
        throw new Error('Invalid place in trip backup.');
      ids.add(place.id);
      if (
        !(place.latitude === null && place.longitude === null) &&
        !(
          typeof place.latitude === 'number' &&
          Number.isFinite(place.latitude) &&
          Math.abs(place.latitude) <= 90 &&
          typeof place.longitude === 'number' &&
          Number.isFinite(place.longitude) &&
          Math.abs(place.longitude) <= 180
        )
      )
        throw new Error('Enter valid latitude and longitude together.');
    }
  return { ...trip, revision: Number.isInteger(trip.revision) ? trip.revision : 1 };
}
function read(): Trip[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values))
    throw new Error(
      'Saved trip data is invalid. Export or recover it before continuing.',
    );
  return values.map(validate);
}
function write(trips: Trip[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch {
    throw new Error(
      'Browser storage is full or unavailable. Your change was not saved. Export a backup or free space and try again.',
    );
  }
}

/** Same asynchronous boundary as a future API, without building backend persistence. */
export async function previewStore<T>(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const trips = read();
  if (path === '/trips' && method === 'GET') return { trips } as T;
  if (path === '/trips/import' && method === 'POST') {
    const incoming = (data as { trips: unknown }).trips;
    if (!Array.isArray(incoming) || incoming.length > 100)
      throw new Error('Import an array containing up to 100 trips.');
    const checked = incoming.map(validate); // Validate the entire import before changing storage.
    let imported = 0;
    for (const trip of checked)
      if (!trips.some((saved) => saved.id === trip.id)) {
        trips.push(trip);
        imported++;
      }
    write(trips);
    return { imported, skipped: checked.length - imported } as T;
  }
  if (path === '/trips' && method === 'POST') {
    const trip = validate({ ...(data as object), id: crypto.randomUUID(), revision: 1 });
    write([trip, ...trips]);
    return trip as T;
  }
  const id = path.match(/^\/trips\/([^/]+)$/)?.[1];
  const index = trips.findIndex((trip) => trip.id === id);
  if (index < 0) throw new Error('Trip no longer exists. Reload trips.');
  const incoming = data as Trip;
  if (incoming.revision !== trips[index].revision)
    throw new Error('Trip changed in another tab. Reload trips before saving.');
  if (method === 'DELETE') {
    write(trips.filter((trip) => trip.id !== id));
    return {} as T;
  }
  if (method === 'PUT') {
    const trip = validate({ ...incoming, id, revision: incoming.revision + 1 });
    trips[index] = trip;
    write(trips);
    return trip as T;
  }
  throw new Error('This action is not part of the frontend preview.');
}
