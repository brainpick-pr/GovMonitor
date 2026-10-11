-- Migration 019: Add .nic.in domain support
-- NIC (National Informatics Centre) is an Indian government body
-- Many state eProcurement portals use .nic.in domains (e.g., etenders.hry.nic.in)
-- SQLite does not support ALTER CHECK CONSTRAINT, so we recreate the table
--
-- This migration preserves the FULL targets schema from all prior migrations:
--   Base schema: id, name, url, hostname, state, interval_min, next_check_at, enabled, created_at, updated_at
--   001_add_check_modes: check_mode, expected_status, allowed_status_codes, json_path, expected_json_value, text_match
--   009_add_encryption: json_path_encrypted, expected_json_value_encrypted, text_match_encrypted
--   012_add_categories: category, latitude, longitude, description, official_name, department, contact_email
--   018_event_store: deleted_at, deleted_by

-- Step 1: Drop checks immutability triggers (CASCADE on DROP TABLE would fire them)
DROP TRIGGER IF EXISTS prevent_checks_delete;
DROP TRIGGER IF EXISTS prevent_checks_update;

-- Step 2: Drop ALL views that reference targets (11 total)
DROP VIEW IF EXISTS latest_status;
DROP VIEW IF EXISTS state_uptime_24h;
DROP VIEW IF EXISTS state_uptime_7d;
DROP VIEW IF EXISTS state_uptime_30d;
DROP VIEW IF EXISTS state_uptime_365d;
DROP VIEW IF EXISTS active_targets;
DROP VIEW IF EXISTS category_stats;
DROP VIEW IF EXISTS portal_search;
DROP VIEW IF EXISTS issues_with_details;
DROP VIEW IF EXISTS pending_appeals;
DROP VIEW IF EXISTS state_issue_summary;

-- Step 3: Create new table with updated CHECK constraint
-- Includes every column from all prior migrations (001, 009, 012, 018)
CREATE TABLE targets_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    hostname TEXT NOT NULL,
    state TEXT NOT NULL,
    interval_min INTEGER NOT NULL DEFAULT 15,
    next_check_at INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    -- from 001_add_check_modes
    check_mode TEXT NOT NULL DEFAULT 'website',
    expected_status INTEGER NOT NULL DEFAULT 200,
    allowed_status_codes TEXT,
    json_path TEXT,
    expected_json_value TEXT,
    text_match TEXT,
    -- from 009_add_encryption
    json_path_encrypted INTEGER DEFAULT 0,
    expected_json_value_encrypted INTEGER DEFAULT 0,
    text_match_encrypted INTEGER DEFAULT 0,
    -- from 012_add_categories
    category TEXT DEFAULT 'tender' CHECK (category IN (
        'central', 'identity', 'financial', 'transport', 'utilities',
        'health', 'business', 'passport', 'transparency', 'education',
        'tender', 'other'
    )),
    latitude REAL,
    longitude REAL,
    description TEXT,
    official_name TEXT,
    department TEXT,
    contact_email TEXT,
    -- from 018_event_store_improvements
    deleted_at INTEGER DEFAULT NULL,
    deleted_by TEXT DEFAULT NULL,
    -- Updated CHECK: added .nic.in
    CHECK (
        hostname LIKE '%.gov' OR
        hostname LIKE '%.gov.%' OR
        hostname LIKE '%.gc.ca' OR
        hostname LIKE '%.government.%' OR
        hostname LIKE '%.nic.in'
    )
);

-- Step 4: Copy existing data with explicit column list
INSERT INTO targets_new (
    id, name, url, hostname, state, interval_min, next_check_at, enabled,
    created_at, updated_at,
    check_mode, expected_status, allowed_status_codes,
    json_path, expected_json_value, text_match,
    json_path_encrypted, expected_json_value_encrypted, text_match_encrypted,
    category, latitude, longitude, description, official_name, department, contact_email,
    deleted_at, deleted_by
)
SELECT
    id, name, url, hostname, state, interval_min, next_check_at, enabled,
    created_at, updated_at,
    check_mode, expected_status, allowed_status_codes,
    json_path, expected_json_value, text_match,
    json_path_encrypted, expected_json_value_encrypted, text_match_encrypted,
    category, latitude, longitude, description, official_name, department, contact_email,
    deleted_at, deleted_by
FROM targets;

-- Step 5: Drop old table
DROP TABLE targets;

-- Step 6: Rename new table
ALTER TABLE targets_new RENAME TO targets;

-- Step 7: Recreate ALL indexes from all prior migrations
-- Base schema
CREATE INDEX idx_targets_next_check
ON targets(next_check_at, enabled) WHERE enabled = 1;

