import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "../db.js";

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "agentix-jwt-secret-change-in-production";
const COOKIE_NAME = "agentix_auth";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Ensure users table exists ─────────────────────────────────────────────────
function ensureUsersTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT,
      company TEXT,
      google_id TEXT,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
authRouter.post("/register", async (req: Request, res: Response) => {
  ensureUsersTable();
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid data" });
    return;
  }
  const { email, password, name, company } = parsed.data;
  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db
      .prepare("INSERT INTO users (email, password_hash, name, company) VALUES (?, ?, ?, ?)")
      .run(email, hash, name ?? null, company ?? null);

    const token = jwt.sign(
      { userId: result.lastInsertRowid, email, role: "customer" },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ success: true, user: { id: result.lastInsertRowid, email, name } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
authRouter.post("/login", async (req: Request, res: Response) => {
  ensureUsersTable();
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password." });
    return;
  }
  const { email, password } = parsed.data;
  const db = getDb();

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!user || !user.password_hash) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, company: user.company } });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
authRouter.get("/me", (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    ensureUsersTable();
    const db = getDb();
    const user = db.prepare("SELECT id, email, name, company, role, created_at FROM users WHERE id = ?").get(payload.userId) as any;
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

// ── GET /api/auth/google ──────────────────────────────────────────────────────
// Redirect to Google OAuth. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.
authRouter.get("/google", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(501).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID env var." });
    return;
  }
  const redirectUri = `${process.env.BACKEND_URL || "https://agentix-backend-ay07.onrender.com"}/api/auth/google/callback`;
  const state = (req.query.redirect as string) || "/dashboard";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.BACKEND_URL || "https://agentix-backend-ay07.onrender.com"}/api/auth/google/callback`;

  if (!code || !clientId || !clientSecret) {
    res.redirect("/login?error=google_not_configured");
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokens.id_token) throw new Error("No id_token");

    // Decode id_token (payload is base64url)
    const payloadB64 = tokens.id_token.split(".")[1];
    const profile = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as any;
    const { sub: googleId, email, name } = profile;

    ensureUsersTable();
    const db = getDb();

    // Upsert user
    let user = db.prepare("SELECT * FROM users WHERE google_id = ? OR email = ?").get(googleId, email) as any;
    if (!user) {
      const result = db
        .prepare("INSERT INTO users (email, name, google_id) VALUES (?, ?, ?)")
        .run(email, name, googleId);
      user = { id: result.lastInsertRowid, email, name, role: "customer" };
    } else if (!user.google_id) {
      db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(googleId, user.id);
    }

    const jwt_token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role || "customer" },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie(COOKIE_NAME, jwt_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const redirectTo = "/dashboard";
    // Redirect to frontend
   const frontendUrl = process.env.FRONTEND_URL || "https://agentix-frontend-25o6.vercel.app";
  res.redirect(`${frontendUrl}${redirectTo}`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect("/login?error=google_failed");
  }
});
