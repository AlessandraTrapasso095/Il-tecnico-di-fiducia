import { NextResponse } from "next/server";

import { isNonEmptyString } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import {
  appBaseUrl,
  escapeHtml,
  sendTransactionalEmail,
  supportAdminEmail,
} from "@/lib/server/email";
import { createServiceClient } from "@/lib/supabase/service";

type PublicContactPayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  subject?: string;
  body?: string;
};

type AdminProfileRow = {
  id: string;
  role: "admin";
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
  must_change_password: boolean;
  is_banned: boolean;
  suspended_until: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 180;
const MAX_SUBJECT_LENGTH = 160;
const MAX_BODY_LENGTH = 5000;
const PUBLIC_CONTACT_SOURCE = "public_contact";
const PUBLIC_CONTACT_ADMIN_EMAIL = "admin@iltecnicodifiducia.it";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeBody(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_BODY_LENGTH);
}

function publicTicketBody({
  firstName,
  lastName,
  email,
  subject,
  body,
}: {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  body: string;
}) {
  return [
    "Richiesta pubblica ricevuta dal form Contattaci.",
    `Origine: ${PUBLIC_CONTACT_SOURCE}`,
    "",
    `Nome: ${firstName}`,
    `Cognome: ${lastName}`,
    `Email: ${email}`,
    `Titolo: ${subject}`,
    "",
    "Messaggio:",
    body,
  ].join("\n");
}

function fullName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  return `${firstName} ${lastName}`.trim();
}

function emailDomain(email: string) {
  return email.split("@")[1] ?? null;
}

function logPublicContact(message: string, context: Record<string, unknown>) {
  console.info(`PUBLIC_CONTACT ${message}`, context);
}

function publicContactEmail({
  ticket,
  firstName,
  lastName,
  email,
  subject,
  body,
}: {
  ticket: {
    id: string;
    subject: string;
    created_at: string;
  };
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  body: string;
}) {
  const adminUrl = `${appBaseUrl()}/admin/supporto?ticket=${ticket.id}`;
  const createdAt = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ticket.created_at));
  const senderName = fullName({ firstName, lastName });

  return {
    subject: "Nuova richiesta dal form Contattaci",
    text: [
      "Nuova richiesta dal form pubblico Contattaci",
      "",
      `Nome: ${senderName}`,
      `Email: ${email}`,
      `Titolo: ${subject}`,
      `Messaggio: ${body}`,
      `Data invio: ${createdAt}`,
      `Ticket: ${ticket.id}`,
      `Apri supporto admin: ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Nuova richiesta dal form Contattaci</h2>
        <p><strong>Nome:</strong> ${escapeHtml(senderName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Titolo:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Messaggio:</strong><br>${escapeHtml(body).replaceAll("\n", "<br>")}</p>
        <p><strong>Data invio:</strong> ${escapeHtml(createdAt)}</p>
        <p><strong>Ticket:</strong> ${escapeHtml(ticket.id)}</p>
        <p>
          <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">
            Apri supporto admin
          </a>
        </p>
      </div>
    `,
  };
}

async function loadSupportAuthor() {
  const service = createServiceClient();
  const configuredEmails = Array.from(
    new Set(
      [supportAdminEmail(), PUBLIC_CONTACT_ADMIN_EMAIL]
        .map((email) => email?.toLowerCase().trim())
        .filter((email): email is string => Boolean(email)),
    ),
  );

  for (const configuredEmail of configuredEmails) {
    const { data, error } = await service
      .from("profiles")
      .select(
        "id, role, email, first_name, last_name, province_code, phone, must_change_password, is_banned, suspended_until",
      )
      .eq("role", "admin")
      .ilike("email", configuredEmail)
      .maybeSingle<AdminProfileRow>();

    if (error) {
      throw error;
    }

    if (data) {
      return { service, adminProfile: data };
    }
  }

  const { data, error } = await service
    .from("profiles")
    .select(
      "id, role, email, first_name, last_name, province_code, phone, must_change_password, is_banned, suspended_until",
    )
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<AdminProfileRow>();

  if (error) {
    throw error;
  }

  return { service, adminProfile: data };
}

