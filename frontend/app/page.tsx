'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [sampleTrip, setSampleTrip] = useState<Trip | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<CalculatedRoute | null>(null);
  const [demoRoute, setDemoRoute] = useState<WalkingDemoRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const routeController = useRef<AbortController | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasLocalTrips, setHasLocalTrips] = useState(false);
  // Invalidating the generation prevents a late route response from painting another day.
  const routeGeneration = useRef(0);
  const isSample = sampleTrip !== null && sampleTrip.id === tripId;
  const trip = isSample ? sampleTrip : trips.find((item) => item.id === tripId);
  const day = trip?.days.find((item) => item.date === date);
  const selectPlace = useCallback((id: string) => setSelectedId(id), []);

  const refresh = useCallback(async () => {
    routeGeneration.current += 1;
    routeController.current?.abort();
    setRouting(false);
    setRouteError('');
    setRoute(null);
    setDemoRoute(null);
    const data = await api<{ trips: Trip[] }>('/trips');
    setTrips(data.trips);
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
    setRouting(false);
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
    setRouting(true);
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
      if (generation === routeGeneration.current) setRouting(false);
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
        clearRoute();
        setTripId(null);
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
      <header className="topbar">
        <a className="brand" href="/">
          Atlas<span>✳</span>
        </a>
        <span>A LITTLE LESS RUSH. A LOT MORE WORLD.</span>
        <button
          className="secondary"
          onClick={() => {
            clearRoute();
            setTripId(null);
          }}
        >
          My trips
        </button>
      </header>
      <main>
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
        {loading ? (
          <p role="status">Opening your travel journal…</p>
        ) : !trip ? (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">MAKE ROOM FOR THE JOURNEY</p>
                <h1>
                  Good trips start
                  <br />
                  with a little curiosity.
                </h1>
                <p>
                  Collect the places. Shape your days.
                  <br />
                  Find your own way there.
                </p>
                <button disabled={busy} onClick={() => setEditor({ kind: 'trip' })}>
                  ＋ Plan a trip
                </button>
                <button
                  className="secondary sample-button"
                  disabled={busy}
                  onClick={() => {
                    const sample: Trip = {
                      id: crypto.randomUUID(),
                      revision: 1,
                      name: 'Downtown walking demo',
                      destination: 'Pittsburgh, Pennsylvania',
                      startDate: '2026-10-14',
                      endDate: '2026-10-14',
                      days: [
                        {
                          date: '2026-10-14',
                          places: [
                            {
                              id: crypto.randomUUID(),
                              name: 'Gateway area',
                              address: 'Downtown Pittsburgh',
                              category: 'Sightseeing',
                              notes: 'Example graph node; demo only.',
                              latitude: 40.4420279,
                              longitude: -80.0060824,
                            },
                            {
                              id: crypto.randomUUID(),
                              name: 'Market Square area',
                              address: 'Downtown Pittsburgh',
                              category: 'Sightseeing',
                              notes: 'Example graph node; demo only.',
                              latitude: 40.4410009,
                              longitude: -80.002423,
                            },
                          ],
                        },
                      ],
                    };
                    setSampleTrip(sample);
                    openTrip(sample);
                  }}
                >
                  Explore walking demo
                </button>
                <button
                  className="secondary sample-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const sample: Trip = {
                        id: crypto.randomUUID(),
                        revision: 1,
                        name: 'A little aloha',
                        destination: 'Oʻahu, Hawaii',
                        startDate: '2026-11-14',
                        endDate: '2026-11-16',
                        days: itineraryDates('2026-11-14', '2026-11-16').map(
                          (date, index) => ({
                            date,
                            places:
                              index === 0
                                ? [
                                    {
                                      id: crypto.randomUUID(),
                                      name: 'Waikīkī Beach',
                                      address: 'Honolulu, Oʻahu',
                                      category: 'Nature',
                                      notes: 'A slow start by the ocean.',
                                      latitude: 21.2767,
                                      longitude: -157.8275,
                                    },
                                    {
                                      id: crypto.randomUUID(),
                                      name: 'Diamond Head',
                                      address: 'Honolulu, Oʻahu',
                                      category: 'Nature',
                                      notes:
                                        'Sample stop — check access and reservations before traveling.',
                                      latitude: 21.262,
                                      longitude: -157.805,
                                    },
                                  ]
                                : [],
                          }),
                        ),
                      };
                      setSampleTrip(sample);
                      openTrip(sample);
                    })
                  }
                >
                  Explore a sample trip →
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <span>
                  THE WORLD
                  <br />
                  IS STILL
                  <br />
                  <em>wide open.</em>
                </span>
                <div className="orbit" />
              </div>
            </section>
            <section className="section-heading">
              <div>
                <p className="eyebrow">YOUR NEXT CHAPTER</p>
                <h2>Trips in the future</h2>
              </div>
              <span>
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
              </span>
            </section>
            <div className="trip-grid">
              {trips.map((item, index) => (
                <article className="trip-card" key={item.id}>
                  <div className={`card-art shade-${index % 3}`}>
                    <span>0{index + 1}</span>
                    <span>↗</span>
                  </div>
                  <div className="card-body">
                    <p className="eyebrow">{item.destination}</p>
                    <h3>{item.name}</h3>
                    <p>
                      {displayDate(item.startDate, true)} —{' '}
                      {displayDate(item.endDate, true)}
                    </p>
                    <div className="actions">
                      <button className="secondary" onClick={() => openTrip(item)}>
                        Open itinerary →
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => deleteTrip(item)}
                        aria-label={`Delete ${item.name}`}
                      >
                        Delete trip
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!trips.length && (
              <div className="empty">
                Your next adventure belongs here. Start with a name and a few dates.
              </div>
            )}
            <section className="data-tools">
              <h3>Your trips, kept close</h3>
              <p>
                Trips are saved by Atlas and stay available when you reload or switch
                browsers on this computer. Export a backup to keep a separate copy.
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
          </>
        ) : (
          <>
            <button
              className="back"
              onClick={() => {
                clearRoute();
                setTripId(null);
              }}
            >
              ← All trips
            </button>
            <div className="section-heading">
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
              <p className="muted">
                Explore and edit this sample freely. Choose “Add to my trips” to keep it
                in Trips in the future.
              </p>
            )}
            <nav className="days" aria-label="Itinerary days">
              {trip.days.map((item, index) => (
                <button
                  className={date === item.date ? 'active' : 'secondary'}
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
                </button>
              ))}
            </nav>
            <div className="planner">
              <section className="itinerary">
                <div className="section-heading">
                  <h2>A day to discover</h2>
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
                    >
                      <button
                        className="stop-title"
                        onClick={() => setSelectedId(place.id)}
                      >
                        <span className="stop-number">{index + 1}</span>
                        <strong>{place.name}</strong>
                      </button>
                      <p className="eyebrow">{place.category}</p>
                      {place.address && <p>{place.address}</p>}
                      {place.notes && <p className="notes">{place.notes}</p>}
                      {place.latitude === null && (
                        <p className="muted">
                          Edit this place and select a search result to add a map pin
                        </p>
                      )}
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
                    </li>
                  ))}
                </ol>
                <div className="route-box">
                  <button
                    disabled={
                      busy ||
                      routing ||
                      !day ||
                      day.places.length < 2 ||
                      day.places.some((p) => p.latitude === null || p.longitude === null)
                    }
                    onClick={() => void calculateDayRoute()}
                  >
                    {routing ? 'Calculating route…' : 'Calculate driving route'}
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
                  {routeError && <p role="alert">{routeError}</p>}
                  {route && (
                    <div aria-label="Driving route summary">
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
                        routing ||
                        !day ||
                        day.places.length < 2 ||
                        day.places.some(
                          (p) => p.latitude === null || p.longitude === null,
                        )
                      }
                      onClick={() => void calculateDayRoute('demo')}
                    >
                      Find shortest demo path
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
                    <div aria-label="Walking demo result">
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
              <section className="map-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">A DIFFERENT PERSPECTIVE</p>
                    <h2>Your day, mapped.</h2>
                  </div>
                  <span className="badge">Explore</span>
                </div>
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
      <footer>
        Atlas ✳ <span>Leave a little room for the unexpected.</span>
      </footer>
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
