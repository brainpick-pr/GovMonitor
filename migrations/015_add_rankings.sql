-- Migration 015: Add ranking system
-- State rankings based on uptime, latency, and issue resolution

-- State rankings table - stores calculated rankings by period
CREATE TABLE IF NOT EXISTS state_rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,

  -- Ranking data
  rank INTEGER NOT NULL,
  previous_rank INTEGER,
  rank_change INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL,

  -- Component scores
  uptime_percentage REAL NOT NULL,
  avg_latency_ms REAL,
  issue_resolution_rate REAL NOT NULL DEFAULT 0,
  portal_coverage INTEGER NOT NULL DEFAULT 0,

  -- Additional metrics
  total_portals INTEGER NOT NULL DEFAULT 0,
  total_checks INTEGER NOT NULL DEFAULT 0,
  total_issues INTEGER NOT NULL DEFAULT 0,
  resolved_issues INTEGER NOT NULL DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  UNIQUE(state, period, period_start)
);

-- Ranking methodology table - documents how rankings are calculated
CREATE TABLE IF NOT EXISTS ranking_methodology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL DEFAULT 1,
  uptime_weight REAL NOT NULL DEFAULT 0.5,
  latency_weight REAL NOT NULL DEFAULT 0.2,
  issue_resolution_weight REAL NOT NULL DEFAULT 0.2,
  coverage_weight REAL NOT NULL DEFAULT 0.1,
  description TEXT NOT NULL,
  effective_from INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Ranking suggestions table - community feedback on ranking methodology
CREATE TABLE IF NOT EXISTS ranking_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  suggestion TEXT NOT NULL,
  category TEXT CHECK (category IN ('methodology', 'weights', 'metrics', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented')),
  admin_response TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_at INTEGER,
  reviewed_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for rankings
CREATE INDEX IF NOT EXISTS idx_state_rankings_state ON state_rankings(state);
CREATE INDEX IF NOT EXISTS idx_state_rankings_period ON state_rankings(period, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_state_rankings_rank ON state_rankings(period, rank);
CREATE INDEX IF NOT EXISTS idx_state_rankings_current ON state_rankings(period, period_end DESC);

-- Indexes for suggestions
CREATE INDEX IF NOT EXISTS idx_ranking_suggestions_user ON ranking_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ranking_suggestions_status ON ranking_suggestions(status);

-- View for current rankings (latest period for each type)
CREATE VIEW IF NOT EXISTS current_state_rankings AS
SELECT r.*
FROM state_rankings r
INNER JOIN (
  SELECT state, period, MAX(period_end) as latest_end
  FROM state_rankings
  GROUP BY state, period
) latest ON r.state = latest.state
  AND r.period = latest.period
  AND r.period_end = latest.latest_end;

-- View for ranking leaderboard (monthly)
CREATE VIEW IF NOT EXISTS monthly_leaderboard AS
SELECT
  state,
  rank,
  previous_rank,
  rank_change,
  score,
  uptime_percentage,
  avg_latency_ms,
  issue_resolution_rate,
  portal_coverage,
  total_portals,
  period_start,
  period_end
FROM current_state_rankings
WHERE period = 'monthly'
ORDER BY rank ASC;

-- View for ranking trends (showing rank changes over time)
CREATE VIEW IF NOT EXISTS ranking_trends AS
SELECT
  state,
  period,
  period_start,
  rank,
  score,
  uptime_percentage,
  LAG(rank) OVER (PARTITION BY state, period ORDER BY period_start) as previous_period_rank,
  rank - LAG(rank) OVER (PARTITION BY state, period ORDER BY period_start) as rank_movement
FROM state_rankings
ORDER BY state, period, period_start DESC;

-- Insert default ranking methodology
INSERT OR IGNORE INTO ranking_methodology (version, uptime_weight, latency_weight, issue_resolution_weight, coverage_weight, description, effective_from)
VALUES (1, 0.5, 0.2, 0.2, 0.1, '# Ranking Methodology v1

## Score Calculation

The state ranking score is calculated using the following formula:

```
score = (uptime * 0.5) + (latency_score * 0.2) + (issue_resolution * 0.2) + (coverage * 0.1)
```

## Component Breakdown

### Uptime (50%)
- Measured as percentage of successful checks over the ranking period
- Higher uptime = higher score
- Based on all monitored portals in the state

### Latency Score (20%)
- Normalized score based on average response time
- Lower latency = higher score
- Score = 100 - (avg_latency_ms / 100), capped at 0-100

### Issue Resolution Rate (20%)
- Percentage of reported issues that were resolved
- Higher resolution rate = higher score
- Includes issues resolved within the ranking period

### Portal Coverage (10%)
- Number of government portals being monitored
- More coverage = higher score
- Normalized against the state with most portals

## Ranking Period

Rankings are calculated for:
- **Weekly**: Every Sunday at midnight
- **Monthly**: First day of each month
- **Quarterly**: First day of each quarter
- **Yearly**: January 1st

## Transparency

All ranking data, methodology, and calculations are publicly available. Community members can suggest improvements to the ranking system.
', unixepoch());
