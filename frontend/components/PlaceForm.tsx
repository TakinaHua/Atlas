'use client';

import { useEffect, useRef, useState } from 'react';
import type { Place, DestinationLocation } from '../lib/types';

const categories = ['Sightseeing', 'Food & drink', 'Nature', 'Stay'];

export default function PlaceForm({
  place,
  location,
}: {
  place?: Place;
  location?: DestinationLocation | null;
}) {
  const [name, setName] = useState(place?.name ?? '');
  const [address, setAddress] = useState(place?.address ?? '');
  const [latitude, setLatitude] = useState(String(place?.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(place?.longitude ?? ''));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    { name: string; address: string; latitude: number; longitude: number }[]
  >([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    controller.current?.abort();
    if (query.trim().length < 3) {
      setMessage('Enter at least three characters.');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setMessage('');
    setResults([]);
    const params = new URLSearchParams({ q: query.trim() });
    if (location) {
      params.set('latitude', String(location.latitude));
      params.set('longitude', String(location.longitude));
    }
    try {
      const response = await fetch(`/api/places/search?${params}`, {
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? 'Search unavailable. Try again later.');
      if (!abort.signal.aborted) {
        setResults(data.results);
        setMessage(
          data.results.length
            ? 'Choose a result to fill in the place below.'
            : 'No matches. Try adding a city or street, or enter the place manually.',
        );
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setMessage(error instanceof Error ? error.message : 'Search unavailable.');
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  function clearLocation() {
    setLatitude('');
    setLongitude('');
  }

  const savedCategory = place?.category ?? 'Sightseeing';
  const [category, setCategory] = useState(
    categories.includes(savedCategory) ? savedCategory : 'Other',
  );
  const [customCategory, setCustomCategory] = useState(
    categories.includes(savedCategory) || savedCategory === 'Other' ? '' : savedCategory,
  );
  return (
    <>
      <label>
        Find a place or address
        <input
          value={query}
          maxLength={200}
          placeholder="Museum, restaurant, or street address"
          onChange={(e) => {
            controller.current?.abort();
            setLoading(false);
            setQuery(e.target.value);
            setResults([]);
            setMessage('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
        />
      </label>
      <button type="button" onClick={() => void search()} disabled={loading}>
        {loading ? 'Searching…' : 'Search places'}
      </button>
      <p className="muted">
        {location
          ? `Results favor ${location.label}.`
          : 'Include a city or state for better results.'}{' '}
        Search text is sent to Photon. Select a result to locate your stop.
      </p>
      {message && <p role="status">{message}</p>}
      {!!results.length && (
        <ul className="place-search-results">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  setName(r.name);
                  setAddress(r.address);
                  setLatitude(String(r.latitude));
                  setLongitude(String(r.longitude));
                  setResults([]);
                  setMessage('Location selected. Review the details below, then save.');
                }}
              >
                <strong>{r.name}</strong>
                <br />
                {r.address}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Search by{' '}
        <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">
          Photon
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

      <label>
        Place name
        <input
          name="name"
          required
          maxLength={150}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearLocation();
          }}
          placeholder="A place worth stopping for"
        />
      </label>
      <label>
        Address
        <input
          name="address"
          maxLength={300}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            clearLocation();
          }}
        />
      </label>
      <details>
        <summary>Map coordinates (optional)</summary>
        <div className="form-row">
          <label>
            Latitude
            <input
              name="latitude"
              type="number"
              step="any"
              min={-90}
              max={90}
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </label>
          <label>
            Longitude
            <input
              name="longitude"
              type="number"
              step="any"
              min={-180}
              max={180}
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </label>
        </div>
      </details>
      <p className="muted">
        {latitude && longitude
          ? 'Map location ready.'
          : 'Select a search result to add a map pin, or save without one.'}
      </p>
      <label>
        Category
        <select
          aria-label="Category"
          name={category === 'Other' ? 'categoryPreset' : 'category'}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {[...categories, 'Other'].map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
      {category === 'Other' && (
        <label>
          Custom category
          <input
            name="category"
            maxLength={80}
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            placeholder="Enter your own category"
          />
        </label>
      )}
      <label>
        Notes
        <textarea name="notes" maxLength={2000} rows={3} defaultValue={place?.notes} />
      </label>
    </>
  );
}
