-- Migration 009: Add encryption support for data at rest
-- Adds metadata columns to track encrypted fields

-- Add encryption tracking to checks table
ALTER TABLE checks ADD COLUMN error_encrypted INTEGER DEFAULT 0;
ALTER TABLE checks ADD COLUMN validation_details_encrypted INTEGER DEFAULT 0;

-- Add encryption tracking to targets table
ALTER TABLE targets ADD COLUMN json_path_encrypted INTEGER DEFAULT 0;
ALTER TABLE targets ADD COLUMN expected_json_value_encrypted INTEGER DEFAULT 0;
ALTER TABLE targets ADD COLUMN text_match_encrypted INTEGER DEFAULT 0;

-- Add encryption tracking to alert_history table (if needed for future)
ALTER TABLE alert_history ADD COLUMN message_encrypted INTEGER DEFAULT 0;

-- Create indexes for finding unencrypted records (useful for migration)
CREATE INDEX IF NOT EXISTS idx_checks_unencrypted
ON checks(id) WHERE error IS NOT NULL AND error_encrypted = 0;

CREATE INDEX IF NOT EXISTS idx_targets_unencrypted
ON targets(id) WHERE
  (json_path IS NOT NULL AND json_path_encrypted = 0) OR
  (expected_json_value IS NOT NULL AND expected_json_value_encrypted = 0) OR
  (text_match IS NOT NULL AND text_match_encrypted = 0);

-- Note: The validation_details column doesn't exist yet in checks table
-- We'll add it if it's needed for extended validation info
-- For now, we can store validation details in the error field if needed
