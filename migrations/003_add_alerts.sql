-- Migration: Add Alert Notification System
-- Description: Adds tables for alert configuration, history, and channels
-- Created: 2026-01-26

-- Alert configuration per target
CREATE TABLE IF NOT EXISTS alert_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    downtime_alerts INTEGER NOT NULL DEFAULT 1,
    recovery_alerts INTEGER NOT NULL DEFAULT 1,
    latency_threshold_ms INTEGER DEFAULT 2000,
    latency_alerts INTEGER NOT NULL DEFAULT 1,
    consecutive_failures_threshold INTEGER DEFAULT 3,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

-- Global alert configuration
CREATE TABLE IF NOT EXISTS alert_global_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    state_outage_threshold REAL DEFAULT 0.5, -- 50% targets down
    state_outage_alerts INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Alert history (log all triggered alerts)
CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('downtime', 'recovery', 'latency', 'consecutive_failures', 'state_outage')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    metadata TEXT, -- JSON with additional context
    check_id INTEGER, -- Reference to checks table
    dispatched INTEGER NOT NULL DEFAULT 0, -- 0 = pending, 1 = dispatched
    dispatched_at INTEGER,
    channels TEXT, -- JSON array of channels used: ["webhook", "email"]
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
    FOREIGN KEY (check_id) REFERENCES checks(id) ON DELETE SET NULL
);

-- Alert channels (webhook URLs, email configs)
CREATE TABLE IF NOT EXISTS alert_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'email')),
    enabled INTEGER NOT NULL DEFAULT 1,
    config TEXT NOT NULL, -- JSON config: {"url": "...", "headers": {...}}
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_configs_target ON alert_configs(target_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_target ON alert_history(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_type ON alert_history(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_history_dispatched ON alert_history(dispatched, created_at);
CREATE INDEX IF NOT EXISTS idx_alert_channels_enabled ON alert_channels(enabled);

-- Insert default global config
INSERT OR IGNORE INTO alert_global_config (id, state_outage_threshold, state_outage_alerts, created_at, updated_at)
VALUES (1, 0.5, 1, unixepoch(), unixepoch());

-- Create default alert configs for existing targets
INSERT OR IGNORE INTO alert_configs (target_id, enabled, downtime_alerts, recovery_alerts, latency_threshold_ms, latency_alerts, consecutive_failures_threshold, created_at, updated_at)
SELECT id, 1, 1, 1, 2000, 1, 3, unixepoch(), unixepoch()
FROM targets
WHERE id NOT IN (SELECT target_id FROM alert_configs WHERE target_id IS NOT NULL);
