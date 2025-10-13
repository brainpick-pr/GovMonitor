# Cloudflare Worker

The Worker (`src/worker.ts`) orchestrates health checks, data persistence, and API responses. Key responsibilities include:

## API Routes

- `GET /api/status`: Returns the latest state of every monitored target, served from KV when possible.
- `GET /api/history?targetId=…&window=…`: Streams check history for a target across predefined windows (24h, 7d).
- `GET /api/targets`, `POST /api/targets`, `DELETE /api/targets/:id`: Administer monitored endpoints with validation for `.gov` domains and mandatory Indian state metadata.
- `GET/PUT /api/config`: Manage global settings such as the default check interval.
- `POST /api/check`: Trigger a manual health check for a specific target.

All handlers share CORS headers and structured error responses. When mutating data, the Worker invalidates `latest_status` in KV to keep frontend views fresh.

## Health Check Logic

- Uses `fetch` with `HEAD` requests first, falling back to `GET` when HEAD is unsupported, and applies an `AbortController` timeout (default 5s).
- Records HTTP status, success (boolean), latency, and error message into D1’s `checks` table.
- Reschedules the next check by updating `next_check_at` using the target’s interval.
- Logs success/failure for observability.

## Cron Triggers

Cron invocations select enabled targets whose `next_check_at` has elapsed, run checks in parallel, and update the `config.last_run_at` timestamp. The Worker is designed to handle multiple cron schedules (5m/10m/15m/30m/60m) defined in `wrangler.toml`.

## Future Enhancements

- Support multiple check modes (basic HTTP vs. JSON health endpoints) driven by additional target metadata.
- Generate aggregated per-state metrics on cron runs and cache them in KV for map dashboards.
- Integrate structured logging with Cloudflare Logpush destinations.
