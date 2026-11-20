'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import L from 'leaflet';
import type { CalculatedRoute, Place, DestinationLocation } from '../lib/types';

export type MapStop = {
  place: Place;
  date: string | null;
  day?: number;
  number?: number;
};

const unitedStates: L.LatLngTuple = [39.5, -98.35];
function panToMarker(instance: L.Map, marker: L.Marker, animate: boolean) {
  if (!instance.getBounds().pad(-0.22).contains(marker.getLatLng()))
    instance.panTo(marker.getLatLng(), { animate, duration: 0.36 });
}

const shouldAnimate = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;

function pinLabel(stop: MapStop) {
  return stop.date === null
    ? `Saved place, ${stop.place.name}`
    : `Day ${stop.day}, stop ${stop.number}, ${stop.place.name}`;
}

function drawRoute(line: L.Polyline) {
  if (!shouldAnimate()) return;
  const path = line.getElement();
  if (!(path instanceof SVGPathElement)) return;
  const length = path.getTotalLength();
  if (!length || !Number.isFinite(length)) return;
  path.animate(
    [
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
    ],
    { duration: 780, easing: 'cubic-bezier(.18,.72,.26,1)' },
  );
}

/** Leaflet owns the map and reuses marker elements as selection and trip data change. */
export default function TripMap({
  stops,
  destinationLocation,
  route,
  selectedId,
  hoverMarker,
  onSelect,
  fitRequest,
  showDays,
}: {
  destinationLocation?: DestinationLocation | null;
  stops: MapStop[];
  route: Pick<CalculatedRoute, 'geometry'> | null;
  selectedId: string | null;
  hoverMarker: RefObject<((id: string | null) => void) | null>;
  onSelect: (stop: MapStop) => void;
  fitRequest: number;
  showDays: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef(new Map<string, { stop: MapStop; marker: L.Marker }>());
  const select = useRef(onSelect);
  const pendingFit = useRef<(() => void) | null>(null);
  const pendingSelection = useRef<(() => void) | null>(null);
  const previousExtent = useRef('');
  const lastSelection = useRef<{ id: string | null; marker?: L.Marker }>({ id: null });
  const [tileError, setTileError] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  useEffect(() => {
    hoverMarker.current = setHoveredId;
    return () => {
      hoverMarker.current = null;
    };
  }, [hoverMarker]);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      scrollWheelZoom: false,
      trackResize: false,
    }).setView(unitedStates, 4);
    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    layer
      .on('tileerror', () => setTileError(true))
      .on('tileload', () => setTileError(false))
      .addTo(instance);
    map.current = instance;
    const observer = new ResizeObserver(() => {
      if (!container.current?.clientWidth || !container.current.clientHeight) return;
      instance.invalidateSize({ animate: false });
      pendingFit.current?.();
      if (pendingSelection.current) pendingSelection.current();
      else if (lastSelection.current.marker)
        panToMarker(instance, lastSelection.current.marker, false);
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      pins.current.clear();
      previousExtent.current = '';
      pendingFit.current = null;
      pendingSelection.current = null;
      lastSelection.current = { id: null };
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const ids = new Set(stops.map(({ place }) => place.id));
    for (const [id, { marker }] of pins.current) {
      if (ids.has(id)) continue;
      marker.remove();
      pins.current.delete(id);
    }
    for (const stop of stops) {
      const { place, number, day } = stop;
      if (place.latitude === null || place.longitude === null) continue;
      const point = L.latLng(place.latitude, place.longitude);
      let entry = pins.current.get(place.id);
      if (!entry) {
        const numberLabel = document.createElement('span');
        const icon = L.divIcon({
          className: 'map-pin studio-marker',
          html: numberLabel,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -14],
        });
        const marker = L.marker(point, { icon, title: place.name, keyboard: true }).addTo(
          instance,
        );
        entry = { stop, marker };
        const currentEntry = entry;
        const label = document.createElement('span');
        marker.bindPopup(label).on('popupopen', () => {
          label.textContent = pinLabel(currentEntry.stop);
        });
        marker.on('click', () => select.current(currentEntry.stop));
        marker.getElement()?.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          select.current(currentEntry.stop);
          marker.openPopup();
        });
        pins.current.set(place.id, entry);
      }
      entry.stop = stop;
      if (!entry.marker.getLatLng().equals(point)) entry.marker.setLatLng(point);
      const element = entry.marker.getElement();
      if (!element) continue;
      element.title = place.name;
      element.setAttribute('aria-label', pinLabel(stop));
      element.classList.toggle('studio-marker-saved', stop.date === null);
      element.dataset.day = String((day ?? 1) % 3);
      element.classList.toggle('studio-marker-multiple-days', showDays);
      const label = element.firstElementChild;
      if (label)
        label.textContent =
          number === undefined ? '' : showDays ? `${day}/${number}` : String(number);
    }
  }, [stops, showDays]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const bounds = L.latLngBounds([]);
    for (const { marker } of pins.current.values()) bounds.extend(marker.getLatLng());
    const extent = [
      bounds.isValid() ? bounds.toBBoxString() : '',
      destinationLocation?.id ?? '',
      fitRequest,
    ].join('|');
    if (previousExtent.current === extent) return;
    previousExtent.current = extent;
    const fit = () => {
      pendingFit.current = null;
      if (bounds.isValid())
        instance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
      else if (destinationLocation)
        instance.setView(
          [destinationLocation.latitude, destinationLocation.longitude],
          destinationLocation.zoom,
          { animate: false },
        );
      else instance.setView(unitedStates, 4, { animate: false });
    };
    if (instance.getSize().x && instance.getSize().y) fit();
    else pendingFit.current = fit;
  }, [stops, destinationLocation, fitRequest]);

  useEffect(() => {
    const instance = map.current;
    if (!route || !instance || route.geometry.coordinates.length < 2) return;
    const points: L.LatLngTuple[] = route.geometry.coordinates.map(
      ([longitude, latitude]) => [latitude, longitude],
    );
    const line = L.polyline(points, {
      className: 'studio-route-line',
      weight: 5,
      opacity: 0.88,
    }).addTo(instance);
    const draw = () => {
      if (!container.current?.clientWidth || !container.current.clientHeight)
        return false;
      instance.fitBounds(line.getBounds(), {
        padding: [40, 40],
        maxZoom: 14,
        animate: false,
      });
      drawRoute(line);
      return true;
    };
    const observer = new ResizeObserver(() => {
      if (draw()) observer.disconnect();
    });
    if (!draw() && container.current) observer.observe(container.current);
    return () => {
      observer.disconnect();
      line.remove();
    };
  }, [route]);

  useEffect(() => {
    for (const [id, { marker }] of pins.current) {
      const active = id === selectedId;
      const hovering = id === hoveredId;
      const element = marker.getElement();
      element?.classList.toggle('selected', active);
      element?.classList.toggle('studio-marker-hover', hovering);
      element?.setAttribute('aria-pressed', String(active));
      marker.setZIndexOffset(active ? 1000 : hovering ? 500 : 0);
    }
    const marker = selectedId ? pins.current.get(selectedId)?.marker : undefined;
    if (
      lastSelection.current.id === selectedId &&
      lastSelection.current.marker === marker
    )
      return;
    lastSelection.current = { id: selectedId, marker };
    pendingSelection.current = null;
    const instance = map.current;
    if (!marker || !instance) return;
    const focusMarker = () => {
      pendingSelection.current = null;
      panToMarker(instance, marker, shouldAnimate());
    };
    if (container.current?.clientWidth && container.current.clientHeight) focusMarker();
    else pendingSelection.current = focusMarker;
  }, [selectedId, hoveredId, stops]);

  return (
    <>
      <div
        ref={container}
        className="map studio-map"
        aria-label={
          destinationLocation
            ? `Interactive map for ${destinationLocation.label}`
            : 'Interactive map of destinations'
        }
      />
      {tileError && (
        <p className="studio-map-error" role="status">
          Some map tiles are unavailable. Your place pins still work.
        </p>
      )}
    </>
  );
}
