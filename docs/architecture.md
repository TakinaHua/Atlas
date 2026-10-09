# Current architecture: frontend review

Browser → Next.js on port 3000 → Express health scaffold on port 8000. TypeScript/React owns trip/day/place navigation; Leaflet displays optional coordinates using OpenStreetMap tiles. Browser localStorage owns preview data, with revision checks, explicit JSON import/export, and validation before writes.

No backend itinerary CRUD, authentication, geocoding, driving routes, or optimization is active. The existing Python implementation is preserved in backend/ as inactive prior work; see Git history and dated validation notes for that architecture.
