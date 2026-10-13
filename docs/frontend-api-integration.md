# Frontend API integration

## Run and manually verify

From the Atlas root, run `npm install` and `npm run dev`. Open `http://127.0.0.1:3000`. The TypeScript API runs on port 8000. Stop an older development instance before starting another.

1. Create a trip, add a place with an address/category/notes, and leave its coordinates empty. It should save normally without a marker.
2. Add a second place with coordinates. Reorder the stops and edit a note.
3. Reload, then open the app in another browser/private window. The same trip and changes should appear.
4. Stop and restart the servers. The trip should remain.
5. Open the same trip in two tabs. Save a name change in one, then try saving in the other. The stale tab should show a conflict and retain its form input. Cancel and use **Reload trips** (or reload the page) before editing again.
6. Export JSON. Delete only the test trip and import its backup. Repeat import; it should skip the already imported ID.
7. On an address/browser with old preview trips, choose **Import browser trips**. Both old storage keys are supported. The original browser data remains unchanged. An invalid batch imports nothing.
8. Stop the API and attempt a save. An error should appear without clearing form input. If a connection fails during a save, reload after reconnecting to check whether it committed before retrying.

## API contract

The browser uses `/api/itineraries`; this is an adapter over the **same SQLite trip rows** as `/api/trips`, not a second database. It keeps multi-field UI edits atomic rather than issuing partially successful sequences of nested requests.

| Method | Endpoint                  | Result                                                                       |
| ------ | ------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/itineraries`        | `{ trips: [...] }`                                                           |
| GET    | `/api/itineraries/:id`    | One itinerary                                                                |
| POST   | `/api/itineraries`        | Create a trip, generated ID, revision 1; 201                                 |
| PUT    | `/api/itineraries/:id`    | Replace editable itinerary fields, require matching ID/current revision; 200 |
| DELETE | `/api/itineraries/:id`    | Require `{ revision }`; 204                                                  |
| POST   | `/api/itineraries/import` | `{ trips: [...] }`; returns `{ imported, skipped }`                          |

An itinerary includes `id`, `name`, `destination`, `startDate`, `endDate`, `revision`, and `days: [{ date, places }]`. A place includes `id`, `name`, `address`, `category`, `notes`, `latitude`, and `longitude`. Coordinates may both be null. Itineraries have 1–60 consecutive dated days, up to 30 places/day, and unique place IDs. The request limit is 1 MB (the upload UI limits backups to 900 KB), with up to 100 trips per import. Original `/api/trips` request limits remain 100 KB.

Imports preserve trip/place IDs, reset the new server revision to 1, skip IDs already saved, and validate all records before mutation. Invalid batches or database failures commit nothing. They never overwrite existing server trips. Browser migration reads both `atlas.preview.trips.v1` and `atlas.trips.v1`, without writing or deleting either key.

Legacy Phase 1 trips without dates receive display defaults from their stored dates or creation date; missing day entries display as empty days. Reads never change stored records. Existing day IDs/title/notes are preserved when saving the same dates. The date range expands for any extra existing days so no stops are silently hidden. Very long manually created Phase 1 trips remain subject to the UI's 60-day editing limit.

Revision mismatches return 409. Validation failures return 400. Existing nested `/api/trips` changes increment the same revision, so they also invalidate stale UI snapshots. No route calculation, geocoding, Django-data migration, or account system is included.

## Verification

`npm test` covers nested CRUD plus itinerary persistence, import rollback/idempotency, field preservation, and conflicts. `npm run test:browser` launches its own temporary database and tests the real UI/proxy/API connection on ports 3300/8300. `npm run check` checks types and formatting; `npm run build` builds both services.
