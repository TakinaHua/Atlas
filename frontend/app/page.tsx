'use client';

import './planner-edition.css';
import './dashboard-edition.css';
import './pinboard.css';
import './journey-studio.css';
import JourneyStudio from '../components/JourneyStudio';
import TravelCover from '../components/TravelCover';
import { coastalSample, walkingSample } from '../lib/sample-trips';
import { useCallback, useEffect, useRef, useState } from 'react';
import DestinationPhoto from '../components/DestinationPhoto';
import EditorDialog from '../components/EditorDialog';
import TripForm from '../components/TripForm';
import PlaceForm from '../components/PlaceForm';
import { displayDate } from '../lib/display-date';
import { itineraryDates } from '../lib/api';
import { api } from '../lib/remote-api';
import type { CalculatedRoute, WalkingDemoRoute, Place, Trip } from '../lib/types';

type Editor =
  { kind: 'trip'; trip?: Trip } | { kind: 'place'; date: string | null; place?: Place };
const LOCAL_TRIPS_KEYS = ['atlas.preview.trips.v1', 'atlas.trips.v1'];
export default function Home() {
  const [boardOpen, setBoardOpen] = useState(false);
  const [cover, setCover] = useState(0);
  const [boardPage, setBoardPage] = useState(0);
  const [pageDirection, setPageDirection] = useState(1);
  const handleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tripSearch, setTripSearch] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [sampleTrip, setSampleTrip] = useState<Trip | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<CalculatedRoute | null>(null);
  const [demoRoute, setDemoRoute] = useState<WalkingDemoRoute | null>(null);
  const [routing, setRouting] = useState<'driving' | 'demo' | null>(null);
  const [routeError, setRouteError] = useState('');
  const routeController = useRef<AbortController | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasLocalTrips, setHasLocalTrips] = useState(false);
  // Invalidating the generation prevents a late route response from painting another day.
  const routeGeneration = useRef(0);
  const isSample = sampleTrip !== null && sampleTrip.id === tripId;
  const trip = isSample ? sampleTrip : trips.find((item) => item.id === tripId);
  const day = trip?.days.find((item) => item.date === date);
  const matchingTrips = trips.filter((item) =>
    (item.name + ' ' + item.destination)
      .toLocaleLowerCase()
      .includes(tripSearch.toLocaleLowerCase().trim()),
  );
  const pages = Math.ceil(matchingTrips.length / 4);
  const currentPage = Math.min(boardPage, Math.max(0, pages - 1));
  const pinnedTrips = matchingTrips.slice(currentPage * 4, currentPage * 4 + 4);

  useEffect(() => {
    if (boardOpen && !trip) closeRef.current?.focus({ preventScroll: true });
  }, [boardOpen, trip?.id]);

  function closeBoard() {
    setBoardOpen(false);
    requestAnimationFrame(() => handleRef.current?.focus({ preventScroll: true }));
  }

  function showBoard() {
    clearRoute();
    setTripId(null);
    setBoardOpen(true);
  }

  function changeDay(nextDate: string) {
    if (nextDate === date) return;
    clearRoute();
    setDate(nextDate);
    setSelectedId(null);
  }

  const refresh = useCallback(async () => {
    routeGeneration.current += 1;
    routeController.current?.abort();
    setRouting(null);
    setRouteError('');
    setRoute(null);
    setDemoRoute(null);
    const data = await api<{ trips: Trip[] }>('/trips');
    setTrips(data.trips);
    setTripsLoaded(true);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        try {
          setHasLocalTrips(
            LOCAL_TRIPS_KEYS.some((key) => Boolean(localStorage.getItem(key))),
          );
        } catch {
          /* Browser storage is optional; server trips still work. */
        }
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unable to load trips.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [refresh]);

  function clearRoute() {
    routeGeneration.current += 1;
    routeController.current?.abort();
    setRouting(null);
    setRouteError('');
    setRoute(null);
    setDemoRoute(null);
  }

  async function calculateDayRoute(mode: 'driving' | 'demo' = 'driving') {
    if (
      !day ||
      day.places.length < 2 ||
      day.places.some((p) => p.latitude === null || p.longitude === null)
    )
      return;
    clearRoute();
    const generation = routeGeneration.current;
    const controller = new AbortController();
    routeController.current = controller;
    setRouting(mode);
    try {
      const response = await fetch(
        mode === 'demo' ? '/api/routes/walking-demo' : '/api/routes',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stops: day.places.map(({ latitude, longitude }) => ({ latitude, longitude })),
          }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? 'Route calculation failed. Please try again.',
        );
      if (generation === routeGeneration.current) {
        if (mode === 'demo') setDemoRoute(result);
        else setRoute(result);
      }
    } catch (error) {
      if (generation === routeGeneration.current && !controller.signal.aborted)
        setRouteError(
          error instanceof Error && error.name !== 'TimeoutError'
            ? error.message
            : 'Routing timed out. Please try again.',
        );
    } finally {
      if (generation === routeGeneration.current) setRouting(null);
    }
  }

  function openTrip(next: Trip) {
    clearRoute();
    setTripId(next.id);
    setDate(next.startDate);
    setSelectedId(null);
  }

  /** Updates appear only after the server commits the save. */
  async function saveTrip(next: Trip) {
    if (isSample) {
      const updated = { ...next, revision: next.revision + 1 };
      setSampleTrip(updated);
      clearRoute();
      return updated;
    }
    const saved = await api<Trip>(`/trips/${encodeURIComponent(next.id)}`, 'PUT', next);
    setTrips((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    clearRoute();
    return saved;
  }

  async function run(action: () => Promise<void>) {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The action failed.');
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function saveEditor(data: FormData) {
    if (editor?.kind === 'trip') {
      const name = String(data.get('name')).trim();
      const destination = String(data.get('destination')).trim();
      const destinationLocation = data.get('destinationLocation')
        ? JSON.parse(String(data.get('destinationLocation')))
        : null;
      const startDate = String(data.get('startDate'));
      const endDate = String(data.get('endDate'));
      const dates = itineraryDates(startDate, endDate);
      const previous = editor.trip;
      if (
        previous?.days.some((day) => !dates.includes(day.date) && day.places.length > 0)
      ) {
        throw new Error(
          'Those dates would remove saved destinations. Move or remove those stops first.',
        );
      }
      const days = dates.map(
        (date) => previous?.days.find((day) => day.date === date) || { date, places: [] },
      );
      if (previous) {
        openTrip(
          await saveTrip({
            ...previous,
            name,
            destination,
            destinationLocation,
            startDate,
            endDate,
            days,
          }),
        );
      } else {
        const created = await api<Trip>('/trips', 'POST', {
          name,
          destination,
          destinationLocation,
          startDate,
          endDate,
          days,
        });
        setTrips((current) => [created, ...current]);
        openTrip(created);
      }
      return;
    }
    if (!trip || editor?.kind !== 'place') return;
    const latitudeText = String(data.get('latitude'));
    const longitudeText = String(data.get('longitude'));
    if ((latitudeText === '') !== (longitudeText === ''))
      throw new Error('Enter both coordinates, or leave both empty.');
    const place: Place = {
      id: editor.place?.id || crypto.randomUUID(),
      name: String(data.get('name')).trim(),
      address: String(data.get('address')).trim(),
      category: String(data.get('category')).trim(),
      notes: String(data.get('notes')).trim(),
      latitude: latitudeText === '' ? null : Number(latitudeText),
      longitude: longitudeText === '' ? null : Number(longitudeText),
    };
    const target = editor.date;
    const previousPlaces =
      target === null
        ? (trip.savedPlaces ?? [])
        : trip.days.find((item) => item.date === target)?.places;
    if (!previousPlaces)
      throw new Error('That day is no longer available. Reopen the trip.');
    if (!editor.place && previousPlaces.length >= (target === null ? 120 : 30))
      throw new Error(
        target === null
          ? 'Saved for later is full (120 places).'
          : 'That day already has 30 places.',
      );
    const places = editor.place
      ? previousPlaces.map((item) => (item.id === place.id ? place : item))
      : [...previousPlaces, place];
    await saveTrip(
      target === null
        ? { ...trip, savedPlaces: places }
        : {
            ...trip,
            days: trip.days.map((item) =>
              item.date === target ? { ...item, places } : item,
            ),
          },
    );
    if (target !== null) setDate(target);
    setSelectedId(place.id);
  }

  async function placeAction(
    source: string | null,
    place: Place,
    target?: string | null,
    beforeId?: string,
  ) {
    if (!trip || (source === target && place.id === beforeId)) return;
    const saved = trip.savedPlaces ?? [];
    const without = (places: Place[]) => places.filter((item) => item.id !== place.id);
    const insert = (places: Place[]) => {
      const next = without(places);
      const index = beforeId ? next.findIndex((item) => item.id === beforeId) : -1;
      next.splice(index < 0 ? next.length : index, 0, place);
      return next;
    };
    const targetDay = trip.days.find((item) => item.date === target);
    if (typeof target === 'string' && !targetDay)
      throw new Error('That day is no longer available. Reopen the trip.');
    if (source !== target && targetDay && targetDay.places.length >= 30)
      throw new Error('That day already has 30 places.');
    if (source !== target && target === null && saved.length >= 120)
      throw new Error('Saved for later is full (120 places).');
    if (
      source === null &&
      targetDay?.places.some(
        (item) =>
          item.name.trim().toLowerCase() === place.name.trim().toLowerCase() &&
          (place.latitude !== null && item.latitude !== null
            ? place.latitude.toFixed(5) === item.latitude.toFixed(5) &&
              place.longitude?.toFixed(5) === item.longitude?.toFixed(5)
            : place.address.trim().toLowerCase() === item.address.trim().toLowerCase()),
      )
    )
      throw new Error('This place is already on that day.');
    await saveTrip({
      ...trip,
      savedPlaces:
        target === null ? insert(saved) : source === null ? without(saved) : saved,
      days: trip.days.map((item) => {
        if (item.date === target) return { ...item, places: insert(item.places) };
        if (item.date === source) return { ...item, places: without(item.places) };
        return item;
      }),
    });
    if (typeof target === 'string') setDate(target);
    setSelectedId(
      target === undefined ? (selectedId === place.id ? null : selectedId) : place.id,
    );
    if (source !== target && target !== undefined)
      setNotice(
        target === null
          ? `${place.name} saved for later.`
          : `${place.name} moved to ${displayDate(target)}.`,
      );
  }

  async function importTrips(raw: string) {
    const parsed = JSON.parse(raw);
    const result = await api<{ imported: number; skipped: number }>(
      '/trips/import',
      'POST',
      { trips: parsed },
    );
    await refresh();
    setNotice(
      `Imported ${result.imported} trips; ${result.skipped} already imported. Original data is unchanged.`,
    );
  }

  function deleteTrip(target: Trip) {
    if (!window.confirm(`Delete “${target.name}” and all its destinations?`)) return;
    void run(async () => {
      await api(`/trips/${encodeURIComponent(target.id)}`, 'DELETE', {
        revision: target.revision,
      });
      setTrips((current) => current.filter((item) => item.id !== target.id));
      if (tripId === target.id) {
        showBoard();
      }
    });
  }

  function exportTrips() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atlas-trips.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            ↗
          </span>
          Atlas
        </a>
        {trip ? (
          <>
            <span className="studio-name">Journey Studio</span>
            <button className="secondary" onClick={showBoard}>
              My trips
            </button>
          </>
        ) : (
          <>
            <span className="edition-name">Travel Editions</span>
            <button disabled={busy} onClick={() => setEditor({ kind: 'trip' })}>
              Plan a trip
            </button>
          </>
        )}
      </header>
      <main id="main" className={trip ? 'edition studio-page' : 'edition dashboard'}>
        {error && (
          <div className="error" role="alert">
            {error}{' '}
            <button
              className="secondary"
              onClick={() =>
                void run(async () => {
                  await refresh();
                  clearRoute();
                  setTripId(null);
                })
              }
            >
              Reload trips
            </button>
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!trip ? (
          <div className="home-stage">
            <div className="cover-layer" inert={boardOpen}>
              <TravelCover
                index={cover}
                change={setCover}
                active={!boardOpen && !editor}
                preview={() => {
                  const sample = cover === 0 ? walkingSample() : coastalSample();
                  setSampleTrip(sample);
                  openTrip(sample);
                }}
              />
              <button
                className="board-handle"
                ref={handleRef}
                aria-expanded={boardOpen}
                aria-controls="trip-board"
                onClick={() => setBoardOpen(true)}
              >
                My trips <span aria-hidden="true">↑</span>
              </button>
            </div>
            <section
              id="trip-board"
              className="trip-board"
              data-open={boardOpen}
              aria-label="My trips"
              inert={!boardOpen}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeBoard();
              }}
            >
              <div className="board-inner">
                <div className="board-heading">
                  <h2>My trips</h2>
                  <button ref={closeRef} className="board-close" onClick={closeBoard}>
                    Close <span aria-hidden="true">↓</span>
                  </button>
                </div>
                {trips.length > 0 && (
                  <label className="trip-search">
                    <span>Search your trips</span>
                    <input
                      type="search"
                      placeholder="Find a trip or destination"
                      value={tripSearch}
                      onChange={(event) => {
                        setTripSearch(event.target.value);
                        setBoardPage(0);
                      }}
                    />
                  </label>
                )}
                {loading && <p role="status">Loading your trips…</p>}
                {pinnedTrips.length > 0 && (
                  <div
                    key={currentPage}
                    className="pin-grid"
                    data-direction={pageDirection}
                  >
                    {pinnedTrips.map((item) => (
                      <article key={item.id} className="trip-card pinned-print">
                        <div className="print-photo">
                          <DestinationPhoto
                            destination={item.destination}
                            location={item.destinationLocation}
                          />
                        </div>
                        <div className="print-caption">
                          <h3>
                            <button
                              aria-label={'Open itinerary: ' + item.name}
                              onClick={() => openTrip(item)}
                            >
                              {item.name}
                            </button>
                          </h3>
                          <p>
                            {item.destination} · {displayDate(item.startDate)} –{' '}
                            {displayDate(item.endDate, true)}
                          </p>
                        </div>
                        <button
                          className="print-delete"
                          disabled={busy}
                          onClick={() => deleteTrip(item)}
                          aria-label={'Delete ' + item.name}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
                  </div>
                )}
                {pages > 1 && (
                  <nav className="board-pages" aria-label="Trip pages">
                    <button
                      aria-label="Previous trip page"
                      disabled={currentPage === 0}
                      onClick={() => {
                        setPageDirection(-1);
                        setBoardPage(currentPage - 1);
                      }}
                    >
                      ←
                    </button>
                    <span aria-live="polite">
                      {currentPage + 1} / {pages}
                    </span>
                    <button
                      aria-label="Next trip page"
                      disabled={currentPage === pages - 1}
                      onClick={() => {
                        setPageDirection(1);
                        setBoardPage(currentPage + 1);
                      }}
                    >
                      →
                    </button>
                  </nav>
                )}
                {tripsLoaded && !trips.length && (
                  <div className="blank-postcard">
                    <h3>Your first trip goes here.</h3>
                    <button onClick={() => setEditor({ kind: 'trip' })}>
                      Plan your first trip
                    </button>
                  </div>
                )}
                {trips.length > 0 && !matchingTrips.length && (
                  <p>
                    No trips match “{tripSearch}”.{' '}
                    <button className="text-button" onClick={() => setTripSearch('')}>
                      Clear search
                    </button>
                  </p>
                )}
                <details className="board-tools">
                  <summary>Import and export</summary>
                  <section className="data-tools">
                    <p>
                      Trips are saved by Atlas and stay available when you reload or
                      switch browsers on this computer. Export a backup to keep a separate
                      copy.
                    </p>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={!trips.length || busy}
                        onClick={exportTrips}
                      >
                        Export trips
                      </button>
                      <label className="file-label">
                        Import JSON backup
                        <input
                          type="file"
                          accept="application/json,.json"
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file)
                              void run(async () => {
                                if (file.size > 900000)
                                  throw new Error('Choose a file smaller than 900 KB.');
                                await importTrips(await file.text());
                              });
                            event.target.value = '';
                          }}
                        />
                      </label>
                      {hasLocalTrips && (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const saved = LOCAL_TRIPS_KEYS.flatMap((key) => {
                                const value: unknown = JSON.parse(
                                  localStorage.getItem(key) || '[]',
                                );
                                if (!Array.isArray(value))
                                  throw new Error(
                                    'Saved browser trips are invalid. Export or recover them before importing.',
                                  );
                                return value;
                              });
                              await importTrips(JSON.stringify(saved));
                            })
                          }
                        >
                          Import browser trips
                        </button>
                      )}
                    </div>
                    <p className="muted">
                      Old browser trips appear only on their original browser address.
                      Otherwise, import an exported JSON file.
                    </p>
                  </section>
                </details>
              </div>
            </section>
          </div>
        ) : (
          <JourneyStudio
            key={trip.id}
            trip={trip}
            date={date}
            selectedId={selectedId}
            busy={busy}
            isSample={isSample}
            changeDay={changeDay}
            selectPlace={(id, stopDate) => {
              if (stopDate && stopDate !== date) changeDay(stopDate);
              setSelectedId(id);
            }}
            openPlace={(date, place) => setEditor({ kind: 'place', date, place })}
            editTrip={() => setEditor({ kind: 'trip', trip })}
            deleteTrip={() => deleteTrip(trip)}
            saveSample={() =>
              void run(async () => {
                const saved = await api<Trip>('/trips', 'POST', trip);
                setTrips((current) => [saved, ...current]);
                setSampleTrip(null);
                openTrip(saved);
              })
            }
            placeAction={(...args) => void run(() => placeAction(...args))}
            routeState={{
              route,
              demoRoute,
              routing,
              routeError,
              clearRoute,
              calculateDayRoute,
            }}
          />
        )}
      </main>
      <footer>Atlas</footer>
      {editor && (
        <EditorDialog
          title={
            editor.kind === 'trip'
              ? editor.trip
                ? 'Edit trip'
                : 'Start a new journey'
              : editor.place
                ? 'Edit place'
                : editor.date === null
                  ? 'Save a place for later'
                  : 'Add a place'
          }
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        >
          {editor.kind === 'trip' ? (
            <TripForm trip={editor.trip} />
          ) : (
            <PlaceForm place={editor.place} location={trip?.destinationLocation} />
          )}
        </EditorDialog>
      )}
    </>
  );
}
