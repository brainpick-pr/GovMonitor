-- GovMonitor.Org D1 Database Schema
-- This schema supports uptime monitoring for government websites

-- Configuration table (global settings)
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one row
    interval_min INTEGER NOT NULL DEFAULT 15, -- Default check interval in minutes
    last_run_at INTEGER, -- Unix timestamp of last cron run
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Insert default config
INSERT OR IGNORE INTO config (id, interval_min) VALUES (1, 15);

-- Monitored targets (government websites)
CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, -- Display name (e.g., "White House")
    url TEXT NOT NULL UNIQUE, -- Full URL to monitor
    hostname TEXT NOT NULL, -- Extracted hostname for display
    state TEXT NOT NULL, -- Indian state or union territory
    interval_min INTEGER NOT NULL DEFAULT 15, -- Per-target interval override
    next_check_at INTEGER NOT NULL DEFAULT 0, -- Unix timestamp for next check
    enabled INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = disabled
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (
        hostname LIKE '%.gov' OR
        hostname LIKE '%.gov.%' OR
        hostname LIKE '%.gc.ca' OR
        hostname LIKE '%.government.%' OR
        hostname LIKE '%.nic.in'
    )
);

-- Index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_targets_next_check
ON targets(next_check_at, enabled) WHERE enabled = 1;

-- Check history (uptime monitoring results)
CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    ts INTEGER NOT NULL, -- Unix timestamp of check
    ok INTEGER NOT NULL, -- 1 = up, 0 = down
    status INTEGER, -- HTTP status code (200, 404, 500, etc.)
    latency_ms INTEGER, -- Response time in milliseconds
    error TEXT, -- Error message if check failed
    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_checks_target_ts
ON checks(target_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_checks_ts
ON checks(ts DESC);

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_checks_ok
ON checks(ok);

CREATE INDEX IF NOT EXISTS idx_targets_state
ON targets(state) WHERE state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_targets_enabled_state
ON targets(enabled, state) WHERE enabled = 1;

-- View for latest status (most recent check per target)
-- Optimized with window functions for better performance
CREATE VIEW IF NOT EXISTS latest_status AS
WITH ranked_checks AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (PARTITION BY c.target_id ORDER BY c.ts DESC) as rn
  FROM checks c
)
SELECT
  t.id,
  t.name,
  t.url,
  t.hostname,
  t.state,
  t.enabled,
  rc.ts,
  rc.ok,
  rc.status,
  rc.latency_ms,
  rc.error
FROM targets t
LEFT JOIN ranked_checks rc ON t.id = rc.target_id AND rc.rn = 1;

-- View for uptime statistics (24h)
CREATE VIEW IF NOT EXISTS uptime_24h AS
SELECT
    target_id,
    COUNT(*) as total_checks,
    SUM(ok) as successful_checks,
    ROUND(AVG(CASE WHEN ok = 1 THEN 100.0 ELSE 0.0 END), 2) as uptime_percentage,
    AVG(CASE WHEN ok = 1 THEN latency_ms END) as avg_latency_ms,
    MAX(CASE WHEN ok = 1 THEN latency_ms END) as max_latency_ms,
    MIN(CASE WHEN ok = 1 THEN latency_ms END) as min_latency_ms
FROM checks
WHERE ts >= unixepoch() - 86400 -- Last 24 hours
GROUP BY target_id;

-- View for uptime statistics (7d)
CREATE VIEW IF NOT EXISTS uptime_7d AS
SELECT
    target_id,
    COUNT(*) as total_checks,
    SUM(ok) as successful_checks,
    ROUND(AVG(CASE WHEN ok = 1 THEN 100.0 ELSE 0.0 END), 2) as uptime_percentage,
    AVG(CASE WHEN ok = 1 THEN latency_ms END) as avg_latency_ms,
    MAX(CASE WHEN ok = 1 THEN latency_ms END) as max_latency_ms,
    MIN(CASE WHEN ok = 1 THEN latency_ms END) as min_latency_ms
FROM checks
WHERE ts >= unixepoch() - 604800 -- Last 7 days
GROUP BY target_id;
