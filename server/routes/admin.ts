import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { authMiddleware, signToken } from "../middleware/auth.js";

export const adminRouter = Router();

// POST /api/admin/login
adminRouter.post("/login", async (req: Request, res: Response) => {
  const schema = z.object({ username: z.string(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid credentials" }); return; }

  const { username, password } = parsed.data;
  try {
    const db = getDb();
    const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username) as any;
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json({ token: signToken(user.id) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/stats
adminRouter.get("/stats", authMiddleware, (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const totalLeads = (db.prepare("SELECT COUNT(*) as count FROM leads").get() as any).count;
    const totalRoi = (db.prepare("SELECT COUNT(*) as count FROM roi_reports").get() as any).count;
    const totalWebinar = (db.prepare("SELECT COUNT(*) as count FROM webinar_registrations").get() as any).count;
    const newLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get() as any).count;
    const recentLeads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5").all();
    const leadsByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM leads
       WHERE created_at >= DATE('now', '-30 days')
       GROUP BY DATE(created_at) ORDER BY date ASC`
    ).all();
    res.json({ stats: { totalLeads, totalRoi, totalWebinar, newLeads }, recentLeads, leadsByDay });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/leads
adminRouter.get("/leads", authMiddleware, (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  try {
    const db = getDb();
    let where = "WHERE 1=1";
    const params: any[] = [];
    if (status) { where += " AND status = ?"; params.push(status); }
    if (search) { const q = `%${search}%`; where += " AND (name LIKE ? OR company LIKE ? OR email LIKE ?)"; params.push(q, q, q); }
    const total = (db.prepare(`SELECT COUNT(*) as count FROM leads ${where}`).get(...params) as any).count;
    const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ leads, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Leads error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/leads/:id
adminRouter.patch("/leads/:id", authMiddleware, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const schema = z.object({ status: z.enum(["new", "contacted", "qualified", "closed"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid status" }); return; }
  try {
    getDb().prepare("UPDATE leads SET status = ? WHERE id = ?").run(parsed.data.status, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/roi-reports
adminRouter.get("/roi-reports", authMiddleware, (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  try {
    const db = getDb();
    const total = (db.prepare("SELECT COUNT(*) as count FROM roi_reports").get() as any).count;
    const reports = db.prepare("SELECT * FROM roi_reports ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
    res.json({ reports, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/webinars
adminRouter.get("/webinars", authMiddleware, (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  try {
    const db = getDb();
    const total = (db.prepare("SELECT COUNT(*) as count FROM webinar_registrations").get() as any).count;
    const registrations = db.prepare("SELECT * FROM webinar_registrations ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
    res.json({ registrations, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});
