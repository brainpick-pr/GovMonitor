-- Migration: State aggregation and statistics tables
-- Date: 2025-10-13
-- Description: Creates tables and views for state-level aggregation and time-window statistics

-- Create state daily statistics table for caching aggregates
CREATE TABLE IF NOT EXISTS state_daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state TEXT NOT NULL,
    date TEXT NOT NULL, -- ISO date string (YYYY-MM-DD)
    total_targets INTEGER NOT NULL DEFAULT 0,
    total_checks INTEGER NOT NULL DEFAULT 0,
    successful_checks INTEGER NOT NULL DEFAULT 0,
    failed_checks INTEGER NOT NULL DEFAULT 0,
    uptime_percentage REAL NOT NULL DEFAULT 0.0,
    avg_latency_ms REAL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(state, date)
);

CREATE INDEX IF NOT EXISTS idx_state_daily_stats_state_date ON state_daily_stats(state, date DESC);

-- View for per-state uptime (last 24 hours)
CREATE VIEW IF NOT EXISTS state_uptime_24h AS
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

-- View for per-state uptime (last 7 days)
CREATE VIEW IF NOT EXISTS state_uptime_7d AS
SELECT
    t.state,
    COUNT(DISTINCT t.id) as total_targets,
    COUNT(c.id) as total_checks,
    SUM(CASE WHEN c.ok = 1 THEN 1 ELSE 0 END) as successful_checks,
    SUM(CASE WHEN c.ok = 0 THEN 1 ELSE 0 END) as failed_checks,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN 100.0 ELSE 0.0 END), 2) as uptime_percentage,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN c.latency_ms END), 2) as avg_latency_ms
FROM targets t
LEFT JOIN checks c ON t.id = c.target_id AND c.ts >= unixepoch() - 604800
WHERE t.enabled = 1
GROUP BY t.state;

-- View for per-state uptime (last 30 days)
CREATE VIEW IF NOT EXISTS state_uptime_30d AS
SELECT
    t.state,
    COUNT(DISTINCT t.id) as total_targets,
    COUNT(c.id) as total_checks,
    SUM(CASE WHEN c.ok = 1 THEN 1 ELSE 0 END) as successful_checks,
    SUM(CASE WHEN c.ok = 0 THEN 1 ELSE 0 END) as failed_checks,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN 100.0 ELSE 0.0 END), 2) as uptime_percentage,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN c.latency_ms END), 2) as avg_latency_ms
FROM targets t
LEFT JOIN checks c ON t.id = c.target_id AND c.ts >= unixepoch() - 2592000
WHERE t.enabled = 1
GROUP BY t.state;

-- View for per-state uptime (last 365 days)
CREATE VIEW IF NOT EXISTS state_uptime_365d AS
SELECT
    t.state,
    COUNT(DISTINCT t.id) as total_targets,
    COUNT(c.id) as total_checks,
    SUM(CASE WHEN c.ok = 1 THEN 1 ELSE 0 END) as successful_checks,
    SUM(CASE WHEN c.ok = 0 THEN 1 ELSE 0 END) as failed_checks,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN 100.0 ELSE 0.0 END), 2) as uptime_percentage,
    ROUND(AVG(CASE WHEN c.ok = 1 THEN c.latency_ms END), 2) as avg_latency_ms
FROM targets t
LEFT JOIN checks c ON t.id = c.target_id AND c.ts >= unixepoch() - 31536000
WHERE t.enabled = 1
GROUP BY t.state;
