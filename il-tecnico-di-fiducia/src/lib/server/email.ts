import "server-only";

import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string | null | undefined;
  subject: string;
  text: string;
  html?: string;
};

type EmailResult =
  | { sent: true; provider: "smtp"; messageId?: string }
  | { sent: false; skipped: true; reason: string };

type SmtpConfig =
  | {
      ok: true;
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
    }
  | { ok: false; missing: string[] };

function envValue(name: string) {
  return process.env[name]?.trim() || null;
}

function sender() {
  const explicitFrom = envValue("EMAIL_FROM");
  if (explicitFrom) return explicitFrom;

  const fromEmail = envValue("MAIL_FROM_EMAIL") ?? envValue("SMTP_FROM_EMAIL");
  if (!fromEmail) return null;

  const fromName = envValue("MAIL_FROM_NAME") ?? "Il Tecnico di Fiducia";

  return `${fromName} <${fromEmail}>`;
}

function parseSmtpSecure(value: string | null) {
  const normalized = value?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "false" || normalized === "0" || normalized === "no")
    return false;
  if (normalized === "true" || normalized === "1" || normalized === "yes")
    return true;

  return null;
}

function smtpConfig(): SmtpConfig {
  const host = envValue("SMTP_HOST");
  const portRaw = envValue("SMTP_PORT");
  const secure = parseSmtpSecure(envValue("SMTP_SECURE"));
  const user = envValue("SMTP_USER");
  const pass = process.env.SMTP_PASS;
  const from = sender();
  const port = portRaw ? Number(portRaw) : NaN;
  const missing: string[] = [];

  if (!host) missing.push("SMTP_HOST");
  if (!Number.isInteger(port) || port <= 0) missing.push("SMTP_PORT");
  if (secure === null) missing.push("SMTP_SECURE");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (!from) missing.push("EMAIL_FROM");

  if (missing.length > 0 || secure === null || !host || !user || !pass || !from) {
    return { ok: false, missing };
  }

  return { ok: true, host, port, secure, user, pass, from };
}

export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function supportAdminEmail() {
  return envValue("SUPPORT_ADMIN_EMAIL");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
}: SendEmailInput): Promise<EmailResult> {
  const recipient = to?.trim();

  if (!recipient) {
    console.warn(`[email] Skipped "${subject}": recipient is not configured.`);
    return { sent: false, skipped: true, reason: "Recipient missing" };
  }

  const config = smtpConfig();

  if (!config.ok) {
    console.warn(
      `[email] Skipped "${subject}" to ${recipient}: missing or invalid SMTP env (${config.missing.join(", ")}).`,
    );
    return { sent: false, skipped: true, reason: "SMTP configuration missing" };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const result = await transporter.sendMail({
    from: config.from,
    to: recipient,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  console.info(
    `[email] Sent "${subject}" to ${recipient} via SMTP${result.messageId ? ` (${result.messageId})` : ""}.`,
  );

  return { sent: true, provider: "smtp", messageId: result.messageId };
}
