# Backend status

The active backend is now the TypeScript Express + SQLite API in `src/`. Root `npm run dev` launches it on `127.0.0.1:8000` alongside the Next.js frontend on port 3000. See [Phase 1 setup, endpoints, and manual tests](README-phase1.md).

The previous JavaScript preview scaffold (`server.js`), Python files, and existing Django database are preserved but inactive. No npm startup command invokes them. Data is not automatically migrated from Django or browser storage. The frontend now saves through `/api/itineraries` to the same SQLite database used by `/api/trips`. Browser trip migration is explicit through **Import browser trips**. See [frontend integration](../docs/frontend-api-integration.md).
