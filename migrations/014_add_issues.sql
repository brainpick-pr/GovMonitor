-- Migration 014: Add issue reporting system
-- Allows users to report issues with government portals

-- Issues table - stores user-reported issues
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'downtime', 'slow_performance', 'broken_functionality',
    'security_concern', 'accessibility', 'data_issue', 'other'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'resolved', 'wont_fix', 'duplicate'
  )),

  -- Screenshot URL (stored in R2)
  screenshot_url TEXT,

  -- Government response
  government_response TEXT,
  government_responded_by INTEGER,
  government_responded_at INTEGER,

  -- Voting
  upvotes INTEGER NOT NULL DEFAULT 0,

  -- Resolution
  resolved_at INTEGER,
  resolved_by INTEGER,
  resolution_notes TEXT,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (government_responded_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Issue comments table
CREATE TABLE IF NOT EXISTS issue_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_government_response INTEGER NOT NULL DEFAULT 0 CHECK (is_government_response IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Issue screenshots table (for multiple screenshots)
CREATE TABLE IF NOT EXISTS issue_screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

-- Issue votes table
CREATE TABLE IF NOT EXISTS issue_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(issue_id, user_id)
);

-- Issue subscriptions (for notifications)
CREATE TABLE IF NOT EXISTS issue_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(issue_id, user_id)
);

-- Indexes for issues
CREATE INDEX IF NOT EXISTS idx_issues_target ON issues(target_id);
CREATE INDEX IF NOT EXISTS idx_issues_user ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_created ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_open ON issues(status, upvotes DESC) WHERE status = 'open';

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_issue_comments_user ON issue_comments(user_id);

-- Indexes for votes
CREATE INDEX IF NOT EXISTS idx_issue_votes_issue ON issue_votes(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_votes_user ON issue_votes(user_id);

-- View for issues with details
CREATE VIEW IF NOT EXISTS issues_with_details AS
SELECT
  i.*,
  t.name as target_name,
  t.url as target_url,
  t.hostname as target_hostname,
  t.state as target_state,
  u.display_name as reporter_name,
  u.avatar_url as reporter_avatar,
  u.reputation_score as reporter_reputation,
  gr.display_name as government_responder_name,
  rv.display_name as resolver_name,
  (SELECT COUNT(*) FROM issue_comments WHERE issue_id = i.id) as comment_count,
  (SELECT COUNT(*) FROM issue_screenshots WHERE issue_id = i.id) as screenshot_count
FROM issues i
JOIN targets t ON i.target_id = t.id
JOIN users u ON i.user_id = u.id
LEFT JOIN users gr ON i.government_responded_by = gr.id
LEFT JOIN users rv ON i.resolved_by = rv.id;

-- View for issue statistics by target
CREATE VIEW IF NOT EXISTS target_issue_stats AS
SELECT
  target_id,
  COUNT(*) as total_issues,
  SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_issues,
  SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_issues,
  SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_issues,
  SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_issues,
  AVG(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - created_at END) as avg_resolution_time,
  MAX(created_at) as last_issue_at
FROM issues
GROUP BY target_id;

-- View for state issue summary
CREATE VIEW IF NOT EXISTS state_issue_summary AS
SELECT
  t.state,
  COUNT(i.id) as total_issues,
  SUM(CASE WHEN i.status = 'open' THEN 1 ELSE 0 END) as open_issues,
  SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END) as resolved_issues,
  SUM(CASE WHEN i.government_response IS NOT NULL THEN 1 ELSE 0 END) as government_responses,
  ROUND(100.0 * SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END) / NULLIF(COUNT(i.id), 0), 1) as resolution_rate
FROM issues i
JOIN targets t ON i.target_id = t.id
WHERE t.state IS NOT NULL
GROUP BY t.state;

-- Trigger to update upvotes count when vote is added
CREATE TRIGGER IF NOT EXISTS update_issue_upvotes_insert
AFTER INSERT ON issue_votes
BEGIN
  UPDATE issues SET upvotes = upvotes + 1, updated_at = unixepoch() WHERE id = NEW.issue_id;
END;

-- Trigger to update upvotes count when vote is removed
CREATE TRIGGER IF NOT EXISTS update_issue_upvotes_delete
AFTER DELETE ON issue_votes
BEGIN
  UPDATE issues SET upvotes = upvotes - 1, updated_at = unixepoch() WHERE id = OLD.issue_id;
END;
