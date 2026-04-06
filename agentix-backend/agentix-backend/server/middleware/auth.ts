import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "agentix-dev-secret-change-in-production";

export interface AuthRequest extends Request {
  adminId?: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { adminId: number };
    (req as AuthRequest).adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(adminId: number): string {
  return jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "7d" });
}
