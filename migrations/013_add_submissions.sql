-- Migration 013: Add community submission system
-- Allows users to submit websites for monitoring

-- Submissions table - stores user-submitted portals awaiting review
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  hostname TEXT NOT NULL,
  state TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'central', 'identity', 'financial', 'transport', 'utilities',
    'health', 'business', 'passport', 'transparency', 'education',
    'tender', 'other'
  )),
  justification TEXT NOT NULL,
  official_name TEXT,
  department TEXT,
  contact_email TEXT,

  -- Review fields
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER,
  reviewed_at INTEGER,
  review_notes TEXT,

  -- If approved, the created target ID
  target_id INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE SET NULL
);

-- Submission guidelines table - stores the current guidelines document
CREATE TABLE IF NOT EXISTS submission_guidelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  effective_from INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Submission votes - allows community voting on submissions
CREATE TABLE IF NOT EXISTS submission_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)), -- -1 downvote, 1 upvote
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(submission_id, user_id)
);

-- Indexes for submissions
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_state ON submissions(state);
CREATE INDEX IF NOT EXISTS idx_submissions_category ON submissions(category);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_pending ON submissions(status, created_at DESC) WHERE status = 'pending';

-- Indexes for votes
CREATE INDEX IF NOT EXISTS idx_submission_votes_submission ON submission_votes(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_votes_user ON submission_votes(user_id);

-- View for submission with vote counts
CREATE VIEW IF NOT EXISTS submissions_with_votes AS
SELECT
  s.*,
  u.display_name as submitter_name,
  u.avatar_url as submitter_avatar,
  r.display_name as reviewer_name,
  COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0) as upvotes,
  COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0) as downvotes,
  COALESCE(SUM(v.vote), 0) as vote_score
FROM submissions s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN users r ON s.reviewed_by = r.id
LEFT JOIN submission_votes v ON s.id = v.submission_id
GROUP BY s.id;

-- View for moderation queue (pending submissions ordered by votes)
CREATE VIEW IF NOT EXISTS moderation_queue AS
SELECT
  s.id,
  s.name,
  s.url,
  s.hostname,
  s.state,
  s.category,
  s.justification,
  s.created_at,
  u.display_name as submitter_name,
  u.reputation_score as submitter_reputation,
  COALESCE(SUM(v.vote), 0) as vote_score,
  COUNT(v.id) as total_votes
FROM submissions s
JOIN users u ON s.user_id = u.id
LEFT JOIN submission_votes v ON s.id = v.submission_id
WHERE s.status = 'pending'
GROUP BY s.id
ORDER BY vote_score DESC, s.created_at ASC;

-- Insert default submission guidelines
INSERT OR IGNORE INTO submission_guidelines (version, content, effective_from)
VALUES (1, '# Submission Guidelines

## What to Submit

You can submit any government website that:
- Is an official government portal (.gov.in, .nic.in domain)
- Provides services to citizens
- Is not already monitored on GovMonitor

## Required Information

1. **Portal Name**: Official name of the portal
2. **URL**: Full URL of the website (must be HTTPS)
3. **State**: Which state/UT it serves (or "Central" for national portals)
4. **Category**: Select the most appropriate category
5. **Justification**: Why should this portal be monitored?

## Review Process

1. Your submission will be reviewed by our moderation team
2. Community members can vote on submissions
3. Higher-voted submissions get priority review
4. You will be notified when your submission is approved or rejected

## Guidelines

- Only submit legitimate government websites
- One portal per submission
- Provide accurate information
- No duplicate submissions

## Reputation

- Approved submissions earn you 10 reputation points
- Rejected submissions with false information may result in reputation loss
', unixepoch());
