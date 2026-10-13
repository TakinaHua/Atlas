# Atlas backend — Phase 1

TypeScript + Node.js + Express API for storing trips, ordered days, and ordered destinations. SQLite persists data locally. Mapping, geocoding, route calculation, Dijkstra, authentication, and frontend integration are outside this phase.

## Relationship to the current frontend

This API runs independently of the existing frontend preview and `backend/server.js`. Root npm scripts still run the preview scaffold. The frontend still saves trips in browser storage; this change does not connect it to the new API or migrate existing data. The archived and Python backends are preserved.

When running beside the frontend on port 3000, use `PORT=3001 npm run dev` from `backend/` and set `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000` in `backend/.env`. For the manual commands below, change `API` to `http://127.0.0.1:3001/api`. Frontend API integration remains a separate task.

## Start

Requires **Node.js 24 or newer** and npm. From this project's `backend` directory:

```sh
npm install
cp .env.example .env
npm run dev
```

API: `http://127.0.0.1:3000/api`. The existing frontend remains a static page.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`dev` reloads on source changes. `start` requires a successful build. Tests use temporary databases; they do not modify your development data. Node 24 may print an experimental warning for its built-in SQLite module.

## Configuration and storage

- `HOST`: defaults to `127.0.0.1`, for local development.
- `PORT`: defaults to `3000`.
- `DATABASE_PATH`: defaults to `backend/data/atlas.sqlite`, independent of the launch directory. An explicitly configured relative path is relative to the process working directory (`backend/` with these npm scripts).
- `CORS_ORIGINS`: comma-separated exact origins. Defaults to localhost and 127.0.0.1 on ports 5173 and 8080. No wildcard or credential support. Requests with no Origin header (such as curl) are allowed. `file://` browser origins are not enabled; serve the frontend over HTTP when connecting it.

SQLite creates the data directory automatically. Each trip, including its days and destinations, is stored as a JSON aggregate in one row. This keeps the first version small and makes nested changes and deletes atomic. Mutations use transactions, a busy timeout, WAL, and full synchronization. There is no in-memory write cache. A failed mutation rolls back. The API returns success only after committing.

For a backup, stop the server and copy the database file. Do not delete the data directory unless you want to erase all trips. Database files and journal files are ignored by Git. Keep the database on a local disk. This synchronous aggregate design suits a small local app; large datasets would benefit from normalized tables and pagination. Concurrent valid edits are applied in transaction order, without optimistic version checks. This API has no user accounts or authorization; it is intended for local use.

## Models and behavior

See `src/models.ts` for the TypeScript interfaces.

- **Trip**: generated UUID `id`, required `name`, optional nullable `startDate` and `endDate`, ordered `days`, server-managed `createdAt` and `updatedAt` UTC timestamps.
- **DayPlan**: generated UUID `id`, server-managed `dayNumber`, optional nullable `title` and `notes`, ordered `destinations`.
- **Destination**: generated UUID `id`, required `name`, numeric `latitude` (-90 to 90) and `longitude` (-180 to 180), optional nullable `notes`.

Names and titles are trimmed, nonempty, and at most 200 characters. Notes allow 5,000 characters. Dates must be real `YYYY-MM-DD` dates; start cannot follow end. Dates are optional and do not constrain the number of days in a trip. Unknown fields, empty PATCH bodies, numeric strings, invalid coordinates, and oversized bodies are rejected. Send `null` to clear nullable fields; omitted fields are preserved on PATCH.

New days and destinations append to their parent. Day numbers always start at 1 and follow array order. To change a day number, reorder the days. Destination array order is the visit order. Reordering requires **every child ID exactly once**, with no missing, foreign, or duplicate IDs. Deleting a day renumbers the remaining days. Deleting a parent removes its descendants. IDs are always scoped to the parent in the URL.

## Endpoints

Prefix all paths below with `/api`. Request bodies are JSON. GET and PATCH return the requested resource directly; collection GETs return arrays. POST returns `201` with the created resource and a `Location` header. DELETE returns `204` without a body. Reorder returns the updated array.

