import "server-only";

import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string | null | undefined;
  replyTo?: string | null | undefined;
  subject: string;
  text: string;
  html?: string;
};

type EmailResult =
  | {
      sent: true;
      provider: "smtp";
      messageId?: string;
      accepted?: string[];
      rejected?: string[];
      envelope?: SanitizedEnvelope | null;
      response?: string | null;
    }
  | { sent: false; skipped: true; reason: string }
  | {
      sent: false;
      skipped: false;
      reason: string;
      messageId?: string;
      accepted?: string[];
      rejected?: string[];
      envelope?: SanitizedEnvelope | null;
      response?: string | null;
    };

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

type SmtpErrorDetails = {
  name: string | null;
  message: string | null;
  code: string | null;
  command: string | null;
  responseCode: string | number | null;
  response: string | null;
};

type SanitizedEnvelope = {
  from: string | null;
  to: string[];
};

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
  const user = envValue("SMTP_USER");
  const pass = process.env.SMTP_PASS;
  const from = sender();
  const port = portRaw ? Number(portRaw) : NaN;
  const secureFromEnv = parseSmtpSecure(envValue("SMTP_SECURE"));
  const secure = port === 465 ? true : secureFromEnv;
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

function safeLogValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
}

function smtpEnvSummary(recipientPresent: boolean) {
  const portRaw = envValue("SMTP_PORT");
  const port = portRaw ? Number(portRaw) : null;
  const secureFromEnv = parseSmtpSecure(envValue("SMTP_SECURE"));
  const secure = port === 465 ? true : secureFromEnv;

  return {
    smtp_host_present: Boolean(envValue("SMTP_HOST")),
    smtp_port: Number.isInteger(port) && port && port > 0 ? port : null,
    smtp_secure: secure,
    smtp_user_present: Boolean(envValue("SMTP_USER")),
    smtp_pass_present: Boolean(process.env.SMTP_PASS),
    email_from_present: Boolean(sender()),
    support_admin_email_present: Boolean(supportAdminEmail()),
    recipient_present: recipientPresent,
  };
}

export function maskEmailForLog(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.match(/<([^<>@\s]+@[^<>@\s]+)>/)?.[1] ?? value;
  const [, domain] = candidate.trim().split("@");
  return domain ? `***@${domain}` : "***";
}

function sanitizeMailList(value: unknown) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return list.map(maskEmailForLog).filter((email): email is string => Boolean(email));
}

function sanitizeEnvelope(value: unknown): SanitizedEnvelope | null {
  if (!value || typeof value !== "object") return null;

  const envelope = value as Record<string, unknown>;

  return {
    from: maskEmailForLog(envelope.from),
    to: sanitizeMailList(envelope.to),
  };
}

function mailListContains(value: unknown, recipient: string) {
  const recipientNormalized = recipient.trim().toLowerCase();
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];

  return list.some(
    (email) =>
      typeof email === "string" &&
      email.trim().toLowerCase() === recipientNormalized,
  );
}

function smtpErrorDetails(error: unknown): SmtpErrorDetails {
  if (!error || typeof error !== "object") {
    return {
      name: null,
      message: typeof error === "string" ? error : null,
      code: null,
      command: null,
      responseCode: null,
      response: null,
    };
  }

  const record = error as Record<string, unknown>;
  const responseCode = safeLogValue(record.responseCode);

  return {
    name:
      error instanceof Error
        ? error.name
        : (safeLogValue(record.name) as string | null),
    message:
      error instanceof Error
        ? error.message
        : (safeLogValue(record.message) as string | null),
    code: safeLogValue(record.code)?.toString() ?? null,
    command: safeLogValue(record.command)?.toString() ?? null,
    responseCode: typeof responseCode === "boolean" ? null : responseCode,
    response: safeLogValue(record.response)?.toString() ?? null,
  };
}

function smtpFailurePhase(details: SmtpErrorDetails) {
  const code = details.code?.toUpperCase() ?? "";
  const command = details.command?.toUpperCase() ?? "";
  const responseCode =
    typeof details.responseCode === "number"
      ? details.responseCode
      : Number(details.responseCode);

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS";
  if (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNECTION" ||
    code === "ESOCKET"
  ) {
    return "connessione";
  }
  if (code === "ETLS" || command === "STARTTLS") return "TLS";
  if (
    code === "EAUTH" ||
    command === "AUTH" ||
    responseCode === 530 ||
    responseCode === 534 ||
    responseCode === 535
  ) {
    return "autenticazione";
  }

  return "invio";
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

export function configuredEmailFrom() {
  return sender();
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
  replyTo,
  subject,
  text,
  html,
}: SendEmailInput): Promise<EmailResult> {
  const recipient = to?.trim();
  const replyToAddress = replyTo?.trim() || null;
  const logContext = {
    subject,
    ...smtpEnvSummary(Boolean(recipient)),
    from_masked: maskEmailForLog(sender()),
    reply_to_present: Boolean(replyToAddress),
    reply_to_masked: maskEmailForLog(replyToAddress),
  };

  if (!recipient) {
    console.warn("[email] Skipped send: recipient is not configured.", logContext);
    return { sent: false, skipped: true, reason: "Recipient missing" };
  }

  const config = smtpConfig();

  if (!config.ok) {
    console.warn("[email] Skipped send: missing or invalid SMTP env.", {
      ...logContext,
      missing: config.missing,
    });
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

  try {
    const verified = await transporter.verify();
    console.info("[email] SMTP verify result", {
      ...logContext,
      verified,
    });
  } catch (error) {
    const details = smtpErrorDetails(error);
    console.error("[email] SMTP verify failed", {
      ...logContext,
      phase: smtpFailurePhase(details),
      error: details,
    });
    throw error;
  }

  try {
    const result = await transporter.sendMail({
      from: config.from,
      to: recipient,
      ...(replyToAddress ? { replyTo: replyToAddress } : {}),
      subject,
      text,
      ...(html ? { html } : {}),
    });

    const accepted = sanitizeMailList(result.accepted);
    const rejected = sanitizeMailList(result.rejected);
    const envelope = sanitizeEnvelope(result.envelope);
    const response = result.response ?? null;
    const acceptedContainsRecipient = mailListContains(result.accepted, recipient);
    const deliveryCompleted =
      acceptedContainsRecipient && sanitizeMailList(result.rejected).length === 0;

    console.info("[email] SMTP sendMail result", {
      ...logContext,
      messageId: result.messageId ?? null,
      accepted,
      rejected,
      envelope,
      response,
      accepted_count: accepted.length,
      rejected_count: rejected.length,
      accepted_contains_recipient: acceptedContainsRecipient,
      delivery_completed: deliveryCompleted,
    });

    if (!deliveryCompleted) {
      return {
        sent: false,
        skipped: false,
        reason: "SMTP recipient was not accepted",
        messageId: result.messageId,
        accepted,
        rejected,
        envelope,
        response,
      };
    }

    return {
      sent: true,
      provider: "smtp",
      messageId: result.messageId,
      accepted,
      rejected,
      envelope,
      response,
    };
  } catch (error) {
    const details = smtpErrorDetails(error);
    console.error("[email] SMTP sendMail failed", {
      ...logContext,
      phase: smtpFailurePhase(details),
      error: details,
    });
    throw error;
  }
}
