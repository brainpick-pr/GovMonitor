-- Migration 004: Add Authentication Tables
-- Adds API key management and audit logging for GovMonitor.Org

-- API Keys table for multi-key management
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- Friendly name ("Admin Dashboard", "Mobile App", "CI/CD Pipeline")
    key_hash TEXT NOT NULL UNIQUE,   -- SHA-256 hash of API key
    scope TEXT NOT NULL DEFAULT 'read', -- 'admin' | 'write' | 'read'
    enabled INTEGER NOT NULL DEFAULT 1, -- 1=active, 0=disabled
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    last_used_at INTEGER,            -- Unix timestamp of last usage
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,              -- Optional expiration (Unix timestamp)

    CHECK (scope IN ('admin', 'write', 'read')),
    CHECK (enabled IN (0, 1)),
    CHECK (rate_limit > 0)
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash, enabled);
CREATE INDEX IF NOT EXISTS idx_api_keys_scope ON api_keys(scope);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled);

-- Audit log for authenticated actions
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,              -- Reference to api_keys.id (NULL for failed attempts)
    endpoint TEXT NOT NULL,          -- Request path (/api/targets)
    method TEXT NOT NULL,            -- HTTP method (GET, POST, PUT, DELETE)
    ip_address TEXT,                 -- Client IP address
    user_agent TEXT,                 -- Client User-Agent
    success INTEGER NOT NULL,        -- 1 = success, 0 = failure
    error_message TEXT,              -- Error message for failed attempts
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL,
    CHECK (success IN (0, 1))
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_api_key ON auth_audit_log(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_success ON auth_audit_log(success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_endpoint ON auth_audit_log(endpoint, created_at DESC);

-- Insert example API key for initial setup (disabled by default)
-- To use: Generate a key, hash it with SHA-256, and update this row
-- Example: wrangler secret put API_KEY (then use that key or add to database)
INSERT INTO api_keys (name, key_hash, scope, enabled, rate_limit)
VALUES (
    'Initial Admin Key (DISABLED)',
    'example-hash-replace-this',
    'admin',
    0,  -- Disabled - enable after setting up real key
    10000
);