| Method | Path | Body / purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET, POST | `/trips` | List / create (`name`, optional dates) |
| GET, PATCH, DELETE | `/trips/:tripId` | Read / update metadata / delete |
| GET, POST | `/trips/:tripId/days` | List / append (`{}` or title/notes) |
| PUT | `/trips/:tripId/days/reorder` | `{"ids":["day-id-2","day-id-1"]}` |
| GET, PATCH, DELETE | `/trips/:tripId/days/:dayId` | Read / update title/notes / delete |
| GET, POST | `/trips/:tripId/days/:dayId/destinations` | List / append destination |
| PUT | `/trips/:tripId/days/:dayId/destinations/reorder` | `{"ids":["destination-id-2","destination-id-1"]}` |
| GET, PATCH, DELETE | `/trips/:tripId/days/:dayId/destinations/:destinationId` | Read / update / delete |

PATCH accepts only the editable fields described above, not nested arrays or IDs. To edit children, use their endpoints. Moving a destination between days is not supported by reorder.

Errors use `{"error":{"code":"...","message":"...","details":[]}}`; `details` is included for schema validation failures. Statuses: `400` invalid input/JSON/order/date range, `403` disallowed Origin, `404` unknown resource or endpoint, `413` body exceeds 100 KB, `415` wrong content type, `500` unexpected failure. Internal errors are logged on the server without exposing stacks to clients.

## Manual testing

Start the server in one terminal. Paste these commands in a second terminal (macOS/Linux shell). They use Node, already required by the backend, to extract generated IDs.

```sh
API=http://127.0.0.1:3000/api
json_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).id))'; }

curl -sS "$API/health"
TRIP_ID=$(curl -fsS -X POST "$API/trips" -H 'Content-Type: application/json' \
  -d '{"name":"Hawaii","startDate":"2027-06-01","endDate":"2027-06-03"}' | json_id)
DAY1=$(curl -fsS -X POST "$API/trips/$TRIP_ID/days" -H 'Content-Type: application/json' \
  -d '{"title":"Honolulu"}' | json_id)
DAY2=$(curl -fsS -X POST "$API/trips/$TRIP_ID/days" -H 'Content-Type: application/json' \
  -d '{"title":"North Shore"}' | json_id)
DESTS="$API/trips/$TRIP_ID/days/$DAY1/destinations"
STOP1=$(curl -fsS -X POST "$DESTS" -H 'Content-Type: application/json' \
  -d '{"name":"Waikiki Beach","latitude":21.2793,"longitude":-157.8290}' | json_id)
STOP2=$(curl -fsS -X POST "$DESTS" -H 'Content-Type: application/json' \
  -d '{"name":"Diamond Head","latitude":21.2620,"longitude":-157.8050}' | json_id)

curl -sS -X PATCH "$API/trips/$TRIP_ID" -H 'Content-Type: application/json' -d '{"name":"Oahu Adventure"}'
curl -sS -X PATCH "$API/trips/$TRIP_ID/days/$DAY1" -H 'Content-Type: application/json' -d '{"notes":"Bring sunscreen"}'
curl -sS -X PATCH "$DESTS/$STOP1" -H 'Content-Type: application/json' -d '{"notes":"Morning swim"}'
curl -sS -X PUT "$DESTS/reorder" -H 'Content-Type: application/json' -d "{\"ids\":[\"$STOP2\",\"$STOP1\"]}"
curl -sS -X PUT "$API/trips/$TRIP_ID/days/reorder" -H 'Content-Type: application/json' -d "{\"ids\":[\"$DAY2\",\"$DAY1\"]}"
curl -sS "$API/trips/$TRIP_ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.stringify(JSON.parse(s),null,2)))'
```

Stop and restart the server, then repeat the final GET in the same second terminal. Both days, their order, and the destinations should remain.

These requests should return `400`, `400`, and `404` respectively:

```sh
curl -i -X POST "$DESTS" -H 'Content-Type: application/json' -d '{"name":"Invalid","latitude":91,"longitude":0}'
curl -i -X PUT "$DESTS/reorder" -H 'Content-Type: application/json' -d '{"ids":[]}'
curl -i "$API/trips/does-not-exist"
```

Clean up the sample data (each DELETE should return `204`):

```sh
curl -i -X DELETE "$DESTS/$STOP1"
curl -i -X DELETE "$API/trips/$TRIP_ID/days/$DAY1"
curl -i -X DELETE "$API/trips/$TRIP_ID"
curl -sS "$API/trips"
```

## Implementation references

[Node.js SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) and [Express error handling](https://expressjs.com/en/guide/error-handling/).
