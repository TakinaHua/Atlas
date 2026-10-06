# Planned Django backend

Decision recorded October 6, 2026: Atlas will use Django (Python) for its backend. The frontend will remain a separate vanilla JavaScript application.

## Current state

- `backend/` contains a temporary Express server that serves the frontend and `/api/health`.
- Trip operations and persistence live in `frontend/src/storage/tripStorage.js`, using browser localStorage.
- There is no Django project, Python environment, server database, authentication, or trip API yet.
- The existing npm setup and commands continue to run the current application.

## Intended migration sequence

1. Set up a Django project in `backend/`, with documented Python dependencies, environment configuration, and development commands.
2. Replace the Express health endpoint and configure frontend/static asset serving while preserving the existing browser routes.
3. Design trip, day, and place models and API endpoints. Decide on the database, authentication requirements, and whether to use Django REST Framework during that implementation.
4. Adapt the frontend storage boundary to asynchronous API requests, with loading and error handling. Provide an explicit migration/import path for existing localStorage trips before changing persistence.
5. Add Django endpoint and persistence tests, run the frontend regression checks, and update root commands and deployment documentation. Remove the Express scaffold and its dependencies once Django replaces it.

Keep new backend work aligned with this Django direction. Database choice, hosting, authentication design, Python/Django versions, and API tooling remain undecided; this planning update does not introduce those dependencies or change runtime behavior.