-- 001_add_check_modes
CREATE INDEX idx_targets_check_mode ON targets(check_mode);
CREATE INDEX idx_targets_state ON targets(state) WHERE state IS NOT NULL;

-- 002 (enabled+state composite)
CREATE INDEX idx_targets_enabled_state
ON targets(enabled, state) WHERE enabled = 1;

-- 009_add_encryption
CREATE INDEX idx_targets_unencrypted
ON targets(id) WHERE
  (json_path IS NOT NULL AND json_path_encrypted = 0) OR
  (expected_json_value IS NOT NULL AND expected_json_value_encrypted = 0) OR
  (text_match IS NOT NULL AND text_match_encrypted = 0);

-- 012_add_categories
CREATE INDEX idx_targets_category ON targets(category);
CREATE INDEX idx_targets_state_category ON targets(state, category);

-- 018_event_store_improvements
CREATE INDEX idx_targets_deleted_at ON targets(deleted_at);

-- Step 8: Recreate ALL views that reference targets

CREATE VIEW latest_status AS
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

CREATE VIEW state_uptime_7d AS
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

CREATE VIEW state_uptime_30d AS
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

CREATE VIEW state_uptime_365d AS
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

-- 018_event_store_improvements
CREATE VIEW active_targets AS
SELECT * FROM targets WHERE deleted_at IS NULL;

-- 012_add_categories
CREATE VIEW category_stats AS
SELECT
  category,
  COUNT(*) as total_portals,
  SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active_portals,
  COUNT(DISTINCT state) as states_covered
FROM targets
GROUP BY category
ORDER BY total_portals DESC;

CREATE VIEW portal_search AS
SELECT
  t.id,
  t.name,
  t.url,
  t.hostname,
  t.state,
  t.category,
  t.description,
  t.official_name,
  t.department,
  t.enabled,
  c.ts as last_check_ts,
  c.ok as last_check_ok,
  c.latency_ms as last_check_latency
FROM targets t
LEFT JOIN (
  SELECT target_id, ts, ok, latency_ms,
         ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY ts DESC) as rn
  FROM checks
) c ON t.id = c.target_id AND c.rn = 1;

-- 014_add_issues
CREATE VIEW issues_with_details AS
SELECT
  i.*,
  t.name as target_name,
  t.url as target_url,
  t.hostname as target_hostname,
  t.state as target_state,
  u.display_name as reporter_name,
  u.avatar_url as reporter_avatar,
  u.reputation_score as reporter_reputation,
  gr.display_name as government_responder_name,
  rv.display_name as resolver_name,
  (SELECT COUNT(*) FROM issue_comments WHERE issue_id = i.id) as comment_count,
  (SELECT COUNT(*) FROM issue_screenshots WHERE issue_id = i.id) as screenshot_count
FROM issues i
JOIN targets t ON i.target_id = t.id
JOIN users u ON i.user_id = u.id
LEFT JOIN users gr ON i.government_responded_by = gr.id
LEFT JOIN users rv ON i.resolved_by = rv.id;

CREATE VIEW state_issue_summary AS
SELECT
  t.state,
  COUNT(i.id) as total_issues,
  SUM(CASE WHEN i.status = 'open' THEN 1 ELSE 0 END) as open_issues,
  SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END) as resolved_issues,
  SUM(CASE WHEN i.government_response IS NOT NULL THEN 1 ELSE 0 END) as government_responses,
  ROUND(100.0 * SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END) / NULLIF(COUNT(i.id), 0), 1) as resolution_rate
FROM issues i
JOIN targets t ON i.target_id = t.id
WHERE t.state IS NOT NULL
GROUP BY t.state;

-- 016_add_government (api_appeals)
CREATE VIEW pending_appeals AS
SELECT
  a.*,
  t.name as target_name,
  t.url as target_url,
  t.state as target_state,
  u.display_name as appellant_name,
  u.email as appellant_email
FROM api_appeals a
JOIN targets t ON a.target_id = t.id
JOIN users u ON a.user_id = u.id
WHERE a.status IN ('pending', 'under_review')
ORDER BY a.created_at ASC;

-- Step 9: Restore checks immutability triggers
CREATE TRIGGER prevent_checks_update
BEFORE UPDATE ON checks
BEGIN
    SELECT RAISE(ABORT, 'Checks table is immutable - updates are not allowed. Create a new check instead.');
END;

CREATE TRIGGER prevent_checks_delete
BEFORE DELETE ON checks
BEGIN
    SELECT RAISE(ABORT, 'Checks table is immutable - deletes are not allowed. Check history must be preserved.');
END;
