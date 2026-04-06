import nodemailer from "nodemailer";

function getTransporter() {
  // If SMTP env vars are set, use them. Otherwise use Ethereal (dev preview).
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Dev fallback — logs to console
  return nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });
}

const FROM = process.env.EMAIL_FROM || "noreply@agentix.ai";
const SALES_EMAIL = process.env.SALES_EMAIL || "sales@agentix.ai";

// ── Send demo booking notification to sales team ──────────────────────────────
export async function sendDemoNotification(lead: {
  name: string;
  company: string;
  email: string;
  phone?: string;
  message?: string;
}) {
  const transporter = getTransporter();

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #050508; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-family: 'Space Grotesk', sans-serif;">
          🚀 New Demo Request
        </h1>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${lead.name}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Company</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${lead.company}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #2563EB;">${lead.email}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Phone</td><td style="padding: 8px 0; color: #111827;">${lead.phone || "—"}</td></tr>
          ${lead.message ? `<tr><td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Message</td><td style="padding: 8px 0; color: #111827;">${lead.message}</td></tr>` : ""}
        </table>
        <div style="margin-top: 24px; padding: 16px; background: #dbeafe; border-radius: 8px; text-align: center;">
          <a href="mailto:${lead.email}" style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-family: 'Space Grotesk', sans-serif;">
            Reply to ${lead.name}
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
          Received ${new Date().toLocaleString()} · Agentix CRM
        </p>
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: FROM,
    to: SALES_EMAIL,
    subject: `🎯 New Demo Request — ${lead.company} (${lead.name})`,
    html,
  });

  if (!process.env.SMTP_HOST) {
    console.log("📧 [DEV] Demo notification email (no SMTP configured):");
    console.log(`   To: ${SALES_EMAIL} | From: ${lead.name} <${lead.email}>`);
  }

  return info;
}

// ── Send ROI report to sales team ─────────────────────────────────────────────
export async function sendRoiReportNotification(data: {
  email: string;
  agents: number;
  avgSalary: number;
  utilization: number;
  currentCost: number;
  agentixCost: number;
  savings: number;
  savingsPercent: number;
  paybackMonths: number;
}) {
  const transporter = getTransporter();

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #050508; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-family: 'Space Grotesk', sans-serif;">
          📊 ROI Report Request
        </h1>
        <p style="color: #93c5fd; margin: 8px 0 0;">${data.email}</p>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h3 style="color: #374151; margin: 0 0 16px;">Their Numbers</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280;">Support Agents</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${data.agents}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Avg Salary</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${fmt(data.avgSalary)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Utilization</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${data.utilization}%</td></tr>
        </table>

        <div style="display: grid; gap: 12px; margin-top: 20px;">
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Current Annual Cost</span>
            <span style="font-weight: 700; color: #111827;">${fmt(data.currentCost)}</span>
          </div>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Agentix Annual Cost</span>
            <span style="font-weight: 700; color: #111827;">${fmt(data.agentixCost)}</span>
          </div>
          <div style="background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between;">
            <span style="color: #166534; font-weight: 600;">Annual Savings</span>
            <span style="font-weight: 700; color: #166534; font-size: 20px;">${fmt(data.savings)}</span>
          </div>
          <div style="background: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between;">
            <span style="color: #1e40af; font-weight: 600;">Payback Period</span>
            <span style="font-weight: 700; color: #1e40af;">${data.paybackMonths} months</span>
          </div>
        </div>

        <div style="margin-top: 24px; text-align: center;">
          <a href="mailto:${data.email}" style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Reach Out Now
          </a>
        </div>
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: FROM,
    to: SALES_EMAIL,
    subject: `📊 ROI Report — ${fmt(data.savings)} potential savings · ${data.email}`,
    html,
  });

  if (!process.env.SMTP_HOST) {
    console.log("📧 [DEV] ROI report email (no SMTP configured):");
    console.log(
      `   To: ${SALES_EMAIL} | Lead: ${data.email} | Savings: ${fmt(data.savings)}`
    );
  }

  return info;
}

// ── Send confirmation to the lead ─────────────────────────────────────────────
export async function sendLeadConfirmation(to: string, name: string) {
  const transporter = getTransporter();

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #050508; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 28px;">
          agentix
        </h1>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
        <h2 style="color: #050508; font-family: 'Space Grotesk', sans-serif;">Hi ${name}, we got your request! 👋</h2>
        <p style="color: #6b7280; line-height: 1.6;">
          Our team will reach out within <strong style="color: #050508;">24 hours</strong> to schedule your personalized demo.
        </p>
        <p style="color: #6b7280; line-height: 1.6;">
          In the meantime, feel free to explore our platform or reach us at
          <a href="mailto:demo@agentix.ai" style="color: #2563EB;">demo@agentix.ai</a>.
        </p>
        <div style="margin-top: 32px;">
          <a href="https://agentixai-egdvoqed.manus.space" style="background: #2563EB; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-family: 'Space Grotesk', sans-serif;">
            Visit Agentix →
          </a>
        </div>
        <p style="color: #d1d5db; font-size: 12px; margin-top: 32px;">© 2025 Agentix Technologies Ltd.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `Agentix <${FROM}>`,
    to,
    subject: "We received your demo request — Agentix",
    html,
  });
}
