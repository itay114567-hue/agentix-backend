import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendRoiReportNotification } from "../email.js";

export const roiRouter = Router();

const RoiSchema = z.object({
  email: z.string().email(),
  agents: z.number().int().min(1).max(10000),
  avgSalary: z.number().int().min(1000).max(1000000),
  utilization: z.number().int().min(1).max(100),
});

roiRouter.post("/", async (req: Request, res: Response) => {
  const parsed = RoiSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { email, agents, avgSalary, utilization } = parsed.data;
  const currentCost = (agents * avgSalary * utilization) / 100;
  const agentixPlatformCost = agents * 500 * 12;
  const remainingHumanCost = currentCost * 0.20;
  const totalAgentixCost = agentixPlatformCost + remainingHumanCost;
  const rawSavings = currentCost - totalAgentixCost;
  const savings = Math.max(rawSavings, currentCost * 0.40);
  const agentixCost = totalAgentixCost;
  const savingsPercent = Number(((savings / currentCost) * 100).toFixed(2));
  const paybackMonths = Number(Math.max(1, (agentixCost / (savings / 12))).toFixed(2));
  try {
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO roi_reports (email, agents, avg_salary, utilization, current_cost, agentix_cost, savings, savings_percent, payback_months)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(email, agents, avgSalary, utilization, currentCost, agentixCost, savings, savingsPercent, paybackMonths);
    sendRoiReportNotification({ email, agents, avgSalary, utilization, currentCost, agentixCost, savings, savingsPercent, paybackMonths }).catch(console.error);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error("Error saving ROI:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
