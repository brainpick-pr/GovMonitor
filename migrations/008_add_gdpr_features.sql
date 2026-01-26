-- Migration 008: Add GDPR Compliance Features
-- Purpose: Data privacy, retention policies, export/deletion capabilities
-- Date: 2026-01-26

-- Data retention policies
CREATE TABLE retention_policies (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton

    -- Check data retention
    checks_retention_days INTEGER NOT NULL DEFAULT 365,  -- Keep checks for 1 year
    failed_checks_retention_days INTEGER NOT NULL DEFAULT 730,  -- Keep failures for 2 years

    -- Audit log retention
    audit_log_retention_days INTEGER NOT NULL DEFAULT 90,  -- Keep auth logs for 90 days

    -- Alert history retention
    alert_history_retention_days INTEGER NOT NULL DEFAULT 180,  -- Keep alerts for 6 months

    -- Auto-cleanup enabled
    auto_cleanup_enabled INTEGER NOT NULL DEFAULT 0,
    last_cleanup_at INTEGER,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Initialize with defaults
INSERT INTO retention_policies (id) VALUES (1);

-- Data export requests (GDPR Article 15 - Right of Access)
CREATE TABLE data_export_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_type TEXT NOT NULL,  -- 'full' | 'targets' | 'checks' | 'alerts' | 'audit'
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'completed' | 'failed'

    -- Filters
    target_ids TEXT,  -- JSON array: [1,2,3] or null for all
    date_range_start INTEGER,
    date_range_end INTEGER,

    -- Result
    export_url TEXT,  -- Download URL or null if not completed
    export_size_bytes INTEGER,
    export_format TEXT NOT NULL DEFAULT 'json',  -- 'json' | 'csv'
    export_filename TEXT,

    -- Metadata
    requested_by TEXT,  -- API key name
    ip_address TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER,
    error_message TEXT
);

CREATE INDEX idx_data_export_requests_status ON data_export_requests(status, created_at DESC);
CREATE INDEX idx_data_export_requests_requested_by ON data_export_requests(requested_by);

-- GDPR consent tracking (for future UI users)
CREATE TABLE gdpr_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_identifier TEXT NOT NULL UNIQUE,  -- Email or user ID

    -- Consent types
    analytics_consent INTEGER NOT NULL DEFAULT 0,
    marketing_consent INTEGER NOT NULL DEFAULT 0,
    data_processing_consent INTEGER NOT NULL DEFAULT 1,  -- Required for service

    -- Consent metadata
    consent_given_at INTEGER NOT NULL DEFAULT (unixepoch()),
    consent_withdrawn_at INTEGER,
    ip_address TEXT,
    user_agent TEXT,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_gdpr_consents_user ON gdpr_consents(user_identifier);
CREATE INDEX idx_gdpr_consents_withdrawn ON gdpr_consents(consent_withdrawn_at) WHERE consent_withdrawn_at IS NOT NULL;

-- Data deletion requests (GDPR Article 17 - Right to Erasure)
CREATE TABLE data_deletion_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deletion_scope TEXT NOT NULL,  -- 'target' | 'state' | 'all_checks' | 'user_data'
    target_id INTEGER,
    state TEXT,
    user_identifier TEXT,

    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'processing' | 'completed' | 'rejected'

    -- Audit trail
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    rejection_reason TEXT,

    -- Execution
    deleted_targets_count INTEGER DEFAULT 0,
    deleted_checks_count INTEGER DEFAULT 0,
    deleted_alerts_count INTEGER DEFAULT 0,
    deleted_audit_logs_count INTEGER DEFAULT 0,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    approved_at INTEGER,
    completed_at INTEGER
);

CREATE INDEX idx_data_deletion_requests_status ON data_deletion_requests(status, created_at DESC);
CREATE INDEX idx_data_deletion_requests_target ON data_deletion_requests(target_id);

-- Data processing log (for transparency)
CREATE TABLE data_processing_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    processing_type TEXT NOT NULL,  -- 'check_execution' | 'alert_dispatch' | 'data_export' | 'data_deletion'
    entity_type TEXT,  -- 'target' | 'check' | 'alert'
    entity_id INTEGER,

    -- Processing details
    purpose TEXT,  -- 'uptime_monitoring' | 'alert_notification' | 'gdpr_compliance'
    data_categories TEXT,  -- JSON array: ['url', 'status', 'latency']
    legal_basis TEXT,  -- 'legitimate_interest' | 'consent' | 'legal_obligation'

    -- Metadata
    processed_at INTEGER NOT NULL DEFAULT (unixepoch()),
    processor TEXT  -- 'cron_worker' | 'api_endpoint' | 'admin_user'
);

CREATE INDEX idx_data_processing_log_time ON data_processing_log(processed_at DESC);
CREATE INDEX idx_data_processing_log_type ON data_processing_log(processing_type);
CREATE INDEX idx_data_processing_log_entity ON data_processing_log(entity_type, entity_id);
