-- Add missing check-related columns to targets table
ALTER TABLE targets ADD COLUMN expected_status INTEGER DEFAULT 200;
ALTER TABLE targets ADD COLUMN allowed_status_codes TEXT;
ALTER TABLE targets ADD COLUMN check_mode TEXT DEFAULT 'website';

-- Update existing records to have default values
UPDATE targets SET expected_status = 200 WHERE expected_status IS NULL;
UPDATE targets SET check_mode = 'website' WHERE check_mode IS NULL;
