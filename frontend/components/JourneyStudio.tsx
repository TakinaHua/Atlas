import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useJourneyDrag } from './useJourneyDrag';
import JourneyCard, {
  StudioIcon,
  type PlaceAction,
  type PlaceLocation,
} from './JourneyCard';
import JourneyRoutes, { type JourneyRouteState } from './JourneyRoutes';
import type { MapStop } from './TripMap';
import { displayDate } from '../lib/display-date';
import type { Place, Trip } from '../lib/types';

const TripMap = dynamic(() => import('./TripMap'), {
  ssr: false,
  loading: () => (
    <div className="map studio-map-loading" role="status">
      Opening the map…
    </div>
  ),
});

type Panel = 'itinerary' | 'map' | 'saved';
type MapView = 'day' | 'all' | 'custom' | 'saved';
const noPlaces: Place[] = [];
const motion = (): ScrollBehavior =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

function mapStops(trip: Trip, dates?: ReadonlySet<string>): MapStop[] {
  return trip.days.flatMap((day, dayIndex) =>
    dates && !dates.has(day.date)
      ? []
      : day.places.flatMap((place, index) =>
          place.latitude === null || place.longitude === null
            ? []
            : [
                {
                  place,
                  date: day.date,
                  day: dayIndex + 1,
                  number: index + 1,
                },
              ],
        ),
  );
}

