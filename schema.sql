-- Easy As Loans — leads database (Cloudflare D1 / SQLite)
-- Run this once when setting up the database (see CRM-SETUP.md).

CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  loan_type   TEXT,
  loan_amount INTEGER,
  loan_term   INTEGER,
  use_type    TEXT,
  car_year    INTEGER,
  state       TEXT,
  full_name   TEXT,
  email       TEXT,
  mobile      TEXT,
  consent     INTEGER,
  source      TEXT,
  page_url    TEXT,
  status      TEXT NOT NULL DEFAULT 'New',
  details     TEXT,  -- full submission as JSON (employment, residency, DOB, etc.)
  notes       TEXT,  -- free-text notes added by staff in the dashboard
  updated_at  TEXT   -- last time the lead was edited (status/notes) in the dashboard
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status);
