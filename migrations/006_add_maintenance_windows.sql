-- Migration 006: Add Maintenance Windows
-- Purpose: Configurable maintenance periods to suppress checks and alerts
-- Date: 2026-01-26

-- Maintenance window configurations
CREATE TABLE maintenance_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,

    -- Targeting
    target_id INTEGER,  -- NULL = global (all targets)
    state TEXT,         -- NULL = all states, or specific state

    -- Schedule
    start_time INTEGER NOT NULL,  -- Unix timestamp
    end_time INTEGER NOT NULL,    -- Unix timestamp
    recurrence TEXT,              -- NULL (one-time) | 'daily' | 'weekly' | 'monthly'
    recurrence_config TEXT,       -- JSON: {"day_of_week": 0-6, "day_of_month": 1-31, "time": "02:00"}

    -- Behavior
    suppress_checks INTEGER NOT NULL DEFAULT 0,  -- 0 = run checks, 1 = skip checks
    suppress_alerts INTEGER NOT NULL DEFAULT 1,  -- 0 = send alerts, 1 = suppress alerts

    -- Metadata
    created_by TEXT,  -- API key name or user identifier
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

    CHECK (start_time < end_time),
    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

CREATE INDEX idx_maintenance_windows_time ON maintenance_windows(start_time, end_time);
CREATE INDEX idx_maintenance_windows_target ON maintenance_windows(target_id);
CREATE INDEX idx_maintenance_windows_state ON maintenance_windows(state);
CREATE INDEX idx_maintenance_windows_enabled ON maintenance_windows(enabled) WHERE enabled = 1;

-- Track when checks were skipped due to maintenance
CREATE TABLE maintenance_skip_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    window_id INTEGER NOT NULL,
    skip_reason TEXT NOT NULL,  -- 'maintenance_check_suppressed' | 'maintenance_alert_suppressed'
    scheduled_check_time INTEGER NOT NULL,
    window_name TEXT,  -- Denormalized for easier reporting
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
    FOREIGN KEY (window_id) REFERENCES maintenance_windows(id) ON DELETE CASCADE
);

CREATE INDEX idx_maintenance_skip_log_target ON maintenance_skip_log(target_id, created_at DESC);
CREATE INDEX idx_maintenance_skip_log_window ON maintenance_skip_log(window_id);
CREATE INDEX idx_maintenance_skip_log_time ON maintenance_skip_log(created_at DESC);