export default function JourneyStudio({
  trip,
  date,
  selectedId,
  busy,
  isSample,
  changeDay,
  selectPlace,
  openPlace,
  addDay,
  editTrip,
  deleteTrip,
  saveSample,
  placeAction,
  routeState,
}: {
  trip: Trip;
  date: string;
  selectedId: string | null;
  busy: boolean;
  isSample: boolean;
  changeDay: (date: string) => void;
  selectPlace: (id: string, date: PlaceLocation) => void;
  openPlace: (date: PlaceLocation, place?: Place) => void;
  addDay: () => void;
  editTrip: () => void;
  deleteTrip: () => void;
  saveSample: () => void;
  placeAction: PlaceAction;
  routeState: JourneyRouteState;
}) {
  const [panel, setPanel] = useState<Panel>('itinerary');
  const [mapView, setMapView] = useState<MapView>('day');
  const [mapDays, setMapDays] = useState<string[]>([]);
  const [mapFit, setMapFit] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);
  const hoverMarker = useRef<((id: string | null) => void) | null>(null);
  const setHovered = useCallback((id: string | null) => hoverMarker.current?.(id), []);
  const revealCard = useRef<string | null>(null);
  const focusCard = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dayIndex = trip.days.findIndex((day) => day.date === date);
  const day = trip.days[dayIndex];
  const saved = trip.savedPlaces ?? noPlaces;
  const selectedSaved = saved.some((place) => place.id === selectedId);
  const mapDate = mapView === 'day' ? date : undefined;
  const mapsCurrentDay =
    mapView === 'day' ||
    mapView === 'all' ||
    (mapView === 'custom' && mapDays.includes(date));
  const showDayNumbers = mapView === 'all' || mapView === 'custom';
  const lastDay = trip.days.at(-1);
  const canAddDay = trip.days.length < 60 && trip.endDate < '9999-12-31';
  const visibleStops = useMemo(() => {
    if (mapView === 'saved')
      return saved.flatMap((place) =>
        place.latitude === null || place.longitude === null
          ? []
          : [{ place, date: null }],
      );
    const dates = mapDate
      ? new Set([mapDate])
      : mapView === 'custom'
        ? new Set(mapDays)
        : undefined;
    return mapStops(trip, dates);
  }, [trip, mapView, mapDate, mapDays, saved]); // Scrolling between days preserves the full-trip viewport.

  const scrollToDay = useCallback((nextDate: string) => {
    const scroller = board.current;
    const column = scroller?.querySelector<HTMLElement>(
      `[data-board-date="${nextDate}"]`,
    );
    if (!scroller || !column) return;
    const inset = parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart);
    const position = column.offsetLeft - inset;
    if (Math.abs(position - scroller.scrollLeft) > 1)
      scroller.scrollTo({ left: position, behavior: 'instant' });
  }, []);

  useEffect(() => {
    scrollToDay(date);
    return () => clearTimeout(scrollTimer.current);
  }, [date, panel, trip.days.length, scrollToDay]);

  function followBoard() {
    clearTimeout(scrollTimer.current);
    if (drag.isActive()) return;
    scrollTimer.current = setTimeout(() => {
      const scroller = board.current;
      if (!scroller?.clientWidth || drag.isActive()) return;
      const left =
        scroller.scrollLeft +
        parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart);
      let nearest: HTMLElement | undefined;
      for (const column of scroller.querySelectorAll<HTMLElement>('[data-board-date]')) {
        if (
          nearest &&
          Math.abs(column.offsetLeft - left) >= Math.abs(nearest.offsetLeft - left)
        )
          break;
        nearest = column;
      }
      const next = nearest?.dataset.boardDate;
      if (next && next !== date) {
        setHovered(null);
        changeDay(next);
      }
    }, 140);
  }

  useEffect(() => {
    const id = revealCard.current;
    if (!id || (panel === 'map' && matchMedia('(max-width: 767px)').matches)) return;
    const card = document.getElementById(`stop-${id}`);
    if (card) {
      card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: motion() });
      if (focusCard.current) {
        card
          .querySelector<HTMLButtonElement>('.stop-title')
          ?.focus({ preventScroll: true });
        focusCard.current = false;
      }
      revealCard.current = null;
    }
  }, [date, panel, selectedId, savedOpen]);

  function goToDay(nextDate: string) {
    changeDay(nextDate);
    setHovered(null);
    scrollToDay(nextDate);
  }

  function selectCard(place: Place, source: PlaceLocation) {
    setHovered(null);
    if (source === null) setMapView('saved');
    else if (mapView === 'saved') setMapView('day');
    selectPlace(place.id, source);
  }

  function selectMarker(stop: MapStop) {
    revealCard.current = stop.place.id;
    if (stop.date === null) setSavedOpen(true);
    selectPlace(stop.place.id, stop.date);
    // Repeated marker activation can still bring a card back into view on desktop.
    if (stop.place.id === selectedId && !matchMedia('(max-width: 767px)').matches)
      document
        .getElementById(`stop-${stop.place.id}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: motion() });
  }

  const restoreDay = useCallback(() => scrollToDay(date), [date, scrollToDay]);
  const drag = useJourneyDrag({ board, trip, busy, move: action, restore: restoreDay });
  const dropTarget = drag.target;

  function action(...args: Parameters<PlaceAction>) {
    const target = args[2];
    if (target === null) {
      setSavedOpen(true);
    } else if (target && mapView === 'saved') {
      setMapView('day');
    }
    placeAction(...args);
  }

  function showPanel(next: Panel) {
    setHovered(null);
    setPanel(next);
    if (next === 'saved') setSavedOpen(true);
  }

  function returnToCard() {
    revealCard.current = selectedId;
    focusCard.current = selectedId !== null;
    showPanel(selectedSaved ? 'saved' : 'itinerary');
  }

  function card(place: Place, index: number, current: typeof day | null) {
    return (
      <JourneyCard
        key={place.id}
        place={place}
        day={current}
        index={index}
        days={trip.days}
        busy={busy}
        selected={selectedId === place.id}
        savedCount={saved.length}
        dropBefore={dropTarget?.before === place.id}
        select={selectCard}
        edit={openPlace}
        action={action}
        hover={setHovered}
        dragging={drag.place?.id === place.id}
        startDrag={drag.start}
        startTouchDrag={drag.startTouch}
        mapAction={
          selectedId === place.id &&
          place.latitude !== null && (
            <button
              type="button"
              className="studio-mobile-jump"
              onClick={() => {
                showPanel('map');
                requestAnimationFrame(() => {
                  const mapPanel = document.getElementById('edition-map');
                  mapPanel?.focus({ preventScroll: true });
                  mapPanel?.scrollIntoView({ block: 'nearest', behavior: motion() });
                });
              }}
            >
              Show selected stop on map
            </button>
          )
        }
      />
    );
  }

  return (
    <div
      className="studio"
      ref={drag.surface}
      onPointerDownCapture={() => {
        drag.suppressClick.current = false;
      }}
      onClickCapture={(event) => {
        if (event.detail === 0 || !drag.suppressClick.current) return;
        drag.suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onContextMenu={(event) => {
        if (drag.isActive()) event.preventDefault();
      }}
      onPointerMove={drag.track}
      onPointerUp={drag.finish}
      onPointerCancel={drag.finish}
      onLostPointerCapture={drag.finish}
    >
      {drag.place &&
        createPortal(
          <div className="studio-drag-preview" ref={drag.preview} aria-hidden="true">
            {drag.place.name}
          </div>,
          document.body,
        )}
      <header className="studio-header">
        <div>
          <h1>{trip.name}</h1>
          <p>
            {trip.destination && <span>{trip.destination}</span>}
            <span>
              {displayDate(trip.startDate)} to {displayDate(trip.endDate, true)}
            </span>
            <span>
              {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
            </span>
          </p>
        </div>
        <div className="studio-trip-actions">
          <button className="secondary" disabled={busy} onClick={editTrip}>
            Edit trip
          </button>
          {isSample ? (
            <button disabled={busy} onClick={saveSample}>
              Add to my trips
            </button>
          ) : (
            <button
              className="secondary studio-danger"
              disabled={busy}
              onClick={deleteTrip}
            >
              Delete trip
            </button>
          )}
        </div>
      </header>
      {isSample && (
        <p className="studio-sample">
          Sample itinerary. Choose “Add to my trips” to keep your edits.
        </p>
      )}
      <nav className="studio-mobile-nav" aria-label="Journey Studio views">
        {(['itinerary', 'map', 'saved'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={panel === item}
            onClick={() => showPanel(item)}
          >
            {{ itinerary: 'Itinerary', map: 'Map', saved: 'Saved places' }[item]}
          </button>
        ))}
      </nav>
      <div className="studio-workspace" data-panel={panel}>
        <section className="studio-itinerary" id="edition-list">
          <div
            className="studio-board"
            data-dragging={drag.place !== null}
            ref={board}
            tabIndex={0}
            role="region"
            aria-label="Itinerary days"
            onScroll={followBoard}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              const targetIndex = {
                ArrowLeft: dayIndex - 1,
                ArrowRight: dayIndex + 1,
                Home: 0,
                End: trip.days.length - 1,
              }[event.key];
              if (targetIndex === undefined) return;
              event.preventDefault();
              const target = trip.days[targetIndex];
              if (target) goToDay(target.date);
            }}
          >
            {trip.days.map((current, index) => {
              const active = current.date === date;
              return (
                <section
                  className="studio-day"
                  data-board-date={current.date}
                  data-drop-zone={current.date}
                  data-active={active}
                  data-drop-end={dropTarget?.date === current.date && !dropTarget.before}
                  key={current.date}
                  aria-labelledby={`studio-day-${current.date}`}
                >
                  <header>
                    <h3 id={`studio-day-${current.date}`}>
                      <button
                        type="button"
                        aria-current={active ? 'date' : undefined}
                        disabled={busy}
                        onClick={() => goToDay(current.date)}
                      >
                        Day {index + 1}
                      </button>
                    </h3>
                    <time dateTime={current.date}>
                      {displayDate(current.date, false, 'short')}
                    </time>
                    <p>
                      {current.places.length}{' '}
                      {current.places.length === 1 ? 'stop' : 'stops'}
                    </p>
                  </header>
                  {current.places.length ? (
                    <ol className="studio-stops">
                      {current.places.map((place, stopIndex) =>
                        card(place, stopIndex, current),
                      )}
                    </ol>
                  ) : (
                    <p className="studio-empty">No places planned for this day yet.</p>
                  )}
                  <div className="studio-day-footer">
                    <button
                      type="button"
                      className="studio-add"
                      disabled={busy || current.places.length >= 30}
                      aria-label={active ? 'Add place' : `Add place to day ${index + 1}`}
                      onClick={() => {
                        if (!active) goToDay(current.date);
                        openPlace(current.date);
                      }}
                    >
                      <StudioIcon name="plus" />{' '}
                      {current.places.length === 30 ? 'Day is full' : 'Add place'}
                    </button>
                    {canAddDay && current === lastDay && (
                      <button
                        type="button"
                        className="studio-add secondary"
                        disabled={busy}
                        onClick={addDay}
                      >
                        <StudioIcon name="plus" /> Add day
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
        <section
          className="studio-saved"
          id="edition-saved"
          aria-labelledby="studio-saved-title"
          data-drop-end={dropTarget?.date === null}
          data-drop-zone="saved"
        >
          <div className="studio-saved-header">
            <h2 id="studio-saved-title">
              <button
                type="button"
                aria-expanded={savedOpen}
                aria-controls="studio-saved-content"
                onClick={() => setSavedOpen(!savedOpen)}
              >
                <StudioIcon name="save" /> Saved for later <span>{saved.length}</span>
                <StudioIcon name={savedOpen ? 'up' : 'down'} />
              </button>
            </h2>
            <button
              type="button"
              className="secondary"
              disabled={busy || saved.length >= 120}
              onClick={() => {
                setSavedOpen(true);
                openPlace(null);
              }}
            >
              <StudioIcon name="plus" /> Save a place
            </button>
          </div>
          <div id="studio-saved-content" hidden={!savedOpen}>
            {saved.length ? (
              <ol className="studio-saved-cards">
                {saved.map((place, index) => card(place, index, null))}
              </ol>
            ) : (
              <p className="studio-empty">
                Keep places here until you’re ready to pick a day.
              </p>
            )}
          </div>
        </section>
        <section
          className="studio-map-panel"
          id="edition-map"
          aria-label="Trip map"
          tabIndex={-1}
        >
          <div className="studio-map-surface">
            <TripMap
              destinationLocation={trip.destinationLocation}
              stops={visibleStops}
              route={mapsCurrentDay ? (routeState.route ?? routeState.demoRoute) : null}
              selectedId={selectedId}
              hoverMarker={hoverMarker}
              onSelect={selectMarker}
              fitRequest={mapFit}
              showDays={showDayNumbers}
              fitScope={mapDate}
            />
            <div className="studio-map-actions">
              <button
                type="button"
                className="secondary studio-fit"
                onClick={() => {
                  setMapView('all');
                  setMapFit((n) => n + 1);
                }}
              >
                <StudioIcon name="fit" /> Fit trip
              </button>
              <details
                className="studio-map-settings"
                onKeyDown={(event) => {
                  if (event.key !== 'Escape' || !event.currentTarget.open) return;
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }}
              >
                <summary className="secondary">Map settings</summary>
                <div className="studio-map-settings-panel">
                  <fieldset>
                    <legend>Show on map</legend>
                    {(['day', 'all', 'custom', 'saved'] as const).map((mode) => (
                      <label key={mode}>
                        <input
                          type="radio"
                          name="studio-map-view"
                          checked={mapView === mode}
                          onChange={() => {
                            if (mode === 'custom' && mapDays.length === 0)
                              setMapDays([date]);
                            setMapView(mode);
                          }}
                        />
                        {
                          {
                            day: 'Follow leftmost day',
                            all: 'All days',
                            custom: 'Choose days',
                            saved: 'Saved places',
                          }[mode]
                        }
                      </label>
                    ))}
                  </fieldset>
                  {mapView === 'custom' && (
                    <fieldset className="studio-map-days">
                      <legend>Days to show</legend>
                      <div>
                        {trip.days.map((day, index) => (
                          <label key={day.date}>
                            <input
                              type="checkbox"
                              checked={mapDays.includes(day.date)}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setMapDays((current) =>
                                  checked
                                    ? [...current, day.date]
                                    : current.filter((item) => item !== day.date),
                                );
                              }}
                            />
                            Day {index + 1}, {displayDate(day.date)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              </details>
            </div>
          </div>
          <div className="studio-map-caption">
            <a
              href="#edition-route"
              onClick={(event) => {
                event.preventDefault();
                showPanel('itinerary');
                requestAnimationFrame(() => {
                  const routePanel = document.getElementById('edition-route');
                  routePanel?.focus({ preventScroll: true });
                  routePanel?.scrollIntoView({ block: 'start', behavior: motion() });
                });
              }}
            >
              Route for day {dayIndex + 1}
            </a>
            <span>
              {visibleStops.length} {visibleStops.length === 1 ? 'pin' : 'pins'}
              {showDayNumbers && visibleStops.length > 0 && ' (day/stop)'}
            </span>
            {trip.destinationLocation && (
              <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
                Trip area: {trip.destinationLocation.label} / GeoNames
              </a>
            )}
          </div>
          <button className="studio-mobile-jump" type="button" onClick={returnToCard}>
            {selectedId ? 'Return to selected stop' : 'Return to itinerary'}
          </button>
        </section>
        <JourneyRoutes
          day={day}
          busy={busy}
          {...routeState}
          calculateDayRoute={(mode) => {
            if (!mapsCurrentDay) setMapView('day');
            routeState.calculateDayRoute(mode);
          }}
        />
      </div>
    </div>
  );
}
