'use client';

import { useState } from 'react';

/** Curated, licensed photos only where the destination matches; never guess a city. */
export default function DestinationPhoto({
  destination,
  eager = false,
}: {
  destination: string;
  eager?: boolean;
}) {
  const [failedSource, setFailedSource] = useState('');
  const hawaii =
    /o[ʻ’']?ahu|honolulu|waik[iī]k[iī]/i.test(destination) ||
    /^hawaii$/i.test(destination.trim());
  const pittsburgh = /pittsburgh/i.test(destination);
  const source = hawaii ? '/images/oahu.jpg' : pittsburgh ? '/images/pittsburgh.jpg' : '';
  return (
    <div className="destination-photo">
      {source && failedSource !== source ? (
        <img
          src={source}
          alt={hawaii ? 'Waikīkī coastline and Honolulu, Oʻahu' : 'Pittsburgh skyline'}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailedSource(source)}
        />
      ) : (
        <div className="photo-fallback">
          <span aria-hidden="true">↗</span>
          <span>{destination || 'Somewhere new'}</span>
          <small>Your next chapter</small>
        </div>
      )}
    </div>
  );
}
