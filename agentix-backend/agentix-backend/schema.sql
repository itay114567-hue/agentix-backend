-- Leads from demo booking form
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  source TEXT DEFAULT 'demo_form', -- 'demo_form' | 'roi_report' | 'contact'
  status TEXT DEFAULT 'new', -- 'new' | 'contacted' | 'qualified' | 'closed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ROI report requests
CREATE TABLE IF NOT EXISTS roi_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  agents INTEGER NOT NULL,
  avg_salary INTEGER NOT NULL,
  utilization INTEGER NOT NULL,
  current_cost REAL NOT NULL,
  agentix_cost REAL NOT NULL,
  savings REAL NOT NULL,
  savings_percent REAL NOT NULL,
  payback_months REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webinar registrations
CREATE TABLE IF NOT EXISTS webinar_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
