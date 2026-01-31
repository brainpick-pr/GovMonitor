-- Migration 011: Add users and sessions for Google OAuth
-- Supports community features: submissions, issues, government integration

-- Users table - stores Google OAuth profiles
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin', 'government')),
  reputation_score INTEGER NOT NULL DEFAULT 0,
  is_banned INTEGER NOT NULL DEFAULT 0 CHECK (is_banned IN (0, 1)),
  ban_reason TEXT,
  banned_at INTEGER,
  banned_by INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- User sessions - secure session tokens for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_activity_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User IP activity log - tracks user actions for accountability and security
CREATE TABLE IF NOT EXISTS user_ip_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'login',
    'logout',
    'submission',
    'issue_report',
    'comment',
    'vote',
    'appeal',
    'moderation_action',
    'profile_update'
  )),
  resource_type TEXT,
  resource_id INTEGER,
  metadata TEXT, -- JSON for additional action details
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_reputation ON users(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned) WHERE is_banned = 1;

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Indexes for IP log
CREATE INDEX IF NOT EXISTS idx_user_ip_log_user ON user_ip_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_ip_log_ip ON user_ip_log(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_ip_log_action ON user_ip_log(action, created_at DESC);

-- View for active sessions (not expired)
CREATE VIEW IF NOT EXISTS active_sessions AS
SELECT
  s.*,
  u.email,
  u.display_name,
  u.role
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.expires_at > unixepoch()
  AND u.is_banned = 0;

-- View for user activity summary (last 30 days)
CREATE VIEW IF NOT EXISTS user_activity_summary AS
SELECT
  u.id as user_id,
  u.display_name,
  u.email,
  u.role,
  u.reputation_score,
  COUNT(DISTINCT l.id) as total_actions,
  COUNT(DISTINCT CASE WHEN l.action = 'submission' THEN l.id END) as submissions,
  COUNT(DISTINCT CASE WHEN l.action = 'issue_report' THEN l.id END) as issues_reported,
  COUNT(DISTINCT CASE WHEN l.action = 'comment' THEN l.id END) as comments,
  MAX(l.created_at) as last_activity
FROM users u
LEFT JOIN user_ip_log l ON u.id = l.user_id
  AND l.created_at >= unixepoch() - 2592000 -- 30 days
GROUP BY u.id;

-- View for suspicious user activity (multiple IPs in short time)
CREATE VIEW IF NOT EXISTS suspicious_user_activity AS
SELECT
  user_id,
  COUNT(DISTINCT ip_address) as unique_ips,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM user_ip_log
WHERE created_at >= unixepoch() - 3600 -- Last hour
GROUP BY user_id
HAVING COUNT(DISTINCT ip_address) > 3;
