# U.S. destination catalog

Derived from [GeoNames US.zip](https://download.geonames.org/export/dump/US.zip), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: GeoNames (https://www.geonames.org/). Atlas filters and transforms the source into a search snapshot; no accuracy/completeness warranty is implied.

Snapshot retrieved: 2026-10-14T17:12:10.088367+00:00
Source SHA-256: `22fb0fc97f8c31930649eecf30fdbef72022e0a379e8216ca67f4c081be49b1a`
Records: 21079 — 50 states plus District of Columbia and 21,028 populated places.

Coverage: country US, recognized 50 state codes plus DC; ADM1 state/district records; PPL/PPLA/PPLA2/PPLA3/PPLA4/PPLC places with population >=500 or administrative-seat status. Territories, neighborhoods, historical/abandoned places, and many smaller towns are excluded. Labels include the state; ASCII alternate names are retained for matching. Coordinates come from GeoNames. State/city zoom levels are Atlas display choices, not administrative boundaries.

The JSON is versioned with the code and loaded locally; no API key or network request is needed for destination search. Map tiles still need internet. The source ZIP is not committed.

To refresh deliberately (Python 3 required only for regeneration):

```sh
curl -fL https://download.geonames.org/export/dump/US.zip -o /tmp/atlas-US.zip
python3 backend/scripts/build-destinations.py /tmp/atlas-US.zip
npm test
```

Review the generated diff, update this snapshot summary, and run browser checks before committing. Stable GeoNames IDs identify selected locations. If a future snapshot removes an ID, editing/importing that selection prompts the user to select again rather than trust unrecognized coordinates.
