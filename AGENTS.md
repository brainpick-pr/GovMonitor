# AGENTS.md - GovMonitor.Org

> **AI Agent Context Guide**
> This document provides comprehensive context for AI assistants working on the GovMonitor.Org codebase.
> Last updated: January 26, 2026

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Development Workflow](#development-workflow)
4. [Code Conventions](#code-conventions)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Check Modes](#check-modes)
8. [Caching Strategy](#caching-strategy)
9. [Frontend Architecture](#frontend-architecture)
10. [Testing Guidelines](#testing-guidelines)
11. [Common Tasks](#common-tasks)
12. [Important Constraints](#important-constraints)
13. [Deployment Notes](#deployment-notes)
14. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Purpose
**GovMonitor.Org** is a real-time uptime monitoring system specifically designed for government websites. It tracks the availability, performance, and health of government web services across Indian states and union territories, providing administrators with visibility into the reliability of public digital infrastructure.

### Target Domain
The system exclusively monitors government domains:
- `.gov` (US federal)
- `.gov.*` (state/local government)
- `.gc.ca` (Canadian government)
- `.government.*` (other government domains)

**CRITICAL:** Domain validation is enforced at the database level via CHECK constraints. Non-government domains will be rejected.

### Key Value Proposition
- **Edge-Native Architecture**: Runs entirely on Cloudflare's global edge network
- **Real-Time Monitoring**: Scheduled checks at 5/10/15/30/60 minute intervals
- **State-Level Organization**: Aggregates data across 36 Indian states and union territories
- **Historical Analytics**: Tracks uptime percentages and latency over 24h/7d/30d/365d windows
- **Multi-Mode Validation**: Supports website, JSON API, and text-based checks

### Primary Features
1. **Flexible Check Modes**
   - Website mode: Simple HTTP status validation
   - API JSON mode: JSON path/value validation
   - API Text mode: Substring matching in response bodies

2. **State-Based Visualization**
   - Interactive SVG map of India
   - Color-coded uptime indicators per state
   - Sortable state statistics tables

3. **Performance Optimization**
   - Cloudflare KV caching (60s TTL on status)
   - D1 database views for pre-computed aggregations
   - Batch processing (25 targets per batch)
   - State summary caching (5 min TTL)

4. **Comprehensive History**
   - Per-target check history with charts
   - Time-series latency tracking
   - Error message logging
   - Interval tracking (what interval was configured at check time)

---

## Architecture

### Technology Stack

#### Backend
- **Runtime**: Cloudflare Workers (V8 isolates, edge computing)
- **Language**: TypeScript (ES2022 target)
- **Database**: Cloudflare D1 (SQLite-based, distributed)
- **Cache**: Cloudflare KV (key-value store, global replication)
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`
- **Deployment**: Wrangler CLI

#### Frontend
- **Framework**: React 18.2.0
- **Build Tool**: Vite 5
- **Language**: TypeScript
- **UI Library**: shadcn/ui (Radix UI primitives + Tailwind)
- **Styling**: Tailwind CSS 3.4.1
- **Charts**: Recharts 2.10.3
- **Icons**: Lucide React
- **Utilities**:
  - `date-fns` (date formatting)
  - `class-variance-authority` (component variants)
  - `tailwind-merge` (CSS class deduplication)

#### Infrastructure
- **Worker Hosting**: Cloudflare Workers (global edge deployment)
- **Frontend Hosting**: Cloudflare Pages (static site)
- **Database**: D1 (distributed SQL with local development support)
- **Caching**: KV (edge cache with automatic replication)
- **Cron**: Cloudflare Cron Triggers (5 intervals: 5/10/15/30/60 min)

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React SPA (Cloudflare Pages)                        │  │
│  │  - StatusCard, StateDashboard, IndiaMap             │  │
│  │  - Real-time status updates (30s polling)           │  │
│  │  - Time window toggles (24h/7d/30d/365d)            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓ API Calls (/api/*)
┌─────────────────────────────────────────────────────────────┐
│                       Worker Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/worker.ts (736 lines)                           │  │
│  │  - fetch(): HTTP request handler (API routes)        │  │
│  │  - scheduled(): Cron trigger handler                 │  │
│  │  - Health check logic (3 modes)                      │  │
│  │  - Batch processing (25 targets/batch)               │  │
│  │  - Backfill for missed checks                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓ Data Access
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │   Cloudflare D1         │  │   Cloudflare KV         │  │
│  │   (Primary Storage)     │  │   (Fast Cache)          │  │
│  │                         │  │                         │  │
│  │  Tables:                │  │  Keys:                  │  │
│  │  - config               │  │  - UPTIME_STATUS:latest │  │
│  │  - targets              │  │  - STATE_SUMMARY:{win}  │  │
│  │  - checks               │  │                         │  │
│  │  - state_daily_stats    │  │  TTL: 60s / 300s        │  │
│  │                         │  │                         │  │
│  │  Views:                 │  │                         │  │
│  │  - latest_status        │  │                         │  │
│  │  - uptime_24h/7d        │  │                         │  │
│  │  - state_uptime_*       │  │                         │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

#### Backend (`src/`)
- **`worker.ts`** (736 lines) - Main worker entry point
  - Exports: `fetch()` (API handler), `scheduled()` (cron handler)
  - Implements all API endpoints
  - Contains health check logic for all 3 modes
  - Manages KV caching and D1 queries

#### Frontend (`frontend/src/`)
- **`main.tsx`** - React application entry point
- **`App.tsx`** - Main application component with routing
- **Components:**
  - `StatusCard.tsx` - Individual target status with mini-charts
  - `StateDashboard.tsx` - State-level view with map and table
  - `IndiaMap.tsx` / `IndiaMapOptimized.tsx` - SVG map visualization
  - `TargetDetail.tsx` - Detailed analytics with time-series charts
  - `AddTargetDialog.tsx` - Form for adding new monitored targets
  - `LandingPage.tsx` - Marketing/intro page
  - `ui/*` - shadcn/ui components (button, card, dialog, etc.)

#### Database
- **`schema.sql`** - Base schema (config, targets, checks, views)
- **`migrations/001_add_check_modes.sql`** - Check mode extensions
- **`migrations/002_state_aggregation.sql`** - State statistics views

#### Configuration
- **`wrangler.toml`** - Worker configuration (D1, KV, cron triggers)
- **`frontend/vite.config.ts`** - Vite build configuration
- **`tsconfig.json`** - TypeScript configuration (ES2022, strict mode)

---

## Development Workflow

### Local Development

#### Start Worker (API backend)
```bash
npm run dev
# Starts Worker on http://localhost:8787
# Uses local D1 database and KV namespace
# Auto-reloads on file changes
```

#### Start Frontend
```bash
npm run frontend:dev
# Starts Vite dev server on http://localhost:5173
# Proxies API calls to Worker on :8787
# Hot module replacement enabled
```

#### Initialize Local Database
```bash
npm run db:migrate:local
# Creates local D1 database
# Runs schema.sql and all migrations
# Required before first npm run dev
```

### Testing

```bash
# Run all tests
npm run test

# Watch mode (auto-run on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Deployment

#### Deploy Worker (API backend)
```bash
npm run deploy
# Builds TypeScript
# Deploys to Cloudflare Workers
# Activates cron triggers
# Requires D1 database_id and KV namespace id in wrangler.toml
```

#### Deploy Frontend (static site)
```bash
npm run frontend:build
# Builds production bundle to frontend/dist/

npm run frontend:deploy
# Deploys to Cloudflare Pages
# Automatically invalidates cache
```

### Utility Commands

#### Generate Optimized SVG Paths
```bash
npm run generate:svg
# Converts assets/india_state.geojson to optimized SVG paths
# Output: frontend/src/data/indiaSvgPaths.ts
# Run after updating GeoJSON boundaries
```

#### Database Operations
```bash
# Local development
wrangler d1 execute govmonitor-db --local --file=schema.sql
wrangler d1 execute govmonitor-db --local --file=migrations/001_add_check_modes.sql

# Production
wrangler d1 execute govmonitor-db --file=schema.sql
wrangler d1 execute govmonitor-db --file=migrations/001_add_check_modes.sql
```

#### Manual Check Trigger
```bash
# Trigger check for all targets
curl -X POST http://localhost:8787/api/check

# Trigger check for specific target
curl -X POST http://localhost:8787/api/check?targetId=123
```

---

## Code Conventions

### TypeScript Standards

- **Strict Mode**: Enabled (`strict: true` in tsconfig.json)
- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Type Annotations**: Required for all function parameters and return types
- **Null Checks**: Strict null checking enabled (`strictNullChecks: true`)

**Example:**
```typescript
async function checkTarget(
  target: Target,
  db: D1Database,
  env: Env
): Promise<CheckResult> {
  // Implementation
}
```

### Domain Validation

**CRITICAL CONSTRAINT:** Only government domains are allowed.

**Enforced at Database Level:**
```sql
CHECK (
    hostname LIKE '%.gov' OR
    hostname LIKE '%.gov.%' OR
    hostname LIKE '%.gc.ca' OR
    hostname LIKE '%.government.%'
)
```

**Frontend Validation:**
```typescript
// In AddTargetDialog.tsx
const hostname = new URL(url).hostname;
const isValid = /\.(gov|gc\.ca|government\.)/.test(hostname);
```

**Worker Validation:**
```typescript
// In worker.ts POST /api/targets
const hostname = new URL(url).hostname;
if (!hostname.match(/\.(gov|gc\.ca|government\.)/)) {
  return new Response('Only government domains allowed', { status: 400 });
}
```

### State Organization

**36 Indian States and Union Territories** (must match exactly):

```typescript
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];
```

**Validation:**
- Every target MUST have a valid state assignment
- State names must match exactly (case-sensitive)
- Frontend dropdown enforces selection from valid list

### Cron Intervals

**Supported Intervals:** 5, 10, 15, 30, 60 minutes

**Wrangler.toml Configuration:**
```toml
[triggers]
crons = [
    "*/5 * * * *",   # Every 5 minutes
    "*/10 * * * *",  # Every 10 minutes
    "*/15 * * * *",  # Every 15 minutes
    "*/30 * * * *",  # Every 30 minutes
    "0 * * * *"      # Every 60 minutes
]
```

**Per-Target Override:**
- Each target has `interval_min` field (default: 15)
- Overrides global `config.interval_min` setting
- Worker schedules next check: `next_check_at = current_time + (interval_min * 60)`

**Interval Tracking:**
- `checks.interval_used` column records interval at check time
- Allows historical analysis of interval changes

### Error Handling

**Standard Error Response Format:**
```typescript
return new Response(JSON.stringify({ error: 'Error message' }), {
  status: 400, // or 404, 500, etc.
  headers: { 'Content-Type': 'application/json' }
});
```

**Check Error Logging:**
```typescript
// Store error in checks table
await db.prepare(`
  INSERT INTO checks (target_id, ts, ok, status, latency_ms, error)
  VALUES (?, ?, 0, NULL, NULL, ?)
`).bind(targetId, timestamp, errorMessage).run();
```

### Naming Conventions

- **Tables/Columns**: `snake_case` (e.g., `state_daily_stats`, `uptime_percentage`)
- **TypeScript Variables**: `camelCase` (e.g., `targetId`, `uptimePercentage`)
- **React Components**: `PascalCase` (e.g., `StatusCard`, `StateDashboard`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `TIMEOUT_MS`, `MAX_LATENCY_MS`)
- **KV Keys**: `UPPER_SNAKE_CASE:scope` (e.g., `UPTIME_STATUS:latest`, `STATE_SUMMARY:24h`)

---

## Database Schema

### Tables

#### `config` - Global Settings
```sql
CREATE TABLE config (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton constraint
    interval_min INTEGER NOT NULL DEFAULT 15,
    last_run_at INTEGER,                    -- Unix timestamp
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Key Points:**
- **Singleton table**: Only one row allowed (`id = 1`)
- `interval_min`: Default check interval for all targets
- `last_run_at`: Tracks last successful cron run
- Updated via `PUT /api/config`

#### `targets` - Monitored Websites
```sql
CREATE TABLE targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                     -- Display name
    url TEXT NOT NULL UNIQUE,               -- Full URL
    hostname TEXT NOT NULL,                 -- Extracted hostname
    state TEXT NOT NULL,                    -- Indian state/UT
    interval_min INTEGER NOT NULL DEFAULT 15,
    next_check_at INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,     -- 1=active, 0=disabled

    -- Check mode fields (added in migration 001)
    check_mode TEXT NOT NULL DEFAULT 'website',  -- 'website'|'api-json'|'api-text'
    expected_status INTEGER NOT NULL DEFAULT 200,
    allowed_status_codes TEXT,              -- JSON array: "[200,201,204]"
    json_path TEXT,                         -- Dot notation: "data.status"
    expected_json_value TEXT,               -- Expected value at json_path
    text_match TEXT,                        -- Substring to match

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

    CHECK (
        hostname LIKE '%.gov' OR
        hostname LIKE '%.gov.%' OR
        hostname LIKE '%.gc.ca' OR
        hostname LIKE '%.government.%'
    )
);

CREATE INDEX idx_targets_next_check ON targets(next_check_at, enabled) WHERE enabled = 1;
CREATE INDEX idx_targets_check_mode ON targets(check_mode);
CREATE INDEX idx_targets_state ON targets(state);
```

**Key Points:**
- **Domain enforcement**: CHECK constraint validates government domains
- **Unique URL**: Prevents duplicate monitoring
- **Per-target intervals**: Overrides global `config.interval_min`
- **Next check scheduling**: Worker queries `WHERE next_check_at <= current_time AND enabled = 1`
- **Check modes**: Supports 3 validation types (see [Check Modes](#check-modes))

#### `checks` - Historical Results
```sql
CREATE TABLE checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    ts INTEGER NOT NULL,                    -- Unix timestamp
    ok INTEGER NOT NULL,                    -- 1=up, 0=down
    status INTEGER,                         -- HTTP status code
    latency_ms INTEGER,                     -- Response time
    error TEXT,                             -- Error message if failed

    -- Added in migration 001
    validation_details TEXT,                -- JSON with validation info
    interval_used INTEGER,                  -- Interval configured at check time

    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

CREATE INDEX idx_checks_target_ts ON checks(target_id, ts DESC);
CREATE INDEX idx_checks_ts ON checks(ts DESC);
```

**Key Points:**
- **Cascade deletes**: Deleting a target removes all its checks
- **ok field**: 1 = check passed, 0 = check failed
- **latency_ms**: Only recorded for successful checks
- **validation_details**: JSON blob with mode-specific validation info
- **Time-series indexing**: Optimized for history queries

#### `state_daily_stats` - Cached Aggregations
```sql
CREATE TABLE state_daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state TEXT NOT NULL,
    date TEXT NOT NULL,                     -- ISO date: "2026-01-26"
    total_targets INTEGER NOT NULL DEFAULT 0,
    total_checks INTEGER NOT NULL DEFAULT 0,
    successful_checks INTEGER NOT NULL DEFAULT 0,
    failed_checks INTEGER NOT NULL DEFAULT 0,
    uptime_percentage REAL NOT NULL DEFAULT 0.0,
    avg_latency_ms REAL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(state, date)
);

CREATE INDEX idx_state_daily_stats_state_date ON state_daily_stats(state, date DESC);
```

**Key Points:**
- **Daily aggregation cache**: Pre-computed daily stats per state
- **Unique constraint**: One row per state per day
- **Purpose**: Reduces load for historical queries (30d, 365d windows)

### Views

#### `latest_status` - Most Recent Check Per Target
```sql
CREATE VIEW latest_status AS
SELECT
    t.id, t.name, t.url, t.hostname, t.state, t.enabled,
    c.ts, c.ok, c.status, c.latency_ms, c.error
FROM targets t
LEFT JOIN checks c ON t.id = c.target_id
WHERE c.id = (
    SELECT id FROM checks
    WHERE target_id = t.id
    ORDER BY ts DESC
    LIMIT 1
);
```

**Usage:** `GET /api/status` (cached in KV with 60s TTL)

#### `uptime_24h` / `uptime_7d` - Time Window Statistics
```sql
CREATE VIEW uptime_24h AS
SELECT
    target_id,
    COUNT(*) as total_checks,
    SUM(ok) as successful_checks,
    ROUND(AVG(CASE WHEN ok = 1 THEN 100.0 ELSE 0.0 END), 2) as uptime_percentage,
    AVG(CASE WHEN ok = 1 THEN latency_ms END) as avg_latency_ms,
    MAX(CASE WHEN ok = 1 THEN latency_ms END) as max_latency_ms,
    MIN(CASE WHEN ok = 1 THEN latency_ms END) as min_latency_ms
FROM checks
WHERE ts >= unixepoch() - 86400  -- Last 24 hours
GROUP BY target_id;
```

**Similar views:** `uptime_7d` (604800s), `uptime_30d` (2592000s), `uptime_365d` (31536000s)

**Usage:** `GET /api/history?targetId=X&window=24h`

#### `state_uptime_24h/7d/30d/365d` - State Aggregations
```sql
CREATE VIEW state_uptime_24h AS
SELECT
    t.state,
    COUNT(DISTINCT t.id) as total_targets,
    COUNT(c.id) as total_checks,
    SUM(CASE WHEN c.ok = 1 THEN 1 ELSE 0 END) as successful_checks,
    SUM(CASE WHEN c.ok = 0 THEN 1 ELSE 0 END) as failed_checks,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN 100.0 ELSE 0.0 END), 2) as uptime_percentage,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN c.latency_ms END), 2) as avg_latency_ms
FROM targets t
LEFT JOIN checks c ON t.id = c.target_id AND c.ts >= unixepoch() - 86400
WHERE t.enabled = 1
GROUP BY t.state;
```

**Similar views:** `state_uptime_7d`, `state_uptime_30d`, `state_uptime_365d`

**Usage:** `GET /api/state-summary?window=24h` (cached in KV with 300s TTL)

### Critical Constraints

1. **Config Singleton**: `CHECK (id = 1)` ensures only one config row
2. **Domain Validation**: CHECK constraint on `targets.hostname`
3. **Unique URLs**: `UNIQUE` constraint on `targets.url`
4. **Cascade Deletes**: Removing a target deletes all associated checks
5. **State-Date Uniqueness**: `UNIQUE(state, date)` in `state_daily_stats`

### Indexes for Performance

- `idx_targets_next_check`: Optimizes cron queries (`WHERE next_check_at <= ? AND enabled = 1`)
- `idx_targets_check_mode`: Fast filtering by check mode
- `idx_targets_state`: State-based queries
- `idx_checks_target_ts`: Per-target history queries (DESC order)
- `idx_checks_ts`: Global time-series queries
- `idx_state_daily_stats_state_date`: State aggregation lookups

---

## API Endpoints

All endpoints are prefixed with `/api/`.

### `GET /api/status`
**Description:** Returns current status of all targets (latest check per target)

**Response:**
```json
[
  {
    "id": 1,
    "name": "NIC India",
    "url": "https://www.nic.in",
    "hostname": "www.nic.in",
    "state": "Delhi",
    "enabled": 1,
    "ts": 1737849600,
    "ok": 1,
    "status": 200,
    "latency_ms": 245,
    "error": null
  }
]
```

**Caching:** KV cache with 60s TTL (`UPTIME_STATUS:latest`)

**Usage:** Frontend polls this endpoint every 30 seconds

---

### `GET /api/history?targetId=X&window=Y`
**Description:** Returns check history for a specific target within a time window

**Parameters:**
- `targetId` (required): Target ID
- `window` (optional): `24h` | `7d` | `30d` | `365d` (default: `24h`)

**Response:**
```json
{
  "stats": {
    "total_checks": 96,
    "successful_checks": 95,
    "uptime_percentage": 98.96,
    "avg_latency_ms": 234.5,
    "max_latency_ms": 456,
    "min_latency_ms": 123
  },
  "history": [
    {
      "ts": 1737849600,
      "ok": 1,
      "status": 200,
      "latency_ms": 245,
      "error": null
    }
  ]
}
```

**Query:** Uses `uptime_24h/7d/30d/365d` views + raw checks

---

### `GET /api/targets`
**Description:** Lists all monitored targets

**Response:**
```json
[
  {
    "id": 1,
    "name": "NIC India",
    "url": "https://www.nic.in",
    "hostname": "www.nic.in",
    "state": "Delhi",
    "interval_min": 15,
    "next_check_at": 1737850500,
    "enabled": 1,
    "check_mode": "website",
    "expected_status": 200,
    "allowed_status_codes": null,
    "json_path": null,
    "expected_json_value": null,
    "text_match": null
  }
]
```

---

### `POST /api/targets`
**Description:** Adds a new monitored target

**Request Body:**
```json
{
  "name": "Karnataka Government Portal",
  "url": "https://www.karnataka.gov.in",
  "state": "Karnataka",
  "interval_min": 15,
  "check_mode": "website",
  "expected_status": 200
}
```

**Validation:**
1. Domain must match government pattern
2. State must be valid Indian state/UT
3. Interval must be 5/10/15/30/60
4. Check mode must be `website` | `api-json` | `api-text`

**Response:**
```json
{
  "id": 123,
  "message": "Target added successfully"
}
```

---

### `DELETE /api/targets/:id`
**Description:** Removes a target and all associated checks (cascade delete)

**Response:**
```json
{
  "message": "Target deleted successfully"
}
```

---

### `GET /api/config`
**Description:** Returns global configuration

**Response:**
```json
{
  "id": 1,
  "interval_min": 15,
  "last_run_at": 1737849600,
  "created_at": 1737000000,
  "updated_at": 1737849600
}
```

---

### `PUT /api/config`
**Description:** Updates global configuration

**Request Body:**
```json
{
  "interval_min": 10
}
```

**Response:**
```json
{
  "message": "Config updated successfully"
}
```

---

### `POST /api/check`
**Description:** Triggers a manual check (bypasses cron schedule)

**Query Parameters:**
- `targetId` (optional): Check specific target, or all if omitted

**Response:**
```json
{
  "message": "Check completed",
  "processed": 25,
  "successful": 24,
  "failed": 1
}
```

**Behavior:**
- Processes up to 25 targets per batch
- Updates `next_check_at` timestamps
- Stores results in `checks` table
- Invalidates KV cache

---

### `GET /api/state-summary?window=Y`
**Description:** Returns state-level aggregation statistics

**Parameters:**
- `window` (optional): `24h` | `7d` | `30d` | `365d` (default: `24h`)

**Response:**
```json
[
  {
    "state": "Karnataka",
    "total_targets": 12,
    "total_checks": 1152,
    "successful_checks": 1140,
    "failed_checks": 12,
    "uptime_percentage": 98.96,
    "avg_latency_ms": 256.3
  }
]
```

**Caching:** KV cache with 300s (5 min) TTL (`STATE_SUMMARY:24h`)

**Usage:** Powers the StateDashboard component

---

## Check Modes

Three validation modes are supported (configured per target).

### 1. Website Mode (Default)

**Purpose:** Simple HTTP status validation

**Configuration:**
```json
{
  "check_mode": "website",
  "expected_status": 200,
  "allowed_status_codes": "[200,301,302]"  // Optional
}
```

**Check Logic:**
1. Send HTTP HEAD request (fallback to GET)
2. Check response status code
3. If `allowed_status_codes` is set: status must be in array
4. If not set: status must equal `expected_status`
5. Record latency

**Example:**
```typescript
const response = await fetch(url, {
  method: 'HEAD',
  headers: { 'User-Agent': env.USER_AGENT },
  signal: AbortSignal.timeout(parseInt(env.TIMEOUT_MS))
});

const ok = allowedCodes
  ? allowedCodes.includes(response.status)
  : response.status === expectedStatus;
```

**Use Cases:**
- Basic uptime monitoring
- Static government websites
- Simple availability checks

---

### 2. API JSON Mode

**Purpose:** Validates JSON API responses against expected path/value

**Configuration:**
```json
{
  "check_mode": "api-json",
  "json_path": "data.status",
  "expected_json_value": "operational",
  "expected_status": 200
}
```

**Check Logic:**
1. Send HTTP GET request
2. Validate status code (200 by default)
3. Parse response as JSON
4. Navigate to `json_path` using dot notation
5. Compare value to `expected_json_value` (strict equality)
6. Record validation details

**Example:**
```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'User-Agent': env.USER_AGENT,
    'Accept': 'application/json'
  }
});

const json = await response.json();
const value = getNestedValue(json, 'data.status');
const ok = value === 'operational';
```

**Supported JSON Paths:**
- Simple: `status`
- Nested: `data.health.status`
- Array access: `results[0].status` (if implemented)

**Use Cases:**
- Government API health checks
- JSON-based status endpoints
- Structured response validation

---

### 3. API Text Mode

**Purpose:** Searches for substring in response body (HTML/text)

**Configuration:**
```json
{
  "check_mode": "api-text",
  "text_match": "Service Available",
  "expected_status": 200
}
```

**Check Logic:**
1. Send HTTP GET request
2. Validate status code
3. Read response as text
4. Check if `text_match` substring exists (case-sensitive)
5. Record validation details

**Example:**
```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: { 'User-Agent': env.USER_AGENT }
});

const text = await response.text();
const ok = text.includes('Service Available');
```

**Use Cases:**
- HTML page content validation
- Legacy government portals without APIs
- Specific message checks ("Login Successful")

---

### Validation Details Storage

All checks store mode-specific details in `checks.validation_details` (JSON):

**Website Mode:**
```json
{
  "mode": "website",
  "expected_status": 200,
  "actual_status": 200
}
```

**API JSON Mode:**
```json
{
  "mode": "api-json",
  "json_path": "data.status",
  "expected_value": "operational",
  "actual_value": "operational",
  "matched": true
}
```

**API Text Mode:**
```json
{
  "mode": "api-text",
  "text_match": "Service Available",
  "found": true
}
```

---

## Caching Strategy

### KV Cache Keys

#### `UPTIME_STATUS:latest`
**Purpose:** Latest status for all targets (powers main dashboard)

**TTL:** 60 seconds

**Structure:**
```json
[
  {
    "id": 1,
    "name": "NIC India",
    "url": "https://www.nic.in",
    "ts": 1737849600,
    "ok": 1,
    "status": 200,
    "latency_ms": 245
  }
]
```

**Update Trigger:** Every cron run (after processing batch)

**Fallback:** Query `latest_status` view from D1

---

#### `STATE_SUMMARY:{window}`
**Purpose:** Pre-computed state aggregations

**Keys:**
- `STATE_SUMMARY:24h`
- `STATE_SUMMARY:7d`
- `STATE_SUMMARY:30d`
- `STATE_SUMMARY:365d`

**TTL:** 300 seconds (5 minutes)

**Structure:**
```json
[
  {
    "state": "Karnataka",
    "total_targets": 12,
    "total_checks": 1152,
    "successful_checks": 1140,
    "uptime_percentage": 98.96,
    "avg_latency_ms": 256.3
  }
]
```

**Update Trigger:** On-demand (when `GET /api/state-summary` cache misses)

**Fallback:** Query `state_uptime_{window}` view from D1

---

### Performance Optimizations

#### Batch Processing
- **Batch size:** 25 targets per cron run
- **Why:** Prevents Worker timeout on large target lists
- **Logic:** Query `WHERE next_check_at <= now() AND enabled = 1 LIMIT 25`

#### Backfill Mechanism
- **Purpose:** Catch up on missed checks if cron skips a cycle
- **Logic:** If `target.next_check_at` is significantly behind, schedule immediate check
- **Example:** Target with 5-min interval missed 3 cycles → gets checked on next run

#### D1 Views for Pre-Aggregation
- Views like `uptime_24h` pre-compute expensive calculations
- Avoids re-computing uptime percentages on every API call
- Trade-off: Slightly stale data (updated on next check)

#### Conditional Cache Updates
- Only update KV if data actually changed
- Reduces KV write operations
- Checks if new status differs from previous before writing

---

### Cache Invalidation

**When is cache invalidated?**

1. **After cron run:** `UPTIME_STATUS:latest` updated
2. **On manual check:** `POST /api/check` invalidates status cache
3. **On target update:** Modifying target settings doesn't invalidate (waits for next check)
4. **On target delete:** Cascade delete removes checks, next cron run updates cache
5. **TTL expiry:** Automatic expiration (60s for status, 300s for state summary)

**No cache invalidation on:**
- `GET` requests (read-only)
- Config updates (doesn't affect current status)

---

## Frontend Architecture

### Component Structure

```
App.tsx (Main Router)
├── LandingPage.tsx (Marketing page)
├── Dashboard View
│   ├── AddTargetDialog.tsx (Add new target form)
│   └── StatusCard.tsx × N (Grid of target cards)
│       └── MiniChart (Recharts area chart)
├── StateDashboard.tsx
│   ├── IndiaMapOptimized.tsx (SVG map)
│   │   └── State paths with hover tooltips
│   └── StateTable (Sortable statistics table)
└── TargetDetail.tsx
    ├── Time window selector (24h/7d/30d/365d)
    ├── Uptime chart (Recharts line chart)
    └── Check history table
```

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│  App.tsx (Root Component)                           │
│  - useState for targets, status, time window        │
│  - useEffect: Poll /api/status every 30s            │
│  - useEffect: Fetch /api/targets on mount           │
└─────────────────────────────────────────────────────┘
                      │
                      ├── Prop drilling: targets, status
                      │
    ┌─────────────────┴─────────────────┐
    │                                    │
┌───▼──────────────────┐      ┌─────────▼──────────────┐
│  Dashboard View      │      │  StateDashboard        │
│  - Maps status to    │      │  - Fetches state       │
│    StatusCard[]      │      │    summary on mount    │
│  - Shows grid layout │      │  - Computes uptime     │
└──────────────────────┘      │    color coding        │
                              │  - Renders map + table │
                              └────────────────────────┘
```

### State Management

**No external state library** (Redux/Zustand/etc.) - uses React `useState`:

```typescript
// App.tsx
const [targets, setTargets] = useState<Target[]>([]);
const [status, setStatus] = useState<Status[]>([]);
const [timeWindow, setTimeWindow] = useState<'24h' | '7d' | '30d' | '365d'>('24h');

// Auto-refresh every 30 seconds
useEffect(() => {
  const interval = setInterval(fetchStatus, 30000);
  return () => clearInterval(interval);
}, []);
```

### Key Components

#### `StatusCard.tsx`
**Purpose:** Displays individual target status with mini-chart

**Props:**
```typescript
interface StatusCardProps {
  target: Target;
  status: Status | null;
  onDelete: (id: number) => void;
}
```

**Features:**
- Color-coded border (green=up, red=down, gray=unknown)
- Latency display with badge
- Last check timestamp (relative time via date-fns)
- Mini area chart (last 10 checks)
- Delete button with confirmation

---

#### `StateDashboard.tsx`
**Purpose:** State-level visualization with map and table

**Features:**
- Interactive India map (hover shows uptime %)
- Color gradient: Green (>95%) → Yellow (90-95%) → Red (<90%)
- Sortable table (by state, targets, uptime, latency)
- Time window selector (24h/7d/30d/365d)

**Map Interaction:**
```typescript
<path
  d={statePath}
  fill={getUptimeColor(uptime)}
  onMouseEnter={() => setHoveredState(stateName)}
  onMouseLeave={() => setHoveredState(null)}
/>
```

---

#### `IndiaMapOptimized.tsx`
**Purpose:** SVG map of India with pre-computed paths

**Data Source:** `frontend/src/data/indiaSvgPaths.ts` (generated from GeoJSON)

**Optimization:**
- Pre-computed SVG paths (no runtime GeoJSON parsing)
- Optimized path simplification (Douglas-Peucker algorithm)
- Reduced file size (~500KB → ~150KB)

**Regeneration:**
```bash
npm run generate:svg
# Reads: frontend/src/assets/india_state.geojson
# Writes: frontend/src/data/indiaSvgPaths.ts
```

---

#### `TargetDetail.tsx`
**Purpose:** Detailed analytics for a single target

**Features:**
- Time window selector (24h/7d/30d/365d)
- Uptime percentage (large display)
- Latency statistics (avg/min/max)
- Line chart (uptime over time)
- Check history table with error messages

**Data Fetching:**
```typescript
useEffect(() => {
  fetch(`/api/history?targetId=${id}&window=${timeWindow}`)
    .then(res => res.json())
    .then(data => {
      setStats(data.stats);
      setHistory(data.history);
    });
}, [id, timeWindow]);
```

---

#### `AddTargetDialog.tsx`
**Purpose:** Form for adding new monitored targets

**Validation:**
1. URL format (must be valid URL)
2. Domain validation (government domains only)
3. State selection (dropdown with 36 options)
4. Interval selection (5/10/15/30/60 minutes)
5. Check mode selection (website/api-json/api-text)

**Dynamic Fields:**
- Website mode: `expected_status`, `allowed_status_codes`
- API JSON mode: `json_path`, `expected_json_value`
- API Text mode: `text_match`

---

### Styling System

#### Tailwind Configuration
```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: '#001f3f',    // Navy blue
      secondary: '#FF851B',  // Orange
      success: '#2ECC40',    // Green
      danger: '#FF4136',     // Red
      warning: '#FFDC00',    // Yellow
    }
  }
}
```

#### shadcn/ui Components
- `Button` - Primary actions (add target, delete, etc.)
- `Card` - Container for StatusCard, sections
- `Dialog` - Modal for AddTargetDialog
- `Select` - Dropdowns (state, interval, check mode)
- `Input` - Text fields (name, URL, JSON path)
- `Badge` - Status indicators (latency, uptime)
- `Table` - History and state statistics tables

#### Responsive Design
```typescript
// Mobile-first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* StatusCard grid */}
</div>
```

---

### API Integration

**Base URL:**
- Development: `http://localhost:8787/api` (proxied by Vite)
- Production: `https://govmonitor-worker.workers.dev/api` (or custom domain)

**Fetch Wrapper:**
```typescript
async function apiRequest(endpoint: string, options = {}) {
  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}
```

---

## Testing Guidelines

### Unit Tests (`test/worker.test.ts`)

**Testing Framework:** Vitest with `@cloudflare/vitest-pool-workers`

**Test Environment:**
```typescript
import { env, createExecutionContext } from 'cloudflare:test';
import worker from '../src/worker';

describe('Worker API', () => {
  it('should return status', async () => {
    const request = new Request('http://localhost/api/status');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### Running Tests

```bash
# All tests
npm run test

# Watch mode (auto-run on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npm run test -- worker.test.ts
```

### Test Coverage Focus

#### 1. Domain Validation
```typescript
it('should reject non-government domains', async () => {
  const response = await fetch('/api/targets', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Example',
      url: 'https://example.com',  // Not a .gov domain
      state: 'Delhi'
    })
  });

  expect(response.status).toBe(400);
});
```

#### 2. Check Mode Implementations
```typescript
it('should validate JSON path correctly', async () => {
  const target = {
    check_mode: 'api-json',
    json_path: 'data.status',
    expected_json_value: 'ok'
  };

  const result = await checkTarget(target, mockDb, env);
  expect(result.ok).toBe(true);
});
```

#### 3. Caching Behavior
```typescript
it('should cache status in KV', async () => {
  await fetch('/api/check', { method: 'POST' });

  const cached = await env.KV.get('UPTIME_STATUS:latest', 'json');
  expect(cached).toBeTruthy();
  expect(Array.isArray(cached)).toBe(true);
});
```

#### 4. Cron Scheduling Logic
```typescript
it('should update next_check_at correctly', async () => {
  const target = { id: 1, interval_min: 15 };
  await performCheck(target, mockDb, env);

  const updated = await db.prepare('SELECT next_check_at FROM targets WHERE id = ?')
    .bind(1).first();

  const expectedNextCheck = Math.floor(Date.now() / 1000) + (15 * 60);
  expect(updated.next_check_at).toBeCloseTo(expectedNextCheck, -2);
});
```

### Mocking D1 and KV

```typescript
// Mock D1 database
const mockDb = {
  prepare: (sql: string) => ({
    bind: (...params: any[]) => ({
      first: async () => ({ id: 1, name: 'Test' }),
      all: async () => ({ results: [{ id: 1 }] }),
      run: async () => ({ success: true })
    })
  })
};

// Mock KV namespace
const mockKV = {
  get: async (key: string, type: 'json' | 'text') => null,
  put: async (key: string, value: string, options?: any) => undefined
};
```

---

## Common Tasks

### Adding a New Check Mode

#### 1. Update Database Schema
Create migration: `migrations/003_add_new_mode.sql`
```sql
ALTER TABLE targets ADD COLUMN new_mode_field TEXT;
```

#### 2. Update Worker Logic
Edit `src/worker.ts`:
```typescript
async function checkTarget(target: Target, db: D1Database, env: Env) {
  // ... existing modes

  if (target.check_mode === 'new-mode') {
    const response = await fetch(target.url);
    const result = await customValidation(response, target);

    return {
      ok: result.isValid,
      status: response.status,
      latency_ms: result.latency,
      validation_details: JSON.stringify(result.details)
    };
  }
}
```

#### 3. Update Frontend Form
Edit `frontend/src/components/AddTargetDialog.tsx`:
```typescript
{checkMode === 'new-mode' && (
  <Input
    label="New Mode Field"
    value={newModeField}
    onChange={(e) => setNewModeField(e.target.value)}
  />
)}
```

#### 4. Add Tests
```typescript
it('should validate new-mode correctly', async () => {
  const target = { check_mode: 'new-mode', new_mode_field: 'value' };
  const result = await checkTarget(target, mockDb, env);
  expect(result.ok).toBe(true);
});
```

---

### Adding a New State

#### 1. Update State List
Edit state constants in both worker and frontend:
```typescript
// src/worker.ts and frontend/src/components/AddTargetDialog.tsx
const INDIAN_STATES = [
  // ... existing states
  'New State Name'
];
```

#### 2. Update SVG Map
Edit `frontend/src/assets/india_state.geojson`:
- Add GeoJSON geometry for new state
- Ensure `properties.NAME_1` matches state name exactly

#### 3. Regenerate SVG Paths
```bash
npm run generate:svg
```

#### 4. Test State Selection
- Verify dropdown includes new state
- Test adding target with new state
- Check state dashboard displays correctly

---

### Modifying Cron Intervals

#### 1. Update `wrangler.toml`
```toml
[triggers]
crons = [
    "*/5 * * * *",
    "*/10 * * * *",
    "*/15 * * * *",
    "*/30 * * * *",
    "0 * * * *",
    "*/2 * * * *"   # NEW: Every 2 minutes
]
```

#### 2. Update Frontend Interval Selector
Edit `AddTargetDialog.tsx`:
```typescript
const INTERVALS = [2, 5, 10, 15, 30, 60];

<Select>
  {INTERVALS.map(interval => (
    <option value={interval}>{interval} minutes</option>
  ))}
</Select>
```

#### 3. Update Validation
Ensure worker accepts new interval:
```typescript
if (![2, 5, 10, 15, 30, 60].includes(interval_min)) {
  return new Response('Invalid interval', { status: 400 });
}
```

#### 4. Deploy and Test
```bash
npm run deploy
# Verify cron triggers in Cloudflare dashboard
```

---

### Performance Optimization

#### 1. Analyze D1 Query Performance
```bash
# Enable query logging in worker
console.log('Query time:', performance.now() - startTime);

# Check query plans (local dev)
wrangler d1 execute govmonitor-db --local --command="EXPLAIN QUERY PLAN SELECT ..."
```

#### 2. Add Indexes
```sql
-- Example: Optimize state + date queries
CREATE INDEX idx_custom ON checks(state, ts DESC);
```

#### 3. Review KV Cache Hit Rates
```typescript
// Add logging in worker
const cached = await env.KV.get('UPTIME_STATUS:latest');
console.log('Cache hit:', cached !== null);
```

#### 4. Optimize View Definitions
```sql
-- Example: Add materialized view alternative
CREATE TABLE uptime_24h_materialized AS
SELECT * FROM uptime_24h;

-- Update via cron trigger
```

#### 5. Adjust Batch Size
```typescript
// In scheduled() handler
const BATCH_SIZE = 50; // Increase from 25 if Worker handles it
const targets = await db.prepare(`
  SELECT * FROM targets
  WHERE next_check_at <= ? AND enabled = 1
  LIMIT ?
`).bind(nowUnix, BATCH_SIZE).all();
```

---

### Debugging Failed Checks

#### 1. Check Error Messages
```sql
SELECT target_id, ts, error, status
FROM checks
WHERE ok = 0
ORDER BY ts DESC
LIMIT 20;
```

#### 2. Review Validation Details
```sql
SELECT target_id, validation_details
FROM checks
WHERE ok = 0 AND validation_details IS NOT NULL;
```

#### 3. Test Check Manually
```bash
# Trigger check for specific target
curl -X POST http://localhost:8787/api/check?targetId=123

# Check Worker logs
wrangler tail
```

#### 4. Verify Target Configuration
```sql
SELECT * FROM targets WHERE id = 123;
-- Check: check_mode, expected_status, json_path, text_match
```

---

## Important Constraints

### Domain Enforcement
**CRITICAL:** Only government domains allowed

**Enforcement Layers:**
1. **Database:** CHECK constraint on `targets.hostname`
2. **Worker:** Validation in `POST /api/targets`
3. **Frontend:** Pattern matching in `AddTargetDialog.tsx`

**Bypass Attempts:**
- Direct database inserts will fail (CHECK constraint)
- API bypasses will be rejected (400 Bad Request)
- Frontend validation prevents submission

---

### Singleton Config
**Only one config row allowed** (`id = 1`)

**Constraint:**
```sql
CHECK (id = 1)
```

**Implications:**
- Cannot insert `id = 2` (constraint violation)
- Cannot delete row 1 (breaks app)
- Update row 1 to change global settings

---

### State Validation
**Every target must have a valid Indian state/UT**

**36 Valid States:**
```typescript
const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];
```

**No database constraint** (soft validation in worker and frontend)

---

### Interval Limits
**Only 5 specific intervals supported:** 5, 10, 15, 30, 60 minutes

**Reason:** Cron triggers are pre-configured in `wrangler.toml`

**Adding new interval requires:**
1. Update `wrangler.toml` cron triggers
2. Redeploy worker
3. Update frontend dropdown
4. Update validation logic

---

### Timeout Constraints
**Environment Variables:**
- `TIMEOUT_MS`: 5000 (5 seconds)
- `MAX_LATENCY_MS`: 10000 (10 seconds)

**Implications:**
- Checks exceeding 5s timeout will fail
- Latency > 10s treated as degraded performance
- Frontend displays timeout errors

**Adjusting Timeouts:**
```toml
# wrangler.toml
[vars]
TIMEOUT_MS = "10000"  # Increase to 10s
MAX_LATENCY_MS = "15000"
```

---

### User Agent
**Required for all HTTP requests:**
```
GovMonitorBot/1.0 (+https://govmonitor.org)
```

**Purpose:**
- Identify bot traffic to government servers
- Comply with robots.txt and rate limiting
- Provide contact URL for administrators

**DO NOT change** without coordination with monitored sites

---

## Deployment Notes

### Worker Deployment

#### Prerequisites
1. **D1 Database**
   ```bash
   wrangler d1 create govmonitor-db
   # Copy database_id to wrangler.toml
   ```

2. **KV Namespace**
   ```bash
   wrangler kv:namespace create "GOVMONITOR_KV"
   # Copy id to wrangler.toml
   ```

3. **Run Migrations**
   ```bash
   wrangler d1 execute govmonitor-db --file=schema.sql
   wrangler d1 execute govmonitor-db --file=migrations/001_add_check_modes.sql
   wrangler d1 execute govmonitor-db --file=migrations/002_state_aggregation.sql
   ```

#### Deploy
```bash
npm run build   # TypeScript compilation
npm run deploy  # Deploys to Cloudflare Workers
```

#### Verify Deployment
```bash
# Check cron triggers are active
wrangler deployments list

# Tail logs
wrangler tail

# Test API endpoint
curl https://govmonitor-worker.<your-subdomain>.workers.dev/api/status
```

---

### Frontend Deployment

#### Build
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

#### Deploy to Cloudflare Pages
```bash
npm run frontend:deploy

# Or manually via Wrangler
wrangler pages deploy frontend/dist --project-name=govmonitor-frontend
```

#### Configure Environment
- **Production API URL:** Set `VITE_API_URL` in Pages environment variables
- **Example:** `https://govmonitor-worker.<subdomain>.workers.dev/api`

#### Custom Domain (Optional)
1. Add custom domain in Cloudflare Pages dashboard
2. Update DNS records (CNAME to Pages deployment)
3. Enable SSL (automatic via Cloudflare)

---

### Database Migrations

#### Local Development
```bash
npm run db:migrate:local

# Or manually
wrangler d1 execute govmonitor-db --local --file=schema.sql
wrangler d1 execute govmonitor-db --local --file=migrations/001_add_check_modes.sql
```

#### Production
```bash
wrangler d1 execute govmonitor-db --file=schema.sql
wrangler d1 execute govmonitor-db --file=migrations/001_add_check_modes.sql
wrangler d1 execute govmonitor-db --file=migrations/002_state_aggregation.sql
```

**IMPORTANT:** Always test migrations in local/staging before production

---

### Cron Trigger Activation

**Automatic:** Cron triggers activate on deployment

**Verify:**
1. Check Cloudflare dashboard → Workers → govmonitor-worker → Triggers
2. Should see 5 cron triggers (5/10/15/30/60 min)
3. Monitor logs with `wrangler tail`

**Manual Trigger (Testing):**
```bash
curl -X POST https://govmonitor-worker.<subdomain>.workers.dev/api/check
```

---

### Rollback Strategy

#### Worker Rollback
```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback <deployment-id>
```

#### Database Rollback
**NO AUTOMATIC ROLLBACK** - Migrations are one-way

**Manual Rollback:**
1. Create reverse migration SQL
2. Test in local environment
3. Execute in production with caution

**Example Reverse Migration:**
```sql
-- Reverse 001_add_check_modes.sql
ALTER TABLE targets DROP COLUMN check_mode;
ALTER TABLE targets DROP COLUMN expected_status;
-- etc.
```

---

## Troubleshooting

### Common Issues

#### 1. Domain Validation Failures
**Symptom:** `POST /api/targets` returns 400 "Only government domains allowed"

**Causes:**
- Hostname doesn't match `.gov` / `.gov.*` / `.gc.ca` / `.government.*`
- Subdomain confusion (e.g., `gov.example.com` is NOT valid)

**Solution:**
```typescript
// Validate hostname format
const url = new URL('https://example.gov.in');
const hostname = url.hostname; // "example.gov.in"

// Valid: example.gov.in, www.gov.in, portal.gc.ca
// Invalid: gov.example.com, example.com
```

---

#### 2. KV Cache Stale
**Symptom:** Dashboard shows outdated status (not reflecting recent checks)

**Causes:**
- Cache TTL not expired (60s for status, 300s for state summary)
- Worker didn't update cache after check

**Solution:**
- Wait for TTL expiry (60s for status)
- Trigger manual check: `POST /api/check`
- Check Worker logs for cache update errors

**Debug:**
```bash
wrangler tail
# Look for: "Updated KV cache: UPTIME_STATUS:latest"
```

---

#### 3. Cron Not Triggering
**Symptom:** No automatic checks happening

**Causes:**
- Cron triggers not configured in `wrangler.toml`
- Worker not deployed (crons only work on deployed workers, not `wrangler dev`)
- Syntax error in cron expression

**Solution:**
1. Verify `wrangler.toml`:
   ```toml
   [triggers]
   crons = [
       "*/5 * * * *",
       "*/10 * * * *",
       "*/15 * * * *",
       "*/30 * * * *",
       "0 * * * *"
   ]
   ```

2. Deploy worker: `npm run deploy`

3. Check Cloudflare dashboard → Workers → Triggers

**Testing:**
```bash
# Crons don't work in local dev
# Use manual trigger instead
curl -X POST http://localhost:8787/api/check
```

---

#### 4. D1 Query Slow
**Symptom:** API endpoints timeout or take >1s

**Causes:**
- Missing indexes
- Inefficient view definitions
- Large result sets without LIMIT

**Solution:**

1. **Check query plan:**
   ```bash
   wrangler d1 execute govmonitor-db --local --command="EXPLAIN QUERY PLAN SELECT * FROM uptime_24h"
   ```

2. **Add indexes:**
   ```sql
   CREATE INDEX idx_checks_state_ts ON checks(state, ts DESC);
   ```

3. **Optimize views:**
   ```sql
   -- Add WHERE clause to reduce scan
   CREATE VIEW uptime_24h AS
   SELECT ...
   FROM checks
   WHERE ts >= unixepoch() - 86400  -- Index on ts
   GROUP BY target_id;
   ```

4. **Use LIMIT:**
   ```sql
   SELECT * FROM checks ORDER BY ts DESC LIMIT 100;
   ```

---

#### 5. Frontend API Proxy Not Working
**Symptom:** Frontend can't connect to Worker in local dev

**Causes:**
- Worker not running (`npm run dev`)
- Vite proxy misconfigured
- CORS issues

**Solution:**

1. **Verify Worker is running:**
   ```bash
   curl http://localhost:8787/api/status
   # Should return JSON array
   ```

2. **Check Vite proxy config** (`frontend/vite.config.ts`):
   ```typescript
   export default defineConfig({
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:8787',
           changeOrigin: true
         }
       }
     }
   });
   ```

3. **Enable CORS in Worker** (if needed):
   ```typescript
   return new Response(JSON.stringify(data), {
     headers: {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*'
     }
   });
   ```

---

#### 6. SVG Map Not Rendering
**Symptom:** India map appears blank or distorted

**Causes:**
- Missing or corrupted `indiaSvgPaths.ts`
- GeoJSON changes not regenerated
- SVG path syntax errors

**Solution:**

1. **Regenerate SVG paths:**
   ```bash
   npm run generate:svg
   ```

2. **Check GeoJSON validity:**
   ```bash
   # Validate GeoJSON
   npx geojsonhint frontend/src/assets/india_state.geojson
   ```

3. **Verify paths file exists:**
   ```bash
   ls -lh frontend/src/data/indiaSvgPaths.ts
   # Should be ~150KB
   ```

---

#### 7. Check Failures with 0ms Latency
**Symptom:** Checks marked as failed with `latency_ms = null` or 0

**Causes:**
- Network timeout (5s default)
- DNS resolution failure
- Target server unreachable
- SSL/TLS certificate errors

**Solution:**

1. **Check error messages:**
   ```sql
   SELECT target_id, error FROM checks WHERE ok = 0 ORDER BY ts DESC LIMIT 10;
   ```

2. **Test target manually:**
   ```bash
   curl -I https://target-url.gov.in
   # Check if accessible
   ```

3. **Increase timeout** (if needed):
   ```toml
   # wrangler.toml
   [vars]
   TIMEOUT_MS = "10000"  # 10 seconds
   ```

4. **Review validation settings:**
   ```sql
   SELECT check_mode, expected_status, json_path, text_match
   FROM targets
   WHERE id = ?;
   ```

---

### Debugging Tools

#### 1. Worker Logs
```bash
wrangler tail
# Real-time logs from deployed worker

wrangler tail --format pretty
# Formatted output
```

#### 2. D1 Console
```bash
# Local database
wrangler d1 execute govmonitor-db --local --command="SELECT * FROM targets LIMIT 5"

# Production database
wrangler d1 execute govmonitor-db --command="SELECT * FROM targets LIMIT 5"
```

#### 3. KV Namespace Viewer
```bash
# List keys
wrangler kv:key list --namespace-id=<YOUR_KV_ID>

# Get value
wrangler kv:key get "UPTIME_STATUS:latest" --namespace-id=<YOUR_KV_ID>
```

#### 4. Browser DevTools
- **Network tab:** Monitor API requests (timing, status codes)
- **Console:** Check for React errors and API response logs
- **React DevTools:** Inspect component state and props

---

## Additional Resources

### Documentation
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **D1 Database:** https://developers.cloudflare.com/d1/
- **KV Storage:** https://developers.cloudflare.com/kv/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/

### Related Files
- **QUICK_START.md** - Getting started guide
- **README.md** - Project overview
- **schema.sql** - Database schema reference
- **migrations/** - Database migration history

### Contact
- **Project:** GovMonitor.Org
- **Repository:** (Add GitHub URL if applicable)
- **Issues:** (Add issue tracker URL)

---

**Last Updated:** January 26, 2026
**Version:** 1.0
**Maintained by:** GovMonitor.Org Team
