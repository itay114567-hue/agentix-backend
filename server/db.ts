import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "../agentix.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export async function initDb() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT,
      source TEXT DEFAULT 'demo_form',
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS webinar_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create default admin if not exists
  const adminUser = database
    .prepare("SELECT id FROM admin_users WHERE username = ?")
    .get("admin");

  if (!adminUser) {
    const defaultPassword = process.env.ADMIN_PASSWORD || "agentix-admin-2025";
    const hash = await bcrypt.hash(defaultPassword, 12);
    database
      .prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)")
      .run("admin", hash);
    console.log("✅ Default admin created. Username: admin");
    console.log(
      `   Password: ${process.env.ADMIN_PASSWORD ? "[from env]" : defaultPassword}`
    );
  }

  console.log("✅ Database initialized at:", DB_PATH);
}
