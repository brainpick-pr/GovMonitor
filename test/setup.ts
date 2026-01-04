import { env } from "cloudflare:test";

// Apply migrations before all tests
export async function setup() {
  // Create config table
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        interval_min INTEGER NOT NULL DEFAULT 15,
        last_run_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  await env.DB.prepare(`INSERT OR IGNORE INTO config (id, interval_min) VALUES (1, 15)`).run();

  // Create targets table
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS targets (
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
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  // Create checks table
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_id INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        ok INTEGER NOT NULL,
        status INTEGER,
        latency_ms INTEGER,
        error TEXT,
        validation_details TEXT,
        interval_used INTEGER,
        FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
    )
  `).run();

  // Create indexes
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_targets_next_check ON targets(next_check_at, enabled) WHERE enabled = 1`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_checks_target_ts ON checks(target_id, ts DESC)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_checks_ts ON checks(ts DESC)`).run();

  // Create state uptime views
  await env.DB.prepare(`
    CREATE VIEW IF NOT EXISTS state_uptime_24h AS
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
    GROUP BY t.state
  `).run();

  await env.DB.prepare(`
    CREATE VIEW IF NOT EXISTS state_uptime_7d AS
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
    GROUP BY t.state
  `).run();

  await env.DB.prepare(`
    CREATE VIEW IF NOT EXISTS state_uptime_30d AS
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
    GROUP BY t.state
  `).run();

  await env.DB.prepare(`
    CREATE VIEW IF NOT EXISTS state_uptime_365d AS
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
    GROUP BY t.state
  `).run();
}
