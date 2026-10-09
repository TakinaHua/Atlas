'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import EditorDialog from '../components/EditorDialog';
import TripForm from '../components/TripForm';
import PlaceForm from '../components/PlaceForm';
import { itineraryDates } from '../lib/api';
import { previewStore as api } from '../lib/preview-store';
import type { CalculatedRoute, Place, Trip } from '../lib/types';

// Leaflet needs the browser DOM and must not run during server rendering.
const TripMap = dynamic(() => import('../components/TripMap'), {
  ssr: false,
  loading: () => <div className="map empty">Opening the map…</div>,
});
type Editor = { kind: 'trip'; trip?: Trip } | { kind: 'place'; place?: Place };
const LOCAL_TRIPS_KEY = 'atlas.trips.v1';

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<CalculatedRoute | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasLocalTrips, setHasLocalTrips] = useState(false);
  // Invalidating the generation prevents a late route response from painting another day.
  const routeGeneration = useRef(0);
  const trip = trips.find((item) => item.id === tripId);
  const day = trip?.days.find((item) => item.date === date);
  const selectPlace = useCallback((id: string) => setSelectedId(id), []);

  const refresh = useCallback(async () => {
    routeGeneration.current += 1;
    setRoute(null);
    const data = await api<{ trips: Trip[] }>('/trips');
    setTrips(data.trips);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await refresh();
        setHasLocalTrips(Boolean(localStorage.getItem(LOCAL_TRIPS_KEY)));
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
    setRoute(null);
  }

  function openTrip(next: Trip) {
    clearRoute();
    setTripId(next.id);
    setDate(next.startDate);
    setSelectedId(null);
  }

  /** Updates appear only after browser storage confirms the save. */
  async function saveTrip(next: Trip) {
    const saved = await api<Trip>(`/trips/${next.id}`, 'PUT', next);
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
          await saveTrip({ ...previous, name, destination, startDate, endDate, days }),
        );
      } else {
        const created = await api<Trip>('/trips', 'POST', {
          name,
          destination,
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
      category: String(data.get('category')),
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
          atlas<span>✳</span>
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
        <p className="preview-banner">
          FRONTEND PREVIEW · Saved on this browser · Your itinerary, one day at a time
        </p>
        {error && (
          <div className="error" role="alert">
            {error}{' '}
            <button
              className="secondary"
              onClick={() =>
                void run(async () => {
                  await refresh();
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
                  onClick={() =>
                    void run(async () => {
                      const sample = await api<Trip>('/trips', 'POST', {
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
                      });
                      setTrips((current) => [sample, ...current]);
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
                <h2>Trips in the making</h2>
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
                      {item.startDate} — {item.endDate}
                    </p>
                    <button className="secondary" onClick={() => openTrip(item)}>
                      Open itinerary →
                    </button>
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
                Trips are saved in this browser on this address. Export a backup before
                clearing browser data or moving devices.
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
                      void run(() =>
                        importTrips(localStorage.getItem(LOCAL_TRIPS_KEY) || '[]'),
                      )
                    }
                  >
                    Import old browser trips
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
                  {trip.startDate} — {trip.endDate} · {trip.days.length} days
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
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Delete this trip and all its destinations?'))
                      void run(async () => {
                        await api(`/trips/${trip.id}`, 'DELETE', {
                          revision: trip.revision,
                        });
                        setTrips((current) =>
                          current.filter((item) => item.id !== trip.id),
                        );
                        clearRoute();
                        setTripId(null);
                      });
                  }}
                >
                  Delete trip
                </button>
              </div>
            </div>
            <nav className="days" aria-label="Itinerary days">
              {trip.days.map((item, index) => (
                <button
                  className={date === item.date ? 'active' : 'secondary'}
                  key={item.date}
                  onClick={() => {
                    clearRoute();
                    setDate(item.date);
                    setSelectedId(null);
                  }}
                >
                  <small>DAY {index + 1}</small>
                  {item.date.slice(5)}
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
                          Add coordinates to show this place on the map
                        </p>
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
                  <p className="muted">
                    Arrange stops in the order you want to visit. Driving routes and smart
                    suggestions will follow after the frontend review.
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
                  places={day?.places || []}
                  route={route}
                  selectedId={selectedId}
                  onSelect={selectPlace}
                />
                <p className="muted">
                  Drag to explore, scroll to zoom, or select a numbered destination. Map
                  tiles use OpenStreetMap. Add coordinates to place your stops on the map.
                </p>
              </section>
            </div>
          </>
        )}
      </main>
      <footer>
        atlas ✳ <span>Leave a little room for the unexpected.</span>
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
            <PlaceForm place={editor.place} />
          )}
        </EditorDialog>
      )}
    </>
  );
}
