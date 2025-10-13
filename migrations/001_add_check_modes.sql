-- Migration: Add check modes and validation fields
-- Date: 2025-10-13
-- Description: Extends the targets table with configurable check modes and validation parameters

-- Add new columns to targets table
ALTER TABLE targets ADD COLUMN check_mode TEXT NOT NULL DEFAULT 'website';
ALTER TABLE targets ADD COLUMN expected_status INTEGER NOT NULL DEFAULT 200;
ALTER TABLE targets ADD COLUMN allowed_status_codes TEXT; -- JSON array of allowed status codes
ALTER TABLE targets ADD COLUMN json_path TEXT; -- JSON path for api-json mode (e.g., "status.health")
ALTER TABLE targets ADD COLUMN expected_json_value TEXT; -- Expected value at json_path
ALTER TABLE targets ADD COLUMN text_match TEXT; -- Substring to match for api-text mode

-- Add validation_details column to checks table
ALTER TABLE checks ADD COLUMN validation_details TEXT;

-- Add interval_used column to checks table to track what interval was configured at check time
ALTER TABLE checks ADD COLUMN interval_used INTEGER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_targets_check_mode ON targets(check_mode);
CREATE INDEX IF NOT EXISTS idx_targets_state ON targets(state);
