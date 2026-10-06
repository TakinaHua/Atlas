# Architecture and development conventions

## Backend decision

As of October 6, 2026, Django (Python) is the planned backend framework. Keep the vanilla JavaScript frontend in `frontend/` and implement Django in `backend/` when migration work begins. Express is the current temporary server, not the framework selected for future backend features. See the [backend plan](backend-plan.md).

The sections below describe the running Express scaffold. Django setup, Python dependencies, database configuration, and replacement startup commands have not been implemented.

## Current request flow

The browser requests `/`, and Express serves `frontend/public/index.html`. That page loads native ES modules and CSS from `/src/`, mapped to `frontend/src/`. The frontend uses hash navigation (`#/dashboard`, `#/trip/<id>`), so page navigation does not require backend route rewrites.

Express mounts API routes beneath `/api`. `GET /api/health` returns `{"status":"ok","service":"atlas"}`. Unknown API routes return a JSON 404. Only the frontend public and source directories are served; project configuration, server code, tests, and archives stay outside the web root.

## Responsibilities

- `frontend/src/pages`: screen composition.
- `frontend/src/components`: reusable UI and map rendering.
- `frontend/src/storage`: trip operations and browser persistence.
- `frontend/src/utilities`: browser-side helper functions.
- `backend/src/routes`: API endpoint handlers.
- `backend/src/app.js`: application assembly, independently importable by tests.
- `backend/src/server.js`: process configuration and lifecycle.

Add backend services or database repositories when real business logic or persistent server data is introduced. Add a shared package only when both applications actually need the same code. Browser utilities currently belong to the frontend.

## Persistence

Trip data currently stays on the user's device under the existing `atlas.trips.v1` localStorage key. The organization change does not migrate, erase, or upload that data. There is no database, account system, or cloud synchronization.

Future server persistence should replace the storage boundary deliberately, including asynchronous UI loading/error states and a migration plan for existing local trips. Merely adding HTTP endpoints does not move existing browser data to a server.

## Working on the project

Run npm commands from the repository root. Keep one root lockfile and commit it with dependency changes. Use `.env` for private runtime settings and `.env.example` for documented defaults. `.editorconfig` defines formatting for future edits; existing frontend code was preserved without a formatting rewrite.

Run `npm test` and `npm run check` before sharing changes. Run the browser regression for changes to navigation, forms, or layout. There is currently no build output; deployment needs a Node runtime, installed dependencies, and both frontend and backend directories. Hosting environments can set `HOST=0.0.0.0` and their assigned `PORT`. Deployment infrastructure is not configured by this reorganization.

## Preserved originals

The former `atlas/` application is now `frontend/`, with imports in its tests and HTML entry references updated. The earlier root `public/` prototype is in `archive/early-prototype/`. The supplied ZIP and original package files/README are preserved in `archive/`. The prior validation report is in `docs/validation-2026-10-05.md` and describes the earlier layout.
