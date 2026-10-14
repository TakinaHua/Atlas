'use client';

import { useState } from 'react';
import DestinationSearch from './DestinationSearch';
import type { Trip } from '../lib/types';

export default function TripForm({ trip }: { trip?: Trip }) {
  const [startDate, setStartDate] = useState(trip?.startDate ?? '');
  const [endDate, setEndDate] = useState(trip?.endDate ?? '');

  function changeStartDate(value: string) {
    setStartDate(value);
    // Seed the end picker with the start month, preserving an already valid end date.
    if (value && (!endDate || endDate < value)) setEndDate(value);
  }

  return (
    <>
      <label>
        Trip name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={trip?.name}
          placeholder="A weekend worth remembering"
        />
      </label>
      <DestinationSearch
        initialLabel={trip?.destination}
        initialLocation={trip?.destinationLocation}
      />
      <div className="form-row">
        <label>
          Start date
          <input
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => changeStartDate(event.target.value)}
          />
        </label>
        <label>
          End date
          <input
            name="endDate"
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>
      <p className="muted">
        Up to 60 days. Existing stops must be removed before their dates can be excluded.
      </p>
    </>
  );
}
