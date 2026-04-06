import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendDemoNotification, sendLeadConfirmation } from "../email.js";

export const leadsRouter = Router();

const LeadSchema = z.object({
  name: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  message: z.string().max(1000).optional(),
  source: z.enum(["demo_form", "contact", "roi_report"]).default("demo_form"),
});

leadsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = LeadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { name, company, email, phone, message, source } = parsed.data;
  try {
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO leads (name, company, email, phone, message, source) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, company, email, phone ?? null, message ?? null, source);
    sendDemoNotification({ name, company, email, phone, message }).catch(console.error);
    sendLeadConfirmation(email, name).catch(console.error);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error("Error creating lead:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
