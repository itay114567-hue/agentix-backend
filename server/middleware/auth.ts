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

// ── Helper: extract token from request (cookie OR Authorization header) ───────
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return req.cookies?.[COOKIE_NAME] || null;
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

    res.status(201).json({
      success: true,
      token,
      user: { id: result.lastInsertRowid, email, name },
    });
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

  res.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, company: user.company },
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
authRouter.get("/me", (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    ensureUsersTable();
    const db = getDb();
    const user = db
      .prepare("SELECT id, email, name, company, role, created_at FROM users WHERE id = ?")
      .get(payload.userId) as any;
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
authRouter.get("/google", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(501).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID env var." });
    return;
  }
  const redirectUri = `${process.env.BACKEND_URL || "https://agentix-backend-bpgg.onrender.com"}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.BACKEND_URL || "https://agentix-backend-bpgg.onrender.com"}/api/auth/google/callback`;
  const frontendUrl = process.env.FRONTEND_URL || "https://agentix-frontend-25o6.vercel.app";

  if (!code || !clientId || !clientSecret) {
    res.redirect(`${frontendUrl}/login?error=google_not_configured`);
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

    // Decode id_token
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

    // Redirect to frontend with token in URL — cross-domain safe
    res.redirect(`${frontendUrl}/dashboard?token=${jwt_token}`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${frontendUrl}/login?error=google_failed`);
  }
});
