-- Migration 019: Add .nic.in domain support
-- NIC (National Informatics Centre) is an Indian government body
-- Many state eProcurement portals use .nic.in domains (e.g., etenders.hry.nic.in)
-- SQLite does not support ALTER CHECK CONSTRAINT, so we recreate the table

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE targets_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    hostname TEXT NOT NULL,
    state TEXT NOT NULL,
    interval_min INTEGER NOT NULL DEFAULT 15,
    next_check_at INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    check_mode TEXT NOT NULL DEFAULT 'website',
    expected_status INTEGER NOT NULL DEFAULT 200,
    allowed_status_codes TEXT,
    json_path TEXT,
    expected_json_value TEXT,
    text_match TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at INTEGER,
    deleted_by TEXT,
    CHECK (
        hostname LIKE '%.gov' OR
        hostname LIKE '%.gov.%' OR
        hostname LIKE '%.gc.ca' OR
        hostname LIKE '%.government.%' OR
        hostname LIKE '%.nic.in'
    )
);

-- Step 2: Copy existing data
INSERT INTO targets_new SELECT * FROM targets;

-- Step 3: Drop old table
DROP TABLE targets;

-- Step 4: Rename new table
ALTER TABLE targets_new RENAME TO targets;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_targets_next_check
ON targets(next_check_at, enabled) WHERE enabled = 1;

CREATE INDEX IF NOT EXISTS idx_targets_check_mode ON targets(check_mode);
CREATE INDEX IF NOT EXISTS idx_targets_state ON targets(state);
