import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../db.js";

export const webinarRouter = Router();

const WebinarSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  company: z.string().max(100).optional(),
});

webinarRouter.post("/", async (req: Request, res: Response) => {
  const parsed = WebinarSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { name, email, company } = parsed.data;
  try {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM webinar_registrations WHERE email = ?").get(email);
    if (existing) { res.status(200).json({ success: true, alreadyRegistered: true }); return; }
    const result = db.prepare("INSERT INTO webinar_registrations (name, email, company) VALUES (?, ?, ?)").run(name, email, company ?? null);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error("Error registering webinar:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
