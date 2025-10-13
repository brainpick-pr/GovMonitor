# Implementation Overview

GovMonitor.Org monitors Indian government websites and API endpoints using a Cloudflare-first stack. This section highlights the major runtime components and how they interact.

## Architecture

- **Cloudflare Worker** (`src/worker.ts`) exposes the API surface (`/api/status`, `/api/targets`, `/api/history`, etc.) and runs cron-triggered health checks.
- **Cloudflare D1** persists configuration (`config` table), monitored targets (`targets`), and check history (`checks`). Views such as `latest_status` provide convenient joins for worker reads.
- **Cloudflare KV** caches the latest status payload to accelerate dashboard loads and reduce D1 reads.
- **Frontend** (`frontend/` Vite + React) consumes the Worker APIs, aggregating results in cards, state dashboards, and dialogs.

## Health Check Flow

1. Targets are added through the `/api/targets` endpoint (or the frontend dialog), which validates domain rules and stores metadata in D1.
2. Cron triggers fire on configured intervals (5/10/15/30/60 minutes) to call `checkTarget` for due targets.
3. Each check performs an HTTP probe, records the result (`status`, `ok`, `latency_ms`, error), updates `next_check_at`, and invalidates the KV cache.
4. Frontend clients fetch `/api/status`, which serves cached data if available; otherwise, the Worker queries D1 and refreshes KV.

## Current Focus

- State-aware monitoring for Indian provinces (state stored per target).
- Dashboard summaries showing overall uptime and per-state distribution.
- Typed API interactions with TypeScript on both Worker and frontend.

Dive into the subpages for deeper details on Worker behavior, frontend components, and storage layouts.
