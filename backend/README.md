# Backend status

`server.js` is the active Node.js + Express preview scaffold. It exposes only `/api/health`; itinerary endpoints intentionally return 501.

The Python files and any local SQLite database are preserved from the previous implementation, but are inactive. No npm command invokes Python or Django. Do not delete the database: existing server trips are not automatically copied to browser storage. The full backend will be reconsidered after UI review.
