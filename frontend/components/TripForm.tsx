import type { Trip } from '../lib/types';

export default function TripForm({ trip }: { trip?: Trip }) {
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
      <label>
        Destination
        <input
          name="destination"
          required
          maxLength={150}
          defaultValue={trip?.destination}
          placeholder="Pittsburgh, Pennsylvania"
        />
      </label>
      <div className="form-row">
        <label>
          Start date
          <input name="startDate" type="date" required defaultValue={trip?.startDate} />
        </label>
        <label>
          End date
          <input name="endDate" type="date" required defaultValue={trip?.endDate} />
        </label>
      </div>
      <p className="muted">
        Up to 60 days. Existing stops must be removed before their dates can be excluded.
      </p>
    </>
  );
}
