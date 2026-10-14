'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { DestinationLocation } from '../lib/types';

export default function DestinationSearch({
  initialLabel = '',
  initialLocation = null,
}: {
  initialLabel?: string;
  initialLocation?: DestinationLocation | null;
}) {
  const [query, setQuery] = useState(initialLocation?.label ?? initialLabel);
  const [selected, setSelected] = useState<DestinationLocation | null>(initialLocation);
  const [results, setResults] = useState<DestinationLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/destinations?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error(
            'Destination search is unavailable. Try again, or keep a typed destination for now.',
          );
        const data = await response.json();
        if (!controller.signal.aborted) {
          setResults(data.results);
          setActive(-1);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Search failed. Try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);
  function choose(location: DestinationLocation) {
    setSelected(location);
    setQuery(location.label);
    setOpen(false);
    setResults([]);
    setActive(-1);
    input.current?.focus();
  }
  return (
    <div className="destination-search">
      <label htmlFor={`${listId}-input`}>Destination</label>
      <div className="destination-input">
        <input
          ref={input}
          id={`${listId}-input`}
          name="destination"
          required
          maxLength={150}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={`${listId}-help`}
          autoComplete="off"
          value={query}
          placeholder="Search U.S. city or state"
          onFocus={() => {
            if (!selected) setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setResults([]);
            setActive(-1);
            setError('');
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              if (results.length)
                setActive((i) =>
                  event.key === 'ArrowDown'
                    ? (i + 1) % results.length
                    : i <= 0
                      ? results.length - 1
                      : i - 1,
                );
            } else if (event.key === 'Enter' && open && active >= 0 && results[active]) {
              event.preventDefault();
              choose(results[active]);
            } else if (event.key === 'Escape' && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        <input
          type="hidden"
          name="destinationLocation"
          value={selected ? JSON.stringify(selected) : ''}
        />
        {open && results.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="U.S. destinations"
            className="destination-results"
          >
            {results.map((location, index) => (
              <li
                id={`${listId}-${index}`}
                key={location.id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(location)}
              >
                <strong>{location.label}</strong>
                <small>
                  {location.kind === 'state'
                    ? location.stateCode === 'DC'
                      ? 'Federal district'
                      : 'State'
                    : 'City / town'}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${listId}-help`} className="muted">
        {selected
          ? `Map will open around ${selected.label}.`
          : 'Select a suggestion to center your map. You can also keep a typed destination without a map location.'}
      </p>
      {loading && <p role="status">Finding destinations…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && query.trim().length >= 2 && !selected && !results.length && (
        <p role="status">
          No matches. Try a city name and state abbreviation. Smaller towns may not be in
          this catalog.
        </p>
      )}
      <p className="muted destination-attribution">
        City/state data:{' '}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames
        </a>{' '}
        ·{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY 4.0
        </a>
      </p>
    </div>
  );
}
