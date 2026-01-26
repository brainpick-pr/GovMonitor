-- Migration 005: Add Smart Scheduling
-- Purpose: Adaptive check intervals based on target reliability
-- Date: 2026-01-26

-- Store scheduling recommendations and metrics
CREATE TABLE scheduling_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL UNIQUE,

    -- Historical performance metrics
    total_checks INTEGER NOT NULL DEFAULT 0,
    successful_checks INTEGER NOT NULL DEFAULT 0,
    failed_checks INTEGER NOT NULL DEFAULT 0,
    uptime_percentage REAL NOT NULL DEFAULT 100.0,

    -- Stability metrics
    consecutive_successes INTEGER NOT NULL DEFAULT 0,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms REAL,
    last_failure_at INTEGER,  -- Unix timestamp

    -- Smart scheduling
    recommended_interval_min INTEGER NOT NULL DEFAULT 15,
    current_interval_min INTEGER NOT NULL DEFAULT 15,
    interval_last_adjusted_at INTEGER,
    adjustment_reason TEXT,  -- 'stable', 'unreliable', 'latency_spike', 'manual'

    -- Time-based patterns (for future ML)
    peak_hours TEXT,  -- JSON array: [9,10,11,12,13,14,15,16,17]
    failure_time_pattern TEXT,  -- JSON: {"hour": count}

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

CREATE INDEX idx_scheduling_metrics_target ON scheduling_metrics(target_id);
CREATE INDEX idx_scheduling_metrics_uptime ON scheduling_metrics(uptime_percentage);

-- Track interval adjustment history
CREATE TABLE interval_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    old_interval_min INTEGER NOT NULL,
    new_interval_min INTEGER NOT NULL,
    reason TEXT NOT NULL,
    uptime_at_adjustment REAL NOT NULL,
    consecutive_failures_at_adjustment INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

CREATE INDEX idx_interval_adjustments_target ON interval_adjustments(target_id, created_at DESC);

-- Add smart scheduling configuration to config table
ALTER TABLE config ADD COLUMN smart_scheduling_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE config ADD COLUMN smart_scheduling_config TEXT DEFAULT '{"stable_threshold_uptime":99.5,"unstable_threshold_uptime":95.0,"min_checks_before_adjust":20,"max_interval_min":60,"min_interval_min":5,"stable_multiplier":1.5,"unstable_multiplier":0.5,"consecutive_failures_trigger":3}';

-- Initialize scheduling metrics for existing targets
INSERT INTO scheduling_metrics (target_id, current_interval_min)
SELECT id, interval_min FROM targets
WHERE id NOT IN (SELECT target_id FROM scheduling_metrics);
