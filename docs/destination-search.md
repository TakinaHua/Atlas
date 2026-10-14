# U.S. destination search — October 14, 2026

## Completed behavior

The trip form searches a bundled GeoNames catalog on Atlas's own backend. Users can select a city/town or state, with state-qualified labels distinguishing duplicate city names. No third-party API or account is required. Attribution appears in the form and map caption.

`GET /api/destinations?q=Portland%20ME` returns up to ten public results. Queries must contain 2–100 characters. Names are lowercased, accents/punctuation normalized, and names/aliases and word prefixes matched. Exact state names/codes rank first, then exact names, aliases, and prefixes; population is a tie-breaker. A trailing state abbreviation restricts results to that state. This is prefix/token matching, not typo correction or a business-search engine.

The frontend waits 200 ms after typing, aborts obsolete requests, supports keyboard arrows/Enter/Escape, and shows loading/no-results/error states. A text-only destination remains supported, preserving existing trips and allowing entries outside the catalog. Editing the label clears its prior location selection; selecting a result restores it.

Trip records optionally include `destinationLocation` with stable ID, label, city/state kind, state/code, latitude/longitude, and display zoom. The server resolves submitted selections against the local catalog rather than trusting client coordinates. The location survives SQLite reopen, JSON export/import, and itinerary edits. Existing trips have no location until selected; no stops are removed during this upgrade.

Maps fit any located stops/route for the selected day. If none exist, they center on the selected destination; without a selection, they show a U.S. overview rather than Pittsburgh. State zooms are approximate views, not exact fitted boundaries. An existing trip with stops elsewhere keeps its stops even if its destination area changes.

## Manual verification

1. Plan a trip; type Portland. Confirm separate Oregon and Maine results and select one.
2. Search Honolulu, choose it with ArrowDown/Enter, save dates, and confirm the empty-day map shows Honolulu.
3. Refresh and reopen: the destination and map area remain. Open another empty day: it uses the same trip area.
4. Edit an old trip, select a city, and confirm its saved places remain.
5. Search CA and select California. Check the state view. Alaska and Hawaii are also included.
6. Change a selected label to a manual entry and save. The old location must no longer control the map.
7. Try a nonsense query; a no-results message should appear. Search failures should permit saving a text-only destination.

## Scope and data

21,079 records: 50 states + DC and 21,028 cities/towns or administrative seats. Many places below 500 residents, territories, and business/attraction names are not covered. See `backend/assets/README.md` for provenance, licensing, filters, checksum, and refresh instructions. Place geocoding and road routing remain separate future tasks.

Implementation: `backend/src/destinations.ts`, `backend/assets/us-destinations.json`, `backend/scripts/build-destinations.py`, `frontend/components/DestinationSearch.tsx`, and the itinerary model/form/map integration. Tests cover query validation, ranking, duplicate names, authoritative coordinates, persistence/import, legacy trip preservation, keyboard selection, and search failures.
