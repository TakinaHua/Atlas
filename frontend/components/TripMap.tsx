'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { CalculatedRoute, Place } from '../lib/types';

/** Leaflet owns the map DOM; React owns the itinerary and route state. */
export default function TripMap({
  places,
  route,
  selectedId,
  onSelect,
}: {
  places: Place[];
  route: CalculatedRoute | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlays = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current).setView([40.44, -79.99], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTileError(true))
      .addTo(instance);
    map.current = instance;
    overlays.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !overlays.current) return;
    overlays.current.clearLayers();
    const bounds = L.latLngBounds([]);
    places.forEach((place, index) => {
      if (place.latitude === null || place.longitude === null) return;
      const point: L.LatLngTuple = [place.latitude, place.longitude];
      bounds.extend(point);
      const icon = L.divIcon({
        className: `map-pin ${selectedId === place.id ? 'selected' : ''}`,
        html: `<span>${index + 1}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      // Use a text node for user-entered names: popup HTML must never be executable.
      const label = document.createElement('span');
      label.textContent = place.name;
      L.marker(point, { icon, title: place.name, keyboard: true })
        .bindPopup(label)
        .on('click', () => onSelect(place.id))
        .addTo(overlays.current!);
    });
    if (route) {
      const points: L.LatLngTuple[] = route.geometry.coordinates.map(
        ([longitude, latitude]) => [latitude, longitude],
      );
      L.polyline(points, { color: '#245e4d', weight: 5, opacity: 0.85 }).addTo(
        overlays.current,
      );
      points.forEach((point) => bounds.extend(point));
    }
    if (bounds.isValid())
      map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [places, route, selectedId, onSelect]);

  return (
    <>
      <div
        ref={container}
        className="map"
        aria-label="Interactive map of destinations and driving route"
      />
      {tileError && (
        <p role="status">Map tiles are unavailable. Check your internet connection.</p>
      )}
    </>
  );
}
