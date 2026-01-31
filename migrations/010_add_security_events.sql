-- Migration 010: Add security events table for threat detection
-- Tracks security anomalies and suspicious activity

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN (
    'credential_attack',
    'credential_stuffing',
    'enumeration',
    'rate_limit_abuse',
    'off_hours_access',
    'geographic_anomaly'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  api_key_id INTEGER,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT, -- JSON
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

-- Indexes for security dashboard queries
CREATE INDEX IF NOT EXISTS idx_security_events_severity
ON security_events(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_type
ON security_events(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_api_key
ON security_events(api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_ip
ON security_events(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_created
ON security_events(created_at DESC);

-- View for recent critical events (dashboard)
CREATE VIEW IF NOT EXISTS critical_security_events AS
SELECT *
FROM security_events
WHERE severity IN ('high', 'critical')
  AND created_at >= unixepoch() - 86400 -- Last 24 hours
ORDER BY created_at DESC;

-- View for security summary (last 24h)
CREATE VIEW IF NOT EXISTS security_summary_24h AS
SELECT
  type,
  severity,
  COUNT(*) as event_count,
  MAX(created_at) as last_occurrence,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(DISTINCT api_key_id) as unique_keys
FROM security_events
WHERE created_at >= unixepoch() - 86400
GROUP BY type, severity
ORDER BY event_count DESC;
