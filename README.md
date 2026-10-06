# Atlas

A trip-planning website with a vanilla JavaScript frontend and a planned Django backend. The current runnable scaffold uses Express; the Django migration has not been implemented yet.

## Backend direction

Django (Python) is the selected framework for future backend development. The frontend and backend will remain separate under `frontend/` and `backend/`. The existing Express server currently serves the frontend and health endpoint; it is a temporary scaffold. See the [Django migration plan](docs/backend-plan.md) for the intended next steps.

## Quick start

Use Node.js 24 LTS (the version in `.nvmrc`) and npm. Run these commands from this directory:

```sh
npm ci
npm run dev
```

Open http://localhost:8000. For a normal run without automatic server restarts, use `npm start`. Frontend changes appear after refreshing the browser. No build step is required.

Optional configuration: copy `.env.example` to `.env`, then change `HOST` or `PORT`. The default listener is local to this computer. The backend workspace automatically loads the root `.env`; do not place secrets in frontend files.

## Project structure

```text
Atlas/
├── frontend/
│   ├── public/             # HTML entry point and future public assets
│   ├── src/
│   │   ├── app.js          # Browser startup, navigation, and event handlers
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Landing, dashboard, and trip planner screens
│   │   ├── storage/        # Browser persistence and trip operations
│   │   ├── styles/         # Website CSS
│   │   └── utilities/      # Browser-side date and formatting helpers
│   └── tests/              # Frontend unit and browser regression tests
├── backend/
│   ├── src/
│   │   ├── app.js          # Express application and static serving
│   │   ├── server.js       # Configuration, listener, and shutdown
│   │   └── routes/        # HTTP API routes
│   └── tests/              # HTTP integration tests
├── docs/                   # Architecture and validation notes
├── scripts/                # Project maintenance commands
├── archive/                # Preserved prototype, ZIP, and original metadata
├── .env.example            # Optional server configuration template
└── package.json            # Root commands and npm workspaces
```

The root lockfile currently manages both JavaScript workspaces. Install dependencies from the root. The future Django backend will use Python dependency management, documented when the migration is implemented. Browser code currently uses native ES modules without a bundler.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the website and API with server watch mode |
| `npm start` | Run the website and API |
| `npm test` | Run frontend unit tests and backend HTTP tests |
| `npm run check` | Syntax-check all active JavaScript files |
| `npm run test:browser` | Run the optional Playwright browser regression |

For browser tests, start the server in a separate terminal, install Playwright with `npm install --save-dev playwright --workspace=@atlas/frontend`, and install its browser with `npx playwright install chromium`. Then run `npm run test:browser`. Screenshots go to `artifacts/browser/`, which is ignored by Git. `ATLAS_TEST_URL` can override the test URL; the default is http://127.0.0.1:8000. The script also supports an externally supplied `CODEX_PRIMARY_RUNTIME_NODE_MODULES` runtime.

## Current functionality

The frontend supports trip creation, daily itineraries, editing and reordering places, and a coordinate-based map. Trips are stored in the browser's localStorage. The backend serves the website and exposes `GET /api/health`; trip APIs, authentication, and a database are not implemented.

Existing trips remain tied to the exact browser origin. Continue using the same hostname and port you used previously to access those trips (for example, `localhost:8000` and `127.0.0.1:8000` have separate storage). No storage key or trip format changed during organization.

See [architecture](docs/architecture.md), [frontend behavior and limitations](frontend/README.md), and [current validation](docs/validation-2026-10-06.md). Older files in `archive/` are reference material and are not served by the application.
