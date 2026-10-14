import { locationInput, resolveLocation } from './destinations.js';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError, TripStore } from './store.js';
import type { Trip } from './models.js';

const id = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(200);
const revision = z.number().int().positive();
const place = z
  .object({
    id,
    name: text,
    address: z.string().max(300),
    category: z.string().max(200),
    notes: z.string().max(5000),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .strict()
  .refine(
    (p) => (p.latitude === null) === (p.longitude === null),
    'Enter both coordinates, or leave both empty.',
  );
const fields = {
  destinationLocation: locationInput,
  name: text,
  destination: z.string().trim().max(200),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  days: z
    .array(z.object({ date: z.iso.date(), places: z.array(place).max(30) }).strict())
    .min(1)
    .max(60),
};
const tripSchema = z
  .object({ ...fields, id: id.optional(), revision: revision.optional() })
  .strict()
  .superRefine((trip, ctx) => {
    const dates = datesBetween(trip.startDate, trip.endDate);
    if (
      dates.length < 1 ||
      dates.length > 60 ||
      dates.length !== trip.days.length ||
      trip.days.some((day, index) => day.date !== dates[index])
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Trip days must match the date range (1–60 days).',
      });
    const ids = trip.days.flatMap((day) => day.places.map((p) => p.id));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Place IDs must be unique within a trip.',
      });
  });
type ItineraryInput = z.infer<typeof tripSchema>;

function datesBetween(start: string, end: string): string[] {
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (count < 1 || count > 36600) return [];
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
  );
}

// Both APIs use the same trip rows. Older Phase 1 records get display defaults,
// without modifying the database on a read or dropping their existing stops.
export function toItinerary(trip: Trip) {
  const startDate = trip.startDate ?? trip.endDate ?? trip.createdAt.slice(0, 10);
  const minimumEnd = new Date(
    Date.parse(startDate) + Math.max(0, trip.days.length - 1) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const endDate = trip.endDate && trip.endDate > minimumEnd ? trip.endDate : minimumEnd;
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination ?? '',
    destinationLocation: trip.destinationLocation ?? null,
    startDate,
    endDate,
    revision: trip.revision ?? 1,
    days: datesBetween(startDate, endDate).map((date, i) => ({
      date,
      places: (trip.days[i]?.destinations ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address ?? '',
        category: p.category ?? '',
        notes: p.notes ?? '',
        latitude: p.latitude,
        longitude: p.longitude,
      })),
    })),
  };
}

function applyItinerary(trip: Trip, input: ItineraryInput): void {
  const previous = toItinerary(trip);
  const byDate = new Map(previous.days.map((day, i) => [day.date, trip.days[i]]));
  // Enforce date-shrink protection server-side, not only in the UI.
  if (
    previous.days.some(
      (day) => day.places.length && !input.days.some((next) => next.date === day.date),
    )
  )
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Remove the stops on excluded dates before shortening this trip.',
    );
  trip.name = input.name;
  if (input.destinationLocation !== undefined)
    trip.destinationLocation = resolveLocation(input.destinationLocation);
  else if (input.destination !== trip.destination) trip.destinationLocation = null;
  trip.destination = trip.destinationLocation?.label ?? input.destination;
  trip.startDate = input.startDate;
  trip.endDate = input.endDate;
  trip.days = input.days.map((day, i) => ({
    ...byDate.get(day.date),
    id: byDate.get(day.date)?.id ?? randomUUID(),
    dayNumber: i + 1,
    destinations: day.places.map((p) => ({ ...p })),
  }));
}
function createTrip(input: ItineraryInput, tripId: string): Trip {
  const now = new Date().toISOString();
  const trip: Trip = {
    id: tripId,
    name: input.name,
    days: [],
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  applyItinerary(trip, input);
  return trip;
}
function checkRevision(trip: Trip, expected: number) {
  if ((trip.revision ?? 1) !== expected)
    throw new ApiError(
      409,
      'CONFLICT',
      'This trip changed elsewhere. Close this form and reload trips before saving again.',
    );
}

export function itineraryRouter(store: TripStore) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/', (_req, res) => res.json({ trips: store.list().map(toItinerary) }));
  router.post('/', (req, res) => {
    const input = tripSchema.parse(req.body);
    const trip = store.create(createTrip(input, randomUUID()));
    res.status(201).location(`/api/itineraries/${trip.id}`).json(toItinerary(trip));
  });
  router.post('/import', (req, res) => {
    const input = z
      .object({ trips: z.array(tripSchema).max(100) })
      .strict()
      .parse(req.body);
    if (input.trips.some((trip) => !trip.id))
      throw new ApiError(400, 'VALIDATION_ERROR', 'Imported trips need IDs.');
    const result = store.transaction(() => {
      const ids = new Set(store.list().map((trip) => trip.id));
      let imported = 0;
      for (const trip of input.trips) {
        if (ids.has(trip.id!)) continue;
        store.create(createTrip(trip, trip.id!));
        ids.add(trip.id!);
        imported++;
      }
      return { imported, skipped: input.trips.length - imported };
    });
    res.json(result);
  });
  router.get('/:id', (req, res) => res.json(toItinerary(store.get(req.params.id))));
  router.put('/:id', (req, res) => {
    const input = tripSchema.parse(req.body);
    const expected = revision.parse(input.revision);
    if (input.id !== req.params.id)
      throw new ApiError(400, 'VALIDATION_ERROR', 'Trip ID must match the URL.');
    const trip = store.update(req.params.id, (trip) => {
      checkRevision(trip, expected);
      applyItinerary(trip, input);
      return trip;
    });
    res.json(toItinerary(trip));
  });
  router.delete('/:id', (req, res) => {
    const input = z.object({ revision }).strict().parse(req.body);
    store.transaction(() => {
      checkRevision(store.get(req.params.id), input.revision);
      store.delete(req.params.id);
    });
    res.sendStatus(204);
  });
  return router;
}
