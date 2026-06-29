import "server-only";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailResult =
  | { sent: true; provider: "resend" }
  | { sent: false; skipped: true; reason: string };

function sender() {
  const fromEmail =
    process.env.MAIL_FROM_EMAIL ??
    process.env.SMTP_FROM_EMAIL ??
    "info@iltecnicodifiducia.it";
  const fromName = process.env.MAIL_FROM_NAME ?? "Il Tecnico di Fiducia";

  return `${fromName} <${fromEmail}>`;
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
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn(
      `[email] Skipped "${subject}" to ${to}: RESEND_API_KEY is not configured.`,
    );
    return { sent: false, skipped: true, reason: "RESEND_API_KEY missing" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: sender(),
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Email provider error (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return { sent: true, provider: "resend" };
}
