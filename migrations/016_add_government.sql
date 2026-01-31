-- Migration 016: Add government integration system
-- Enables government users to verify, respond, and appeal

-- Government departments table
CREATE TABLE IF NOT EXISTS government_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT,
  email_domain TEXT NOT NULL UNIQUE,
  description TEXT,
  contact_email TEXT,
  website_url TEXT,
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Government verification requests
CREATE TABLE IF NOT EXISTS government_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  verification_code TEXT NOT NULL,
  code_sent_at INTEGER NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  verified_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES government_departments(id) ON DELETE CASCADE
);

-- API status appeals
CREATE TABLE IF NOT EXISTS api_appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  appeal_type TEXT NOT NULL CHECK (appeal_type IN ('status_dispute', 'data_correction', 'removal_request')),
  reason TEXT NOT NULL,
  evidence_url TEXT,
  supporting_documents TEXT, -- JSON array of document URLs

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  admin_response TEXT,
  resolution_notes TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_at INTEGER,
  reviewed_by INTEGER,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Government user department assignments
CREATE TABLE IF NOT EXISTS government_user_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'responder' CHECK (role IN ('responder', 'admin')),
  assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  assigned_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES government_departments(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, department_id)
);

-- Government response templates
CREATE TABLE IF NOT EXISTS government_response_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER,
  name TEXT NOT NULL,
  category TEXT,
  template_text TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (department_id) REFERENCES government_departments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_government_departments_state ON government_departments(state);
CREATE INDEX IF NOT EXISTS idx_government_departments_domain ON government_departments(email_domain);
CREATE INDEX IF NOT EXISTS idx_government_verifications_user ON government_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_government_verifications_code ON government_verifications(verification_code);
CREATE INDEX IF NOT EXISTS idx_api_appeals_user ON api_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_api_appeals_target ON api_appeals(target_id);
CREATE INDEX IF NOT EXISTS idx_api_appeals_status ON api_appeals(status);
CREATE INDEX IF NOT EXISTS idx_government_user_departments_user ON government_user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_government_user_departments_dept ON government_user_departments(department_id);

-- View for verified government users
CREATE VIEW IF NOT EXISTS verified_government_users AS
SELECT
  u.id as user_id,
  u.email,
  u.display_name,
  d.id as department_id,
  d.name as department_name,
  d.state as department_state,
  gud.role as department_role
FROM users u
JOIN government_user_departments gud ON u.id = gud.user_id
JOIN government_departments d ON gud.department_id = d.id
WHERE u.role = 'government';

-- View for pending appeals
CREATE VIEW IF NOT EXISTS pending_appeals AS
SELECT
  a.*,
  t.name as target_name,
  t.url as target_url,
  t.state as target_state,
  u.display_name as appellant_name,
  u.email as appellant_email
FROM api_appeals a
JOIN targets t ON a.target_id = t.id
JOIN users u ON a.user_id = u.id
WHERE a.status IN ('pending', 'under_review')
ORDER BY a.created_at ASC;

-- Insert some common government email domains
INSERT OR IGNORE INTO government_departments (name, state, email_domain, verified, created_at, updated_at)
VALUES
  ('National Informatics Centre', NULL, 'nic.in', 1, unixepoch(), unixepoch()),
  ('Government of India', NULL, 'gov.in', 1, unixepoch(), unixepoch()),
  ('Maharashtra Government', 'Maharashtra', 'maharashtra.gov.in', 1, unixepoch(), unixepoch()),
  ('Karnataka Government', 'Karnataka', 'karnataka.gov.in', 1, unixepoch(), unixepoch()),
  ('Tamil Nadu Government', 'Tamil Nadu', 'tn.gov.in', 1, unixepoch(), unixepoch()),
  ('Delhi Government', 'Delhi', 'delhi.gov.in', 1, unixepoch(), unixepoch()),
  ('Gujarat Government', 'Gujarat', 'gujarat.gov.in', 1, unixepoch(), unixepoch()),
  ('Rajasthan Government', 'Rajasthan', 'rajasthan.gov.in', 1, unixepoch(), unixepoch()),
  ('Uttar Pradesh Government', 'Uttar Pradesh', 'up.gov.in', 1, unixepoch(), unixepoch()),
  ('West Bengal Government', 'West Bengal', 'wb.gov.in', 1, unixepoch(), unixepoch()),
  ('Andhra Pradesh Government', 'Andhra Pradesh', 'ap.gov.in', 1, unixepoch(), unixepoch()),
  ('Telangana Government', 'Telangana', 'telangana.gov.in', 1, unixepoch(), unixepoch()),
  ('Kerala Government', 'Kerala', 'kerala.gov.in', 1, unixepoch(), unixepoch()),
  ('Punjab Government', 'Punjab', 'punjab.gov.in', 1, unixepoch(), unixepoch()),
  ('Haryana Government', 'Haryana', 'haryana.gov.in', 1, unixepoch(), unixepoch());
