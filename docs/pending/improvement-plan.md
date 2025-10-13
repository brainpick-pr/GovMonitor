# Improvement Plan

This roadmap captures upcoming work to extend GovMonitor.Org’s monitoring capabilities while staying aligned with the Cloudflare stack.

## Worker & Health Checks

- Support multiple check modes (`website`, `api-json`, `api-text`) and capture metadata per target (expected HTTP codes, JSON path/value, substring matches).
- Use `RequestInit.cf` flags to bypass cache during probes and continue guarding requests with `AbortController` timeouts.
- Emit structured log entries so Cloudflare Logpush can aggregate check results.
- Version KV cache keys (e.g., `latest_status:v2`) when enriching payloads to avoid stale schema issues.

## D1 Schema & Aggregation

- Migrate the `targets` table to include new metadata columns and set defaults for existing rows.
- Record the interval used for each check to preserve accuracy when custom intervals are configured.
- Produce per-state aggregates for 24h/7d/30d/365d windows via SQL views or scheduled rollups; cache summaries in KV (`state_stats_today`, `state_stats_7d`, etc.).
- Expose `/api/state-summary?window=…` for the frontend to consume precomputed metrics.

## Cron Triggers & Automation

- Allocate cron schedules for health checks, nightly aggregation rollups, and KV cache maintenance.
- Batch target checks to respect Cloudflare execution limits and retry failed probes without blocking the entire run.
- Add a catch-up cron job that identifies overdue targets when prior runs were interrupted.

## Frontend & UX

- Expand the add-target dialog with fields for endpoint type, JSON validation, and interval selection.
- Build state dashboards and detail pages with tabs for 24h/7d/30d/365d metrics, backed by the new APIs.
- Implement an India choropleth map highlighting per-state uptime and monitored target counts.
- Provide health-history charts on individual target pages using `/api/history` with larger windows.

## Tooling & Docs

- Track D1 schema updates with `wrangler d1 migrations` and document rollout steps (migration, backfill, deploy).
- Create integration tests (Miniflare or `wrangler dev --test`) that simulate various API responses to verify Worker logic.
- Update README and internal docs when new settings or deployment steps are introduced.
- Maintain this VitePress site as a living set of runbooks for operators and contributors.
