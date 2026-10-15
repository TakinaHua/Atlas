# Cache behavior and verification

Audited October 15, 2026. Provider caches are shared by requests handled by one API instance; they are not SQLite persistence.

| Data                | Maximum entries | Lifetime |
| ------------------- | --------------- | -------- |
| Photon place search | 200             | 24 hours |
| OSRM driving routes | 50              | 1 hour   |

Keys contain the complete provider request URL. Search keys include trimmed query text and optional location bias. Route keys include ordered coordinates and route options. Changing the stop order or coordinates therefore cannot reuse the old route.

The shared `backend/src/provider-cache.ts` uses a monotonic clock. Lifetime starts when a successful response finishes; reads do not extend it. Expired entries are removed before lookup/insertion. At capacity, the least recently used entry is evicted. Returned values are copied so one caller cannot corrupt later results.

Simultaneous identical requests share one provider call. Different uncached requests remain subject to the existing per-provider limit: one outbound request at a time and at least 1.1 seconds between starts. Provider HTTP 429 triggers a fixed 60-second backoff. Valid cache hits remain available during backoff. Failed calls release pending state and are never cached. Valid empty search results are cached; a response containing only structurally malformed features is an error, allowing retry.

Mutable API responses, search results, route results, and API errors carry `Cache-Control: no-store` so browsers/proxies do not independently retain them. The bundled destination catalog explicitly overrides this with `public, max-age=3600`. The catalog is a static dataset, not a per-user itinerary.

## Verification

`npm test` includes deterministic clock and mocked-provider tests for exact expiry boundaries, completion-based TTL, real capacity limits, least-recently-used eviction, expired-entry removal, simultaneous requests, mutation isolation, key separation, failure recovery, backoff, and HTTP cache headers. These tests make no live provider requests and do not wait for real 24-hour expiry.

`npm run test:browser` covers the user-facing search and routing flows, including stale route removal after itinerary changes. Type checks and production builds verify integration.

To check manually, search the same query twice or calculate the same route twice; the second request should work without triggering the provider throttle. Reorder/edit stops and recalculate: a previous route must not remain visible. API requests still reach Atlas on a cache hit; browser network timing alone cannot prove whether Atlas contacted its provider.

## Limits

Caches and rate limits reset on API restart and are independent across processes. Trip data remains in SQLite. Multiple API processes require a shared cache/limiter before scaling. Memory is bounded by entry count, not a byte budget. Provider availability and data freshness are outside Atlas's control; successful results may remain unchanged until their TTL expires. This audit verifies defined behavior, not a guarantee against every production failure.
