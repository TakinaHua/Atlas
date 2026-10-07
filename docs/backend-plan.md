# Backend implementation status

The October 6 Django plan is implemented in the October 7 version. Django now owns itinerary persistence, validation, session ownership, REST endpoints, and route calculation. SQLite is the local database. The temporary Express server is preserved under `archive/express-backend`.

The latest request specifically calls for TypeScript/Next.js to match the resume, superseding the earlier plan to keep the vanilla frontend. The formatted earlier frontend remains in `archive/vanilla-frontend` and Git history.

Implemented: migrations, trip/day/place models, transactional create/update/delete/import, explicit localStorage import, asynchronous loading/error states, CSRF protection, optimistic edit conflicts, Dijkstra route calculation, provider integration, and test coverage.

Still outside this local project's scope: account login, hosted deployment, automatic geocoding, and automatic optimal stop ordering. Read the root README for setup and `architecture.md` for API details.
