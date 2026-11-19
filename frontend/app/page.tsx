'use client';

import dynamic from 'next/dynamic';
import './planner-edition.css';
import './dashboard-edition.css';
import './pinboard.css';
import TravelCover from '../components/TravelCover';
import { coastalSample, walkingSample } from '../lib/sample-trips';
import { useCallback, useEffect, useRef, useState } from 'react';
import DestinationPhoto from '../components/DestinationPhoto';
import EditorDialog from '../components/EditorDialog';
import TripForm from '../components/TripForm';
import PlaceForm from '../components/PlaceForm';
import { itineraryDates } from '../lib/api';
import { api } from '../lib/remote-api';
import type { CalculatedRoute, WalkingDemoRoute, Place, Trip } from '../lib/types';

// Leaflet needs the browser DOM and must not run during server rendering.
const TripMap = dynamic(() => import('../components/TripMap'), {
  ssr: false,
  loading: () => <div className="map empty">Opening the map…</div>,
});
type Editor = { kind: 'trip'; trip?: Trip } | { kind: 'place'; place?: Place };
const LOCAL_TRIPS_KEYS = ['atlas.preview.trips.v1', 'atlas.trips.v1'];
function displayDate(date: string, includeYear = false) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasLocalTrips, setHasLocalTrips] = useState(false);
  // Invalidating the generation prevents a late route response from painting another day.
  const routeGeneration = useRef(0);
  const isSample = sampleTrip !== null && sampleTrip.id === tripId;
  const trip = isSample ? sampleTrip : trips.find((item) => item.id === tripId);
  const day = trip?.days.find((item) => item.date === date);
  const selectPlace = useCallback((id: string) => {
    setSelectedId(id);
    if (window.matchMedia('(min-width: 768px)').matches) {
      const row = document.getElementById(`stop-${id}`);
      const bounds = row?.getBoundingClientRect();
      if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight))
        row?.scrollIntoView({ block: 'center' });
    }
  }, []);

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
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The action failed.');
    } finally {
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
    if (!trip || !day || editor?.kind !== 'place') return;
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
    const places = editor.place
      ? day.places.map((item) => (item.id === place.id ? place : item))
      : [...day.places, place];
    await saveTrip({
      ...trip,
      days: trip.days.map((item) => (item.date === date ? { ...item, places } : item)),
    });
    setSelectedId(place.id);
  }

  async function changePlaces(places: Place[]) {
    if (!trip) return;
    await saveTrip({
      ...trip,
      days: trip.days.map((item) => (item.date === date ? { ...item, places } : item)),
    });
  }

  async function movePlace(place: Place, targetDate: string) {
    if (!trip || !day || targetDate === date) return;
    const target = trip.days.find((item) => item.date === targetDate);
    if (!target) throw new Error('That day is no longer available. Reopen the trip.');
    if (target.places.length >= 30) throw new Error('That day already has 30 places.');
    await saveTrip({
      ...trip,
      days: trip.days.map((item) =>
        item.date === date
          ? { ...item, places: item.places.filter((item) => item.id !== place.id) }
          : item.date === targetDate
            ? { ...item, places: [...item.places, place] }
            : item,
      ),
    });
    setDate(targetDate);
    setSelectedId(place.id);
    setNotice(`${place.name} moved to ${displayDate(targetDate)}.`);
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
          <button className="secondary" onClick={showBoard}>
            My trips
          </button>
        ) : (
          <>
            <span className="edition-name">Travel Editions</span>
            <button disabled={busy} onClick={() => setEditor({ kind: 'trip' })}>
              Plan a trip
            </button>
          </>
        )}
      </header>
      <main id="main" className={trip ? 'edition' : 'edition dashboard'}>
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
          <>
            <button
              className="back"
              onClick={() => {
                showBoard();
              }}
            >
              ← All trips
            </button>
            <div className="trip-overview">
              <DestinationPhoto
                destination={trip.destination}
                location={trip.destinationLocation}
              />
              <div>
                <p className="eyebrow">{trip.destination}</p>
                <h1>{trip.name}</h1>
                <p>
                  {displayDate(trip.startDate, true)} — {displayDate(trip.endDate, true)}{' '}
                  · {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
                </p>
              </div>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditor({ kind: 'trip', trip })}
                >
                  Edit trip
                </button>
                {isSample ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const saved = await api<Trip>('/trips', 'POST', trip);
                        setTrips((current) => [saved, ...current]);
                        setSampleTrip(null);
                        openTrip(saved);
                      })
                    }
                  >
                    Add to my trips
                  </button>
                ) : (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => deleteTrip(trip)}
                  >
                    Delete trip
                  </button>
                )}
              </div>
            </div>
            {isSample && (
              <p className="sample-notice">
                Explore and edit this sample freely. Choose “Add to my trips” to keep it
                in Saved trips.
              </p>
            )}
            <div className="edition-days-heading" id="edition-days" tabIndex={-1}>
              <h2>Itinerary days</h2>
              {trip.days.length > 4 && (
                <label>
                  Jump to day
                  <select
                    value={date}
                    disabled={busy}
                    onChange={(event) => changeDay(event.target.value)}
                  >
                    {trip.days.map((item, index) => (
                      <option key={item.date} value={item.date}>
                        Day {index + 1} · {displayDate(item.date)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <nav className="days" aria-label="Itinerary days">
              {trip.days.map((item, index) => (
                <button
                  className={date === item.date ? 'active' : 'secondary'}
                  aria-current={date === item.date ? 'date' : undefined}
                  key={item.date}
                  disabled={busy}
                  onClick={() => {
                    clearRoute();
                    setDate(item.date);
                    setSelectedId(null);
                  }}
                >
                  <small>DAY {index + 1}</small>
                  {displayDate(item.date)}
                  <span className="day-count">
                    {item.places.length} {item.places.length === 1 ? 'stop' : 'stops'}
                  </span>
                </button>
              ))}
            </nav>
            <header className="workspace-day">
              <div>
                <p className="eyebrow">
                  Day {trip.days.findIndex((item) => item.date === date) + 1} of{' '}
                  {trip.days.length}
                </p>
                <h2>
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(date + 'T00:00:00Z'))}
                </h2>
              </div>
            </header>
            <nav className="compact-planner-nav" aria-label="Jump within planner">
              <a href="#edition-days">Days</a>
              <a href="#edition-list">Stops</a>
              <a href="#edition-map">Map</a>
              <a href="#edition-route">Route</a>
            </nav>
            <div className="planner">
              <section className="itinerary" id="edition-list" tabIndex={-1}>
                <div className="section-heading">
                  <h3>
                    Stops{' '}
                    <span className="workspace-count">{day?.places.length || 0}</span>
                  </h3>
                  <button
                    disabled={busy || !day || day.places.length >= 30}
                    onClick={() => setEditor({ kind: 'place' })}
                  >
                    ＋ Add place
                  </button>
                </div>
                {!day?.places.length && (
                  <p className="empty">Start with one place you can’t wait to see.</p>
                )}
                <ol className="stops">
                  {day?.places.map((place, index) => (
                    <li
                      className={selectedId === place.id ? 'selected' : ''}
                      key={place.id}
                      id={`stop-${place.id}`}
                      tabIndex={-1}
                    >
                      <button
                        className="stop-title"
                        aria-pressed={selectedId === place.id}
                        onClick={() => setSelectedId(place.id)}
                      >
                        <span className="stop-number">{index + 1}</span>
                        <strong>{place.name}</strong>
                      </button>
                      {selectedId === place.id && place.latitude !== null && (
                        <a className="edition-jump" href="#edition-map">
                          Show selected stop on map ↓
                        </a>
                      )}
                      <div className="stop-meta">
                        <p className="category" data-category={place.category}>
                          {place.category || 'Uncategorized'}
                        </p>
                        {place.address && <p>{place.address}</p>}
                      </div>
                      {place.notes && <p className="notes">{place.notes}</p>}
                      {place.latitude === null && (
                        <p className="muted">
                          Edit this place and select a search result to add a map pin
                        </p>
                      )}
                      <div
                        className="stop-tools"
                        role="group"
                        aria-label={`Actions for ${place.name}`}
                      >
                        {trip.days.length > 1 && (
                          <label className="move-day">
                            Move to another day
                            <select
                              aria-label={`Move ${place.name} to another day`}
                              value=""
                              disabled={busy}
                              onChange={(event) => {
                                const targetDate = event.target.value;
                                if (targetDate)
                                  void run(() => movePlace(place, targetDate));
                              }}
                            >
                              <option value="" disabled>
                                Choose a day…
                              </option>
                              {trip.days.map(
                                (target, dayIndex) =>
                                  target.date !== date && (
                                    <option
                                      key={target.date}
                                      value={target.date}
                                      disabled={target.places.length >= 30}
                                    >
                                      Day {dayIndex + 1} · {displayDate(target.date)}
                                      {target.places.length >= 30 ? ' (full)' : ''}
                                    </option>
                                  ),
                              )}
                            </select>
                          </label>
                        )}
                        <div className="actions">
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setEditor({ kind: 'place', place })}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button"
                            aria-label={`Move ${place.name} up`}
                            disabled={busy || index === 0}
                            onClick={() =>
                              void run(async () => {
                                const places = [...day.places];
                                [places[index - 1], places[index]] = [
                                  places[index],
                                  places[index - 1],
                                ];
                                await changePlaces(places);
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="text-button"
                            aria-label={`Move ${place.name} down`}
                            disabled={busy || index === day.places.length - 1}
                            onClick={() =>
                              void run(async () => {
                                const places = [...day.places];
                                [places[index + 1], places[index]] = [
                                  places[index],
                                  places[index + 1],
                                ];
                                await changePlaces(places);
                              })
                            }
                          >
                            ↓
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Remove ${place.name}?`))
                                void run(async () => {
                                  await changePlaces(
                                    day.places.filter((item) => item.id !== place.id),
                                  );
                                  setSelectedId(null);
                                });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="route-box" id="edition-route" tabIndex={-1}>
                  <h3>Route for the day</h3>
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
                    {routing === 'driving'
                      ? 'Calculating driving route…'
                      : 'Calculate driving route'}
                  </button>
                  {!day || day.places.length < 2 ? (
                    <p className="muted">Add at least two stops to calculate a route.</p>
                  ) : day.places.some(
                      (p) => p.latitude === null || p.longitude === null,
                    ) ? (
                    <p className="muted">
                      Select a map location for every stop before calculating.
                    </p>
                  ) : null}
                  {routeError && (
                    <p className="error" role="alert">
                      {routeError}
                    </p>
                  )}
                  {route && (
                    <div
                      className="route-summary"
                      role="status"
                      aria-label="Driving route summary"
                    >
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
                      This local demonstration uses Atlas’s own Dijkstra algorithm on a
                      small downtown street/path snapshot. Try Gateway and Market Square.
                      It keeps your stop order.
                    </p>
                    <button
                      disabled={
                        busy ||
                        routing !== null ||
                        !day ||
                        day.places.length < 2 ||
                        day.places.some(
                          (p) => p.latitude === null || p.longitude === null,
                        )
                      }
                      onClick={() => void calculateDayRoute('demo')}
                    >
                      {routing === 'demo'
                        ? 'Calculating walking path…'
                        : 'Find shortest demo path'}
                    </button>
                    <p className="muted">
                      Limited coverage; paths may be disconnected. Stops snap to the
                      nearest node within 150 m. Distance excludes the gap from each stop
                      to its snapped node. Access conditions, crossings, stairs and
                      accessibility are not fully modeled: this is not navigation
                      guidance.
                    </p>
                  </details>
                  {demoRoute && (
                    <div role="status" aria-label="Walking demo result">
                      <p>
                        <strong>
                          {Math.round(demoRoute.distanceMeters)} m · shortest path in the
                          demo graph
                        </strong>
                      </p>
                      <p>
                        Calculated locally by Dijkstra. Snapshot: {demoRoute.snapshotDate}
                        .
                      </p>
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
                          {demoRoute.graphNodes.toLocaleString()} nodes ·{' '}
                          {demoRoute.graphEdges.toLocaleString()} directed edges ·{' '}
                          {demoRoute.visitedNodes.toLocaleString()} node visits across all
                          legs. Edge weights are segment lengths. Dijkstra chooses the
                          lowest total distance between the snapped nodes; it does not
                          reorder your stops.
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
                    Driving routes follow your stop order. Estimated driving time excludes
                    visits and live traffic. Locations are sent to the routing provider
                    when you calculate.
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
                </div>
              </section>
              <section className="map-panel" id="edition-map" tabIndex={-1}>
                <div className="section-heading">
                  <h3>Day map</h3>
                  <span className="badge">
                    {day?.places.filter((place) => place.latitude !== null).length || 0}{' '}
                    pins
                  </span>
                </div>
                <a
                  className="edition-jump"
                  href={selectedId ? `#stop-${selectedId}` : '#edition-list'}
                >
                  {selectedId ? 'Return to selected stop ↑' : 'Return to itinerary ↑'}
                </a>
                <TripMap
                  destinationLocation={trip.destinationLocation}
                  places={day?.places || []}
                  route={route ?? demoRoute}
                  selectedId={selectedId}
                  onSelect={selectPlace}
                />
                <p className="muted">
                  Drag to explore, scroll to zoom, or select a numbered destination. Map
                  tiles use OpenStreetMap. Search for a place to add a stop to the map.
                </p>
              </section>
            </div>
          </>
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
