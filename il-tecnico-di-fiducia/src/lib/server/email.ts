import "server-only";

import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailResult =
  | { sent: true; provider: "smtp"; messageId?: string }
  | { sent: false; skipped: true; reason: string };

function sender() {
  const explicitFrom = process.env.EMAIL_FROM?.trim();
  if (explicitFrom) return explicitFrom;

  const fromEmail =
    process.env.MAIL_FROM_EMAIL ??
    process.env.SMTP_FROM_EMAIL ??
    process.env.SMTP_USER ??
    "info@iltecnicodifiducia.it";
  const fromName = process.env.MAIL_FROM_NAME ?? "Il Tecnico di Fiducia";

  return `${fromName} <${fromEmail}>`;
}

function smtpSecure() {
  const value = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "no") return false;
  if (value === "true" || value === "1" || value === "yes") return true;

  return Number(process.env.SMTP_PORT ?? 465) === 465;
}

export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function supportAdminEmail() {
  return process.env.SUPPORT_ADMIN_EMAIL ?? "admin@iltecnicodifiducia.it";
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
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn(
      `[email] Skipped "${subject}" to ${to}: SMTP_USER or SMTP_PASS is not configured.`,
    );
    return { sent: false, skipped: true, reason: "SMTP credentials missing" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: smtpSecure(),
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const result = await transporter.sendMail({
    from: sender(),
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  console.info(
    `[email] Sent "${subject}" to ${to} via SMTP${result.messageId ? ` (${result.messageId})` : ""}.`,
  );

  return { sent: true, provider: "smtp", messageId: result.messageId };
}
