'use client';

import { useEffect, useState } from 'react';
import type { DestinationLocation } from '../lib/types';

type Photo = {
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  title: string;
  locationLabel: string;
  credit: string;
};

/** Catalog locations drive automatic photos; curated samples also work offline. */
export default function DestinationPhoto({
  destination,
  location,
  eager = false,
}: {
  destination: string;
  location?: DestinationLocation | null;
  eager?: boolean;
}) {
  const [result, setResult] = useState<{
    id: string;
    photo: Photo | null;
    error?: boolean;
  } | null>(null);
  const [failedSource, setFailedSource] = useState('');
  const [retry, setRetry] = useState(0);
  const hawaii =
    /o[ʻ’']?ahu|honolulu|waik[iī]k[iī]/i.test(destination) ||
    /^hawaii$/i.test(destination.trim());
  const pittsburgh = /pittsburgh/i.test(destination);
  // A selected catalog location takes precedence over free text and hardcoded samples.
  const curated = !location
    ? hawaii
      ? '/images/oahu.jpg'
      : pittsburgh
        ? '/images/pittsburgh.jpg'
        : ''
    : '';
  const id = location?.id;
  useEffect(() => {
    if (!id) return;
    let current = true;
    const controller = new AbortController();
    setResult(null);
    fetch(`/api/destination-photo?id=${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Photo unavailable');
        return response.json() as Promise<{ photo: Photo | null }>;
      })
      .then(({ photo }) => {
        if (current) setResult({ id, photo });
      })
      .catch(() => {
        if (current) setResult({ id, photo: null, error: true });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [id, retry]);
  const photo = result?.id === id ? result?.photo : null;
  const source = photo?.url || curated;
  const failed = Boolean(source && failedSource === source);
  const loading = Boolean(id && result?.id !== id);
  const error = failed || Boolean(id && result?.id === id && result.error);
  return (
    <div className="destination-photo" aria-busy={loading}>
      {source && !failed ? (
        <>
          <img
            src={source}
            alt={
              photo
                ? `${photo.locationLabel}: ${photo.title}`
                : hawaii
                  ? 'Waikīkī coastline and Honolulu, Oʻahu'
                  : 'Pittsburgh skyline'
            }
            loading={eager ? 'eager' : 'lazy'}
            onError={() => setFailedSource(source)}
          />
          {photo && location?.kind === 'state' && (
            <span className="photo-location">{photo.locationLabel}</span>
          )}
          {photo && (
            <details className="photo-credit">
              <summary aria-label={`Photo credit for ${location?.label}`}>
                ⓘ Photo
              </summary>
              <div>
                <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
                  {photo.title}
                </a>
                <span>{photo.locationLabel}</span>
                <span>{photo.author}</span>
                {photo.credit && <span>{photo.credit}</span>}
                <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                  {photo.license}
                </a>
                <span>Via Wikimedia Commons · cropped to fit</span>
              </div>
            </details>
          )}
        </>
      ) : (
        <div className="photo-fallback">
          <span aria-hidden="true">↗</span>
          <span>{destination || 'Somewhere new'}</span>
          <small>
            {loading
              ? 'Finding a destination photo…'
              : id
                ? 'Your next chapter · photo unavailable'
                : 'Your next chapter'}
          </small>
          {error && (
            <button
              className="text-button"
              onClick={() => {
                setFailedSource('');
                setRetry((value) => value + 1);
              }}
            >
              Retry photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
