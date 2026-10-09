'use client';

import { useState } from 'react';
import type { Place } from '../lib/types';

const categories = ['Sightseeing', 'Food & drink', 'Nature', 'Stay'];

export default function PlaceForm({ place }: { place?: Place }) {
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
        Place name
        <input
          name="name"
          required
          maxLength={150}
          defaultValue={place?.name}
          placeholder="A place worth stopping for"
        />
      </label>
      <label>
        Address
        <input name="address" maxLength={300} defaultValue={place?.address} />
      </label>
      <div className="form-row">
        <label>
          Latitude
          <input
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            defaultValue={place?.latitude ?? ''}
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
            defaultValue={place?.longitude ?? ''}
          />
        </label>
      </div>
      <p className="muted">
        Enter both coordinates for map markers. Addresses are saved as notes; they are not
        geocoded.
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
