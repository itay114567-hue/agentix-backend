import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import cookieParser from "cookie-parser";
import { leadsRouter } from "./routes/leads.js";
import { roiRouter } from "./routes/roi.js";
import { webinarRouter } from "./routes/webinar.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { initDb } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await initDb();

  const app = express();
  const server = createServer(app);

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "https://agentixai-egdvoqed.manus.space",
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        // Also allow any manus.space subdomain
        if (origin.endsWith(".manus.space")) return callback(null, true);
        return callback(null, true); // open for now — restrict after testing
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // ── API Routes ──────────────────────────────────────────
  app.use("/api/auth", authRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/roi", roiRouter);
  app.use("/api/webinar", webinarRouter);
  app.use("/api/admin", adminRouter);

  // ── Health check ────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Serve frontend in production ─────────────────────────
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

startServer().catch(console.error);
