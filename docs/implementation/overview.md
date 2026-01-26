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

## ✅ Implemented Features

### Core Monitoring
- Multiple check modes (website, api-json, api-text)
- JSON path validation with dot notation (e.g., "status.health")
- Text content matching for HTML/API responses
- Configurable status code validation (single or array)
- Per-target interval overrides (5/10/15/30/60 min)
- Automatic cron-triggered checks

### Data & Performance
- D1 database with views for 24h/7d/30d/365d windows
- KV caching (60s for status, 300s for state summaries)
- State aggregation across 36 Indian states/UTs
- Historical check data with latency tracking
- Optimized indexes for fast queries
- Migration system for schema evolution

### User Interface
- Interactive India choropleth map
- State dashboard with sortable statistics
- Real-time auto-refresh (30s intervals)
- Advanced target configuration dialog
- Responsive navy blue theme
- View switching (targets grid / state dashboard)

## ❌ Known Gaps

### Critical Missing Features
1. **No Alert System**
   - No email/Slack/webhook notifications on downtime
   - No configurable alerting rules
   - No escalation policies

2. **No Authentication**
   - Public API access (no auth required)
   - No user management
   - No role-based permissions

3. **Limited Target Analysis**
   - No individual target detail pages
   - No custom date range selection (fixed windows only)
   - No drill-down into specific failure patterns

### Configuration Issues
- Empty `database_id` in wrangler.toml (must be configured)
- Empty KV namespace `id` in wrangler.toml (must be configured)
- No custom route or zone configuration

### Operational Gaps
- No integration test suite
- No certificate expiration monitoring
- No API rate limiting
- No audit logging for configuration changes
- No automated backups to R2
- No data retention policies

### User Experience Gaps
- No dark mode support
- No PWA capabilities for mobile
- No CSV/JSON export functionality
- No bulk target operations
- No maintenance window configuration
- No custom metrics or dashboards

### Advanced Monitoring Gaps
- No multi-region testing (single edge location)
- No dependency chain monitoring
- No adaptive/smart scheduling
- No anomaly detection or trend analysis
- No performance regression alerts

## Next Steps

Refer to the [Improvement Plan](/pending/improvement-plan) for prioritized feature roadmap.

Dive into the subpages for deeper details on Worker behavior, frontend components, and storage layouts.
