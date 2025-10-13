# Improvement Plan (Cloudflare Stack Focus)

## Worker-Level Health Checks
- Extend the Worker’s `checkTarget` routine with configurable modes (`website`, `api-json`, `api-text`) and store per-target metadata describing the expected HTTP status, allowed fallback codes, and JSON path/value pairs or substring checks.
- Use `RequestInit.cf` options (e.g., `cf: { cacheTtl: 0 }`) to bypass cache for health probes, and ensure the Worker sets `fetch` timeouts via `AbortController` for each mode.
- Implement structured logging via `console.log` JSON payloads so they can be piped into Cloudflare Logpush for future observability.
- Continue caching the latest status in KV, but version the cache key (e.g., `latest_status:v2`) to avoid schema drift when deploying the enhanced payload.

## D1 Data Model & Aggregation
- Create a wrangler D1 migration that adds columns for `check_type`, `expected_http`, `json_path`, `expected_json_value`, `text_match`, and `interval_used` in the `checks` table. Provide defaults for existing rows and targets.
- Build SQL views or materialized aggregates (triggered via scheduled Worker invocations) that compute per-state uptime for 24h, 7d, 30d, and 365d windows using the formula `SUM(ok) / COUNT(*)`.
- Add a `state_daily_stats` table that the Worker can refresh every cron run: calculate totals and store them in D1, then push the summarized document into KV (`state_stats_today`, `state_stats_7d`, etc.) for fast map rendering.
- Introduce an API endpoint `/api/state-summary?window=7d` that reads from KV first, falls back to D1 aggregates, and rehydrates the cache.

## Scheduled Triggers & Automation
- Configure multiple Cloudflare Cron Triggers (existing 5/10/15/30/60 minute schedules) to run targeted jobs: primary health checks, nightly rollups to recompute monthly/annual aggregates, and a KV cleanup job that removes expired cached state documents.
- Ensure each cron handler respects Cloudflare’s execution limits by batching target checks (e.g., groups of 25) and using `Promise.allSettled` to prevent single failures from aborting the run.
- Add a "backfill" cron trigger that runs hourly to queue missed checks if the Worker was throttled, using D1 to identify stale `next_check_at` values.

## Frontend (Cloudflare Pages)
- Update the add-target dialog to capture endpoint type, expected status, JSON field/value, and interval, surfacing descriptions that match the Worker’s capabilities.
- Build a dedicated state dashboard page that queries `/api/state-summary` for 1d/7d/30d windows, supports filtering by state, and renders both summary cards and time-series charts using cached aggregates.
- Integrate an India map component (e.g., TopoJSON rendered via D3 or `react-simple-maps`) that consumes the summarized per-state uptime response and offers toggles between 1d/7d/30d/365d windows.
- Provide a target detail route that fetches `/api/history` with large windows (30d/365d) and uses lazy loading (React Suspense) so long time-series queries do not block the main dashboard.

## Deployability & Tooling
- Author wrangler migrations for D1 schema changes (`wrangler d1 migrations create`), and document the rollout sequence: deploy Worker after running migrations and seeding new columns using a backfill script executed with `wrangler d1 execute`.
- Add integration tests using Miniflare or `wrangler dev --test` that mock API endpoints returning different health payloads, ensuring the Worker interprets status codes, JSON values, and errors correctly.
- Enhance the README with instructions for setting up cron triggers, KV namespaces, and new environment variables (e.g., default expected HTTP status, JSON path separators).
- Create a release checklist: run `npm run build`, execute D1 migrations, deploy Worker (`wrangler deploy`), publish Pages build (`npm run frontend:deploy`), and verify KV cache warm-up via `wrangler kv:key get`.
