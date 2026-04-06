# Agentix Backend

Node.js + Express + SQLite backend for the Agentix landing page.

---

## What's included

| Feature | Endpoint |
|---|---|
| Demo booking form | `POST /api/leads` |
| ROI report email to sales | `POST /api/roi` |
| Webinar registration | `POST /api/webinar` |
| Admin login | `POST /api/admin/login` |
| Admin dashboard stats | `GET /api/admin/stats` |
| Admin leads list (paginated, filterable) | `GET /api/admin/leads` |
| Update lead status | `PATCH /api/admin/leads/:id` |
| ROI reports list | `GET /api/admin/roi-reports` |
| Webinar registrations list | `GET /api/admin/webinars` |
| Health check | `GET /api/health` |

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# Edit .env with your values

# 3. Start dev server (hot reload)
npm run dev
```

Server starts at `http://localhost:3000`.

On first run, a default admin is created:
- **Username:** `admin`
- **Password:** value of `ADMIN_PASSWORD` in `.env` (default: `agentix-admin-2025`)

---

## Deploy to Render

### Option A — One-click with render.yaml (recommended)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your repo — Render will read `render.yaml` automatically
4. Set the missing env vars in the Render dashboard:
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
   - `SALES_EMAIL` (your email that receives leads)
   - `FRONTEND_URL` (your Manus frontend URL)
5. Click **Deploy**

### Option B — Manual

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add a **Disk** (Persistent Storage):
   - Mount Path: `/var/data`
   - Set `DB_PATH=/var/data/agentix.db`
5. Add all environment variables from `.env.example`

---

## Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Deploy
railway up

# Set env vars
railway variables set ADMIN_PASSWORD=your-password JWT_SECRET=your-secret SALES_EMAIL=you@email.com
```

---

## Connecting the frontend

In your frontend code, replace the mock API calls with real ones.

### Demo booking modal (`DemoBookingModal` in Home.tsx)

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, source: "demo_form" }),
    });
    if (!res.ok) throw new Error("Failed");
    toast.success("Demo booked! We'll contact you within 24 hours.");
    setFormData({ name: "", company: "", email: "", phone: "", message: "" });
    demoModalOpen = false;
  } catch {
    toast.error("Failed to book demo. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

### ROI Calculator (`ROICalculator` in Home.tsx)

```typescript
// Replace the onClick of "Send Report" button:
const handleRoiSubmit = async () => {
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return;
  
  await fetch(`${import.meta.env.VITE_API_URL}/api/roi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, agents, avgSalary, utilization }),
  });
  
  setEmailSubmitted(true);
  setTimeout(() => setEmailSubmitted(false), 3000);
};
```

### Add to your frontend `.env`:

```
VITE_API_URL=https://your-backend.onrender.com
```

---

## Admin Panel

The backend exposes a full REST API for the admin panel.

### Login

```
POST /api/admin/login
{ "username": "admin", "password": "your-password" }
→ { "token": "..." }
```

Use the token as `Authorization: Bearer <token>` on all admin endpoints.

### Lead statuses

`new` → `contacted` → `qualified` → `closed`

```
PATCH /api/admin/leads/42
{ "status": "contacted" }
```

---

## Email setup (Gmail)

1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account → Security → App Passwords
3. Create a new App Password (select "Mail")
4. Use it as `SMTP_PASS` in your env vars

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
```

> **Without SMTP configured**, the server still works — it just logs emails to the console instead of sending them.

---

## Tech stack

- **Runtime:** Node.js 20+
- **Framework:** Express 4
- **Database:** SQLite via better-sqlite3 (zero-config, file-based)
- **Auth:** JWT (jsonwebtoken)
- **Email:** Nodemailer
- **Validation:** Zod
- **Language:** TypeScript