export async function POST(request: Request) {
  let payload: PublicContactPayload;
  try {
    payload = (await request.json()) as PublicContactPayload;
  } catch (error) {
    logApiError("PUBLIC_CONTACT INVALID_JSON", {
      query: "request.json public contact",
      error,
    });
    return NextResponse.json({ error: "Formato richiesta non valido." }, { status: 400 });
  }

  const firstName = normalizeText(payload.first_name, MAX_NAME_LENGTH);
  const lastName = normalizeText(payload.last_name, MAX_NAME_LENGTH);
  const email = normalizeText(payload.email, MAX_EMAIL_LENGTH).toLowerCase();
  const subject = normalizeText(payload.subject, MAX_SUBJECT_LENGTH);
  const body = normalizeBody(payload.body);

  if (
    !isNonEmptyString(firstName) ||
    !isNonEmptyString(lastName) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(subject) ||
    !isNonEmptyString(body)
  ) {
    return NextResponse.json({ error: "Compila tutti i campi richiesti." }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 });
  }

  logPublicContact("REQUEST_RECEIVED", {
    has_first_name: Boolean(firstName),
    has_last_name: Boolean(lastName),
    email_domain: emailDomain(email),
    subject_length: subject.length,
    body_length: body.length,
    source: PUBLIC_CONTACT_SOURCE,
  });

  let supportAuthor;
  try {
    supportAuthor = await loadSupportAuthor();
  } catch (error) {
    logApiError("PUBLIC_CONTACT SUPPORT AUTHOR ERROR", {
      query: "profiles select support admin author",
      error,
    });
    return NextResponse.json(
      { error: "Non è stato possibile inviare la richiesta. Riprova." },
      { status: 500 },
    );
  }

  if (!supportAuthor.adminProfile) {
    logApiError("PUBLIC_CONTACT SUPPORT AUTHOR ERROR", {
      query: "profiles select first admin author",
      error: new Error("No admin profile available for public support ticket"),
    });
    return NextResponse.json(
      { error: "Non è stato possibile inviare la richiesta. Riprova." },
      { status: 500 },
    );
  }

  logPublicContact("SUPPORT_AUTHOR_RESOLVED", {
    admin_profile_id: supportAuthor.adminProfile.id,
    matched_admin_email_domain: emailDomain(supportAuthor.adminProfile.email),
    source: PUBLIC_CONTACT_SOURCE,
  });

  const ticketBody = publicTicketBody({ firstName, lastName, email, subject, body });

  const { data: ticket, error: ticketError } = await supportAuthor.service
    .from("support_tickets")
    .insert({
      author_id: supportAuthor.adminProfile.id,
      subject: `Contatto pubblico: ${subject}`,
      body: ticketBody,
      status: "open",
    })
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .single();

  if (ticketError) {
    logApiError("PUBLIC_CONTACT TICKET ERROR", {
      query: "support_tickets insert public contact",
      error: ticketError,
    });
    return NextResponse.json(
      { error: "Non è stato possibile inviare la richiesta. Riprova." },
      { status: 500 },
    );
  }

  logPublicContact("TICKET_CREATED", {
    ticket_created: true,
    ticket_id: ticket.id,
    author_id: ticket.author_id,
    status: ticket.status,
    source: PUBLIC_CONTACT_SOURCE,
  });

  let emailSent = false;
  try {
    const emailContent = publicContactEmail({
      ticket,
      firstName,
      lastName,
      email,
      subject,
      body,
    });
    const emailResult = await sendTransactionalEmail({
      to: PUBLIC_CONTACT_ADMIN_EMAIL,
      ...emailContent,
    });

    emailSent = emailResult.sent;
    logPublicContact("EMAIL_RESULT", {
      ticket_id: ticket.id,
      email_sent: emailSent,
      recipient_domain: emailDomain(PUBLIC_CONTACT_ADMIN_EMAIL),
      skipped: emailResult.sent ? false : emailResult.skipped,
      reason: emailResult.sent ? null : emailResult.reason,
      source: PUBLIC_CONTACT_SOURCE,
    });
  } catch (emailError) {
    logApiError("PUBLIC_CONTACT EMAIL ERROR", {
      query: "send public support ticket email",
      ticket_id: ticket.id,
      error: emailError,
    });
  }

  return NextResponse.json({
    ok: true,
    ticket_id: ticket.id,
    email_sent: emailSent,
  }, { status: 201 });
}
