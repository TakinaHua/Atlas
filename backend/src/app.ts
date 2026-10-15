import { createRouting, routeInput } from './routing.js';
import { createPlaceSearch, placeQuery } from './place-search.js';
import { searchDestinations } from './destinations.js';
import { itineraryRouter } from './itineraries.js';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { ApiError, TripStore } from './store.js';
import type { Trip } from './models.js';
import {
  tripInput,
  tripPatch,
  dayInput,
  dayPatch,
  destinationInput,
  destinationPatch,
  reorderInput,
} from './validation.js';

function find<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((item) => item.id === id);
  if (!item) throw new ApiError(404, 'NOT_FOUND', `${label} not found`);
  return item;
}
function checkDates(trip: Pick<Trip, 'startDate' | 'endDate'>): void {
  if (trip.startDate && trip.endDate && trip.startDate > trip.endDate)
    throw new ApiError(400, 'VALIDATION_ERROR', 'endDate must be on or after startDate');
}
function reorder<T extends { id: string }>(items: T[], body: unknown): T[] {
  const { ids } = reorderInput.parse(body);
  if (
    ids.length !== items.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !items.some((item) => item.id === id))
  )
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'ids must contain every current child ID exactly once',
    );
  return ids.map((id) => find(items, id, 'Item'));
}
function renumber(trip: Trip): void {
  trip.days.forEach((day, i) => {
    day.dayNumber = i + 1;
  });
}

export function createApp(
  store: TripStore,
  origins: string[] = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ],
) {
  const app = express();
  const searchPlaces = createPlaceSearch();
  const calculateRoute = createRouting();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) callback(null, true);
        else callback(new ApiError(403, 'CORS_FORBIDDEN', 'Origin is not allowed'));
      },
    }),
  );
  app.use('/api/itineraries', express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use((req, _res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('application/json'))
      return next(
        new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use Content-Type: application/json'),
      );
    next();
  });
  app.use('/api/itineraries', itineraryRouter(store));
  app.get('/api/destinations', (req, res) => {
    const query = req.query.q;
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100)
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Enter between 2 and 100 characters to search.',
      );
    res
      .set('Cache-Control', 'public, max-age=3600')
      .json({ results: searchDestinations(query), attribution: 'GeoNames — CC BY 4.0' });
  });
  app.get('/api/places/search', async (req, res) => {
    const results = await searchPlaces(placeQuery.parse(req.query));
    res.json({ results, attribution: '© OpenStreetMap contributors' });
  });
  app.post('/api/routes', async (req, res) => {
    res.json(await calculateRoute(routeInput.parse(req.body)));
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/trips', (_req, res) => res.json(store.list()));
  app.post('/api/trips', (req, res) => {
    const input = tripInput.parse(req.body);
    checkDates(input);
    const now = new Date().toISOString();
    const trip = store.create({
      ...input,
      id: randomUUID(),
      days: [],
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).location(`/api/trips/${trip.id}`).json(trip);
  });
  app.get('/api/trips/:tripId', (req, res) => res.json(store.get(req.params.tripId)));
  app.patch('/api/trips/:tripId', (req, res) => {
    const input = tripPatch.parse(req.body);
    res.json(
      store.update(req.params.tripId, (trip) => {
        Object.assign(trip, input);
        checkDates(trip);
        return trip;
      }),
    );
  });
  app.delete('/api/trips/:tripId', (req, res) => {
    store.delete(req.params.tripId);
    res.sendStatus(204);
  });

  const days = '/api/trips/:tripId/days';
  app.get(days, (req, res) => res.json(store.get(req.params.tripId).days));
  app.post(days, (req, res) => {
    const input = dayInput.parse(req.body);
    const day = store.update(req.params.tripId, (trip) => {
      const day = {
        ...input,
        id: randomUUID(),
        dayNumber: trip.days.length + 1,
        destinations: [],
      };
      trip.days.push(day);
      return day;
    });
    res.status(201).location(`/api/trips/${req.params.tripId}/days/${day.id}`).json(day);
  });
  app.put(`${days}/reorder`, (req, res) =>
    res.json(
      store.update(req.params.tripId, (trip) => {
        trip.days = reorder(trip.days, req.body);
        renumber(trip);
        return trip.days;
      }),
    ),
  );
  app.get(`${days}/:dayId`, (req, res) =>
    res.json(find(store.get(req.params.tripId).days, req.params.dayId, 'Day')),
  );
  app.patch(`${days}/:dayId`, (req, res) => {
    const input = dayPatch.parse(req.body);
    res.json(
      store.update(req.params.tripId, (trip) =>
        Object.assign(find(trip.days, req.params.dayId, 'Day'), input),
      ),
    );
  });
  app.delete(`${days}/:dayId`, (req, res) => {
    store.update(req.params.tripId, (trip) => {
      find(trip.days, req.params.dayId, 'Day');
      trip.days = trip.days.filter((day) => day.id !== req.params.dayId);
      renumber(trip);
    });
    res.sendStatus(204);
  });

  const destinations = `${days}/:dayId/destinations`;
  app.get(destinations, (req, res) =>
    res.json(
      find(store.get(req.params.tripId).days, req.params.dayId, 'Day').destinations,
    ),
  );
  app.post(destinations, (req, res) => {
    const input = destinationInput.parse(req.body);
    const destination = store.update(req.params.tripId, (trip) => {
      const day = find(trip.days, req.params.dayId, 'Day');
      const destination = { ...input, id: randomUUID() };
      day.destinations.push(destination);
      return destination;
    });
    res
      .status(201)
      .location(
        `/api/trips/${req.params.tripId}/days/${req.params.dayId}/destinations/${destination.id}`,
      )
      .json(destination);
  });
  app.put(`${destinations}/reorder`, (req, res) =>
    res.json(
      store.update(req.params.tripId, (trip) => {
        const day = find(trip.days, req.params.dayId, 'Day');
        day.destinations = reorder(day.destinations, req.body);
        return day.destinations;
      }),
    ),
  );
  app.get(`${destinations}/:destinationId`, (req, res) => {
    const day = find(store.get(req.params.tripId).days, req.params.dayId, 'Day');
    res.json(find(day.destinations, req.params.destinationId, 'Destination'));
  });
  app.patch(`${destinations}/:destinationId`, (req, res) => {
    const input = destinationPatch.parse(req.body);
    res.json(
      store.update(req.params.tripId, (trip) => {
        const day = find(trip.days, req.params.dayId, 'Day');
        return Object.assign(
          find(day.destinations, req.params.destinationId, 'Destination'),
          input,
        );
      }),
    );
  });
  app.delete(`${destinations}/:destinationId`, (req, res) => {
    store.update(req.params.tripId, (trip) => {
      const day = find(trip.days, req.params.dayId, 'Day');
      find(day.destinations, req.params.destinationId, 'Destination');
      day.destinations = day.destinations.filter(
        (item) => item.id !== req.params.destinationId,
      );
    });
    res.sendStatus(204);
  });
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'Endpoint not found')),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: error.issues,
        },
      });
      return;
    }
    if (error instanceof ApiError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error.type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
      return;
    }
    if (error.status >= 400 && error.status < 500) {
      res.status(error.status).json({
        error: {
          code: 'INVALID_REQUEST',
          message:
            error.status === 413 ? 'Request body is too large' : 'Invalid request body',
        },
      });
      return;
    }
    console.error(error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred' },
    });
  };
  app.use(errors);
  return app;
}
