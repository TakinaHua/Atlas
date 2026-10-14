# Place and address search

Completed October 14, 2026. In Add/Edit place, enter a name or address, press **Search places**, review the address, select a result, and save. The selected name/address/coordinates use existing SQLite itinerary storage and map pins. Coordinates remain available under an optional expandable section. Editing a name/address clears coordinates to avoid a stale pin; changing notes/category preserves them. Manual entry without a pin still works.

## Integration and limits

`GET /api/places/search?q=Point%20State%20Park%20Pittsburgh` accepts a 3–200 character query and an optional latitude/longitude pair. Atlas proxies the Photon API, restricts to U.S. results, and biases toward the selected trip destination. Bias is not a geographic restriction: confirm the result address. The provider may omit businesses or precise street numbers; no result is not proof a place does not exist.

No API key is required for the public Photon demo. [Photon's policy](https://github.com/komoot/photon#demo-server) allows reasonable project use, may throttle heavy traffic, and provides no availability guarantee. This integration is for a small local prototype. Search text and destination center are sent to Photon only on explicit search. User queries are not logged by the search code. OpenStreetMap attribution appears in the form and on the map; [OSM data is ODbL](https://www.openstreetmap.org/copyright).

The server caches up to 200 queries in memory for 24 hours (cleared on restart), allows one outbound request at a time with at least 1.1 seconds between starts, times out after 8 seconds, and backs off for 60 seconds on provider rate limits. Errors allow retry or manual entry. Multiple server instances would need a shared limiter/cache before public deployment. `PHOTON_URL` can point to a compatible hosted/self-hosted endpoint; restart the API after changing it. Never expose this unauthenticated prototype as a high-volume public search service.

Results are normalized and invalid coordinates/non-U.S. records discarded. No scraping, background geocoding, route calculation, or Dijkstra implementation is included. Provider integration: `backend/src/place-search.ts`; form: `frontend/components/PlaceForm.tsx`. API documentation: https://github.com/komoot/photon/blob/master/docs/api-v1.md.

## Manual checks

1. Open a trip with a selected city and choose Add place.
2. Search a landmark or full street address; select the correct result and save.
3. Confirm the pin, refresh, reopen the itinerary, and confirm it remains.
4. Edit its notes/category and confirm the pin remains. Change the address and confirm it clears until another result is selected.
5. Try nonsense text and an unavailable network: the form should keep existing details and support manual entry.
6. Check the form on a phone-sized screen. Optional coordinates support manual corrections.

Automated tests use mocked provider responses, avoiding reliance on external service availability. A separate live request returned Point State Park in Pittsburgh successfully during implementation.
