-- Migration 012: Add categories and expanded portal fields
-- Supports categorization, geolocation, and descriptions for portals

-- Add new columns to targets table
ALTER TABLE targets ADD COLUMN category TEXT DEFAULT 'tender' CHECK (category IN (
  'central',
  'identity',
  'financial',
  'transport',
  'utilities',
  'health',
  'business',
  'passport',
  'transparency',
  'education',
  'tender',
  'other'
));

ALTER TABLE targets ADD COLUMN latitude REAL;
ALTER TABLE targets ADD COLUMN longitude REAL;
ALTER TABLE targets ADD COLUMN description TEXT;
ALTER TABLE targets ADD COLUMN official_name TEXT;
ALTER TABLE targets ADD COLUMN department TEXT;
ALTER TABLE targets ADD COLUMN contact_email TEXT;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_targets_category ON targets(category);
CREATE INDEX IF NOT EXISTS idx_targets_state_category ON targets(state, category);

-- Create a view for category statistics
CREATE VIEW IF NOT EXISTS category_stats AS
SELECT
  category,
  COUNT(*) as total_portals,
  SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active_portals,
  COUNT(DISTINCT state) as states_covered
FROM targets
GROUP BY category
ORDER BY total_portals DESC;

-- Create a view for portal search
CREATE VIEW IF NOT EXISTS portal_search AS
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
