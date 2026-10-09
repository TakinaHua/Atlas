import type { Place } from '../lib/types';

export default function PlaceForm({ place }: { place?: Place }) {
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
        <select name="category" defaultValue={place?.category || 'Sightseeing'}>
          {['Sightseeing', 'Food & drink', 'Nature', 'Stay', 'Other'].map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
      <label>
        Notes
        <textarea name="notes" maxLength={2000} rows={3} defaultValue={place?.notes} />
      </label>
    </>
  );
}
