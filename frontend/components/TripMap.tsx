'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { CalculatedRoute, Place, DestinationLocation } from '../lib/types';

/** Leaflet owns the map DOM; React owns the itinerary and route state. */
export default function TripMap({
  places,
  destinationLocation,
  route,
  selectedId,
  onSelect,
}: {
  destinationLocation?: DestinationLocation | null;
  places: Place[];
  route: Pick<CalculatedRoute, 'geometry'> | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlays = useRef<L.LayerGroup | null>(null);
  const contentBounds = useRef<L.LatLngBounds | null>(null);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current).setView([39.5, -98.35], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTileError(true))
      .addTo(instance);
    map.current = instance;
    overlays.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => {
      instance.invalidateSize();
      if (contentBounds.current?.isValid())
        instance.fitBounds(contentBounds.current, { padding: [40, 40], maxZoom: 14 });
    });
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
    contentBounds.current = bounds;
    if (bounds.isValid())
      map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    else if (destinationLocation)
      map.current.setView(
        [destinationLocation.latitude, destinationLocation.longitude],
        destinationLocation.zoom,
      );
    else map.current.setView([39.5, -98.35], 4);
  }, [places, route, selectedId, onSelect, destinationLocation]);

  return (
    <>
      <div
        ref={container}
        className="map"
        aria-label={
          destinationLocation
            ? `Interactive map for ${destinationLocation.label}`
            : 'Interactive map of destinations'
        }
      />
      {destinationLocation && (
        <p className="muted">
          Trip area: {destinationLocation.label} · Location data by{' '}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            GeoNames
          </a>
        </p>
      )}
      {tileError && (
        <p role="status">Map tiles are unavailable. Check your internet connection.</p>
      )}
    </>
  );
}
