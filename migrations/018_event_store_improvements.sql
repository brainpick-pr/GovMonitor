-- Migration 018: Event Store Improvements (Option A - Quick Wins)
-- Adds event sourcing best practices without major refactoring
-- Created: 2026-01-31

-- ============================================================
-- 1. Add Metadata Column to Checks Table
-- ============================================================
-- Store correlation IDs, request context, worker info, etc.

ALTER TABLE checks ADD COLUMN metadata TEXT DEFAULT NULL;

PRAGMA defer_foreign_keys=ON;

-- Create index for metadata queries (e.g., finding all checks with same correlation_id)
CREATE INDEX IF NOT EXISTS idx_checks_metadata ON checks(metadata) WHERE metadata IS NOT NULL;

-- ============================================================
-- 2. Add Soft Delete to Targets Table
-- ============================================================
-- Instead of hard deletes, mark targets as deleted while preserving history

ALTER TABLE targets ADD COLUMN deleted_at INTEGER DEFAULT NULL;
ALTER TABLE targets ADD COLUMN deleted_by TEXT DEFAULT NULL;

-- Create view for active (non-deleted) targets
CREATE VIEW IF NOT EXISTS active_targets AS
SELECT * FROM targets WHERE deleted_at IS NULL;

-- Create index for deleted_at queries
CREATE INDEX IF NOT EXISTS idx_targets_deleted_at ON targets(deleted_at);

-- ============================================================
-- 3. Create Config History Table
-- ============================================================
-- Audit trail for all configuration changes

CREATE TABLE IF NOT EXISTS config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_by TEXT,
    reason TEXT,
    metadata TEXT, -- JSON for additional context
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_config_history_created_at ON config_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_history_field ON config_history(field_name, created_at DESC);

-- ============================================================
-- 4. Add Immutability Triggers for Checks Table
-- ============================================================
-- Prevent updates and deletes to maintain event log integrity

-- Trigger to prevent updates to checks
CREATE TRIGGER IF NOT EXISTS prevent_checks_update
BEFORE UPDATE ON checks
BEGIN
    SELECT RAISE(ABORT, 'Checks table is immutable - updates are not allowed. Create a new check instead.');
END;

-- Trigger to prevent deletes from checks
CREATE TRIGGER IF NOT EXISTS prevent_checks_delete
BEFORE DELETE ON checks
BEGIN
    SELECT RAISE(ABORT, 'Checks table is immutable - deletes are not allowed. Check history must be preserved.');
END;

-- ============================================================
-- 5. Add Target History Table
-- ============================================================
-- Audit trail for target configuration changes

CREATE TABLE IF NOT EXISTS target_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_by TEXT,
    reason TEXT,
    metadata TEXT, -- JSON for correlation IDs, etc.
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_target_history_target_id ON target_history(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_target_history_created_at ON target_history(created_at DESC);

-- ============================================================
-- 6. Enhance Security Events with Stream Support
-- ============================================================
-- Add stream_id and version for better event correlation

ALTER TABLE security_events ADD COLUMN stream_id TEXT DEFAULT NULL;
ALTER TABLE security_events ADD COLUMN correlation_id TEXT DEFAULT NULL;

-- Create index for stream queries
CREATE INDEX IF NOT EXISTS idx_security_events_stream ON security_events(stream_id, created_at DESC) WHERE stream_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_correlation ON security_events(correlation_id, created_at DESC) WHERE correlation_id IS NOT NULL;

-- ============================================================
-- 7. Add User Activity History Table
-- ============================================================
-- Track user actions for audit trail

CREATE TABLE IF NOT EXISTS user_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 'login', 'logout', 'submission_created', 'comment_added', etc.
    resource_type TEXT, -- 'target', 'issue', 'comment', etc.
    resource_id INTEGER,
    metadata TEXT, -- JSON for action-specific details
    correlation_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity_log(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_correlation ON user_activity_log(correlation_id, created_at DESC) WHERE correlation_id IS NOT NULL;

-- ============================================================
-- 8. Add API Key Activity Log
-- ============================================================
-- Enhanced tracking for API key usage patterns

CREATE TABLE IF NOT EXISTS api_key_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    correlation_id TEXT,
    metadata TEXT, -- JSON for request/response details
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_key_activity_key_id ON api_key_activity_log(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_activity_endpoint ON api_key_activity_log(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_activity_correlation ON api_key_activity_log(correlation_id, created_at DESC) WHERE correlation_id IS NOT NULL;

-- ============================================================
-- 9. Add Immutability Trigger for Security Events
-- ============================================================
-- Security events should also be immutable

CREATE TRIGGER IF NOT EXISTS prevent_security_events_update
BEFORE UPDATE ON security_events
BEGIN
    SELECT RAISE(ABORT, 'Security events are immutable - updates are not allowed.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_security_events_delete
BEFORE DELETE ON security_events
BEGIN
    SELECT RAISE(ABORT, 'Security events are immutable - deletes are not allowed for audit compliance.');
END;

-- ============================================================
-- 10. Add Immutability Trigger for Auth Audit Log
-- ============================================================

CREATE TRIGGER IF NOT EXISTS prevent_auth_audit_update
BEFORE UPDATE ON auth_audit_log
BEGIN
    SELECT RAISE(ABORT, 'Auth audit log is immutable - updates are not allowed.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_auth_audit_delete
BEFORE DELETE ON auth_audit_log
BEGIN
    SELECT RAISE(ABORT, 'Auth audit log is immutable - deletes are not allowed for compliance.');
END;

-- ============================================================
-- Migration Complete
-- ============================================================
-- Summary:
-- ✅ Added metadata support to checks
-- ✅ Implemented soft delete for targets
-- ✅ Created config_history audit table
-- ✅ Added target_history audit table
-- ✅ Enhanced security_events with streams
-- ✅ Created user_activity_log
-- ✅ Created api_key_activity_log
-- ✅ Added immutability triggers for event tables
-- ✅ Improved indexing for correlation queries
--
-- Next Steps:
-- 1. Update TypeScript code to populate metadata fields
-- 2. Update config handler to log to config_history
-- 3. Update target handlers to log to target_history
-- 4. Update delete handlers to use soft delete
-- 5. Add correlation ID middleware
