# Data & Storage

GovMonitor.Org relies on Cloudflare D1 and KV for persistence and caching. Understanding the schema is essential for extending health checks and analytics.

## D1 Database

### Tables

- `config`: Singleton row storing global settings (`interval_min`, `last_run_at`) with timestamps.
- `targets`: Metadata for each monitored endpoint. Columns include `name`, `url`, `hostname`, `state`, `interval_min`, `next_check_at`, and `enabled`.
- `checks`: Historical records of every health probe with `ts`, `ok`, `status`, `latency_ms`, and optional `error`.

### Views

- `latest_status`: Joins `targets` with their most recent check for fast dashboard reads.
- `uptime_24h` / `uptime_7d`: Aggregate success metrics for 24-hour and 7-day windows.

### Migration Goals

- Add columns for check type metadata (expected HTTP codes, JSON evaluation criteria) to drive upcoming API health features.
- Introduce derived tables or views for per-state statistics across multiple time windows (1d/7d/30d/365d).

## KV Namespaces

- `latest_status`: JSON cache (expires after ~30 seconds) containing the payload returned by `/api/status`.
- Planned keys (`state_stats_today`, `state_stats_7d`, etc.) will store aggregated per-state uptime to accelerate map views.

## Wrangler Configuration

- `wrangler.toml` binds D1 (`DB`) and KV (`KV`) namespaces, defines cron schedules, and sets environment variables like `USER_AGENT`, `TIMEOUT_MS`, and `MAX_LATENCY_MS`.
- Database migrations should be tracked via `wrangler d1 migrations`, with scripts checked into version control for reproducibility.

## Backup & Observability

- Export D1 snapshots periodically using `wrangler d1 export` (not yet automated).
- Consider Logpush or R2 storage for long-term retention of health check logs if regulatory compliance is required.
