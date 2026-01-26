-- Migration 007: Add Health Check Templates
-- Purpose: Reusable configuration templates for common services
-- Date: 2026-01-26

-- Reusable health check templates
CREATE TABLE check_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT,  -- 'government-portal', 'api-service', 'cms', 'custom'

    -- Template configuration
    check_mode TEXT NOT NULL DEFAULT 'website',
    expected_status INTEGER NOT NULL DEFAULT 200,
    allowed_status_codes TEXT,  -- JSON array: "[200,301,302]"
    json_path TEXT,
    expected_json_value TEXT,
    text_match TEXT,

    -- Default settings
    default_interval_min INTEGER NOT NULL DEFAULT 15,

    -- Metadata
    is_system_template INTEGER NOT NULL DEFAULT 0,  -- 0 = user, 1 = system
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_check_templates_category ON check_templates(category);
CREATE INDEX idx_check_templates_usage ON check_templates(usage_count DESC);
CREATE INDEX idx_check_templates_system ON check_templates(is_system_template);

-- Track which targets use which templates
CREATE TABLE target_template_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch()),

    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES check_templates(id) ON DELETE SET NULL
);

CREATE INDEX idx_target_template_mappings_target ON target_template_mappings(target_id);
CREATE INDEX idx_target_template_mappings_template ON target_template_mappings(template_id);

-- Insert system templates
INSERT INTO check_templates (name, description, category, check_mode, expected_status, default_interval_min, is_system_template)
VALUES (
    'Government Portal',
    'Standard government website with 200 OK check',
    'government-portal',
    'website',
    200,
    15,
    1
);

INSERT INTO check_templates (name, description, category, check_mode, allowed_status_codes, default_interval_min, is_system_template)
VALUES (
    'Government Portal (Flexible)',
    'Government website allowing 200/301/302 status codes',
    'government-portal',
    'website',
    '[200,301,302]',
    15,
    1
);

INSERT INTO check_templates (name, description, category, check_mode, json_path, expected_json_value, default_interval_min, is_system_template)
VALUES (
    'JSON Health API',
    'API with JSON health endpoint (status: "ok")',
    'api-service',
    'api-json',
    'status',
    'ok',
    10,
    1
);

INSERT INTO check_templates (name, description, category, check_mode, json_path, expected_json_value, default_interval_min, is_system_template)
VALUES (
    'JSON Health API (Nested)',
    'API with nested health status (data.health.status: "operational")',
    'api-service',
    'api-json',
    'data.health.status',
    'operational',
    10,
    1
);

INSERT INTO check_templates (name, description, category, check_mode, text_match, default_interval_min, is_system_template)
VALUES (
    'CMS Portal',
    'Government CMS portal with "Welcome" text check',
    'cms',
    'api-text',
    'Welcome',
    15,
    1
);

INSERT INTO check_templates (name, description, category, check_mode, json_path, expected_json_value, default_interval_min, is_system_template)
VALUES (
    'API Status Endpoint',
    'Standard API status endpoint (status: "healthy")',
    'api-service',
    'api-json',
    'status',
    'healthy',
    10,
    1
);
