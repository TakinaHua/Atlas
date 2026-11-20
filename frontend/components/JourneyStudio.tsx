import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
type MapView = 'day' | 'all' | 'saved';
type Dragged = { source: PlaceLocation; place: Place };
type DropTarget = { date: PlaceLocation; before?: string };
const noPlaces: Place[] = [];
const motion = (): ScrollBehavior =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

function mapStops(trip: Trip, date?: string): MapStop[] {
  return trip.days.flatMap((day, dayIndex) =>
    date && day.date !== date
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
  editTrip: () => void;
  deleteTrip: () => void;
  saveSample: () => void;
  placeAction: PlaceAction;
  routeState: JourneyRouteState;
}) {
  const [view, setView] = useState<'card' | 'list'>('card');
  const [panel, setPanel] = useState<Panel>('itinerary');
  const [mapView, setMapView] = useState<MapView>('day');
  const [mapFit, setMapFit] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);
  const hoverMarker = useRef<((id: string | null) => void) | null>(null);
  const setHovered = useCallback((id: string | null) => hoverMarker.current?.(id), []);
  const [dropTarget, setDropTarget] = useState<DropTarget>();
  const dragged = useRef<Dragged | null>(null);
  const revealCard = useRef<string | null>(null);
  const focusCard = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const dayIndex = trip.days.findIndex((day) => day.date === date);
  const day = trip.days[dayIndex];
  const saved = trip.savedPlaces ?? noPlaces;
  const selectedSaved = saved.some((place) => place.id === selectedId);
  const mapDate = mapView === 'day' ? date : undefined;
  const visibleStops = useMemo(() => {
    if (mapView === 'saved')
      return saved.flatMap((place) =>
        place.latitude === null || place.longitude === null
          ? []
          : [{ place, date: null }],
      );
    return mapStops(trip, mapDate);
  }, [trip, mapView, mapDate, saved]); // Scrolling between days preserves the full-trip viewport.

  const scrollToDay = useCallback((nextDate: string, onlyIfHidden = false) => {
    const scroller = board.current;
    const column = scroller?.querySelector<HTMLElement>(
      `[data-board-date="${nextDate}"]`,
    );
    if (!scroller || !column) return;
    const position = column.offsetLeft;
    const visible =
      column.offsetLeft >= scroller.scrollLeft &&
      column.offsetLeft + column.offsetWidth <=
        scroller.scrollLeft + scroller.clientWidth;
    if (!onlyIfHidden || !visible)
      scroller.scrollTo({ left: position - 16, behavior: motion() });
  }, []);

  useEffect(() => {
    scrollToDay(date, true);
  }, [date, view, panel, scrollToDay]);

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

  function endDrag() {
    dragged.current = null;
    setDropTarget(undefined);
  }

  function handleDrop(event: DragEvent, target: PlaceLocation, before?: string) {
    const entry = dragged.current;
    if (!entry || busy) return;
    const capacityReached =
      entry.source !== target &&
      (target === null
        ? saved.length >= 120
        : trip.days.find((day) => day.date === target)?.places.length === 30);
    event.stopPropagation();
    if (
      capacityReached ||
      entry.place.id === before ||
      (entry.source === null && target === null)
    ) {
      event.dataTransfer.dropEffect = 'none';
      setDropTarget(undefined);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (event.type === 'drop') {
      endDrag();
      action(entry.source, entry.place, target, before);
    } else if (dropTarget?.date !== target || dropTarget?.before !== before) {
      setDropTarget({ date: target, before });
    }
  }

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
    if (next === 'itinerary') scrollToDay(date, true);
  }

  function returnToCard() {
    revealCard.current = selectedId;
    focusCard.current = selectedId !== null;
    showPanel(selectedSaved ? 'saved' : 'itinerary');
  }

  function card(
    place: Place,
    index: number,
    current: typeof day | null,
    visual: boolean,
  ) {
    return (
      <JourneyCard
        key={place.id}
        place={place}
        day={current}
        index={index}
        days={trip.days}
        busy={busy}
        selected={selectedId === place.id}
        visual={visual}
        savedCount={saved.length}
        dropBefore={dropTarget?.before === place.id}
        select={selectCard}
        edit={openPlace}
        action={action}
        hover={setHovered}
        handleDrop={handleDrop}
        startDrag={(event, source, place) => {
          dragged.current = { source, place };
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', place.name);
          event.currentTarget
            .closest('li')
            ?.addEventListener('dragend', endDrag, { once: true });
        }}
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
    <div className="studio">
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
        <section
          className="studio-itinerary"
          id="edition-list"
          aria-labelledby="studio-board-title"
        >
          <header className="studio-toolbar">
            <h2 id="studio-board-title">Day board</h2>
            <div className="studio-view-options" role="group" aria-label="Itinerary view">
              <button
                type="button"
                aria-pressed={view === 'card'}
                onClick={() => setView('card')}
              >
                <StudioIcon name="card" /> Card view
              </button>
              <button
                type="button"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <StudioIcon name="list" /> List view
              </button>
            </div>
          </header>
          <nav className="studio-days" aria-label="Itinerary days" id="edition-days">
            <button
              type="button"
              className="secondary studio-icon"
              aria-label="Previous day"
              disabled={busy || dayIndex <= 0}
              onClick={() => goToDay(trip.days[dayIndex - 1].date)}
            >
              <StudioIcon name="back" />
            </button>
            <select
              aria-label="Jump to day"
              disabled={busy}
              value={date}
              onChange={(event) => goToDay(event.target.value)}
            >
              {trip.days.map((item, index) => (
                <option key={item.date} value={item.date}>
                  Day {index + 1}, {displayDate(item.date)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary studio-icon"
              aria-label="Next day"
              disabled={busy || dayIndex >= trip.days.length - 1}
              onClick={() => goToDay(trip.days[dayIndex + 1].date)}
            >
              <StudioIcon name="forward" />
            </button>
          </nav>
          <div className="studio-board" data-view={view} ref={board}>
            {trip.days.map((current, index) => {
              const active = current.date === date;
              if (view === 'list' && !active) return null;
              return (
                <section
                  className="studio-day"
                  data-board-date={current.date}
                  data-active={active}
                  data-drop-end={dropTarget?.date === current.date && !dropTarget.before}
                  key={current.date}
                  aria-labelledby={`studio-day-${current.date}`}
                  onDragOver={(event) => handleDrop(event, current.date)}
                  onDrop={(event) => handleDrop(event, current.date)}
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
                        card(place, stopIndex, current, view === 'card'),
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
          onDragOver={(event) => handleDrop(event, null)}
          onDrop={(event) => handleDrop(event, null)}
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
                {saved.map((place, index) => card(place, index, null, true))}
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
          aria-labelledby="studio-map-title"
          tabIndex={-1}
        >
          <header className="studio-toolbar">
            <h2 id="studio-map-title">Trip map</h2>
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
          </header>
          <div className="studio-map-options" role="group" aria-label="Map layer">
            {(['day', 'all', 'saved'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={mapView === mode}
                onClick={() => setMapView(mode)}
              >
                {
                  { day: `Day ${dayIndex + 1}`, all: 'All days', saved: 'Saved places' }[
                    mode
                  ]
                }
              </button>
            ))}
          </div>
          <TripMap
            destinationLocation={trip.destinationLocation}
            stops={visibleStops}
            route={
              mapView === 'saved' ? null : (routeState.route ?? routeState.demoRoute)
            }
            selectedId={selectedId}
            hoverMarker={hoverMarker}
            onSelect={selectMarker}
            fitRequest={mapFit}
            showDays={mapView === 'all'}
          />
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
              {mapView === 'all' && visibleStops.length > 0 && ' (day/stop)'}
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
            if (mapView === 'saved') setMapView('day');
            routeState.calculateDayRoute(mode);
          }}
        />
      </div>
    </div>
  );
}
