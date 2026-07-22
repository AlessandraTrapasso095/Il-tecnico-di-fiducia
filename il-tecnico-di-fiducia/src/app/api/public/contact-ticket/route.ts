import { NextResponse } from "next/server";

import { isNonEmptyString } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import { sendSupportTicketCreatedEmail } from "@/lib/server/support-ticket-emails";
import { supportAdminEmail } from "@/lib/server/email";
import type { AdminUserSummary } from "@/lib/server/admin-user-summaries";
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

function publicAuthorSummary({
  adminProfile,
  firstName,
  lastName,
  email,
}: {
  adminProfile: AdminProfileRow;
  firstName: string;
  lastName: string;
  email: string;
}): AdminUserSummary {
  const now = new Date().toISOString();
  return {
    id: adminProfile.id,
    role: "customer",
    email,
    first_name: firstName,
    last_name: lastName,
    province_code: null,
    phone: null,
    must_change_password: false,
    is_banned: false,
    suspended_until: null,
    created_at: now,
    updated_at: now,
    avatar_url: null,
    activity: null,
    subscription: null,
    professional_directory: null,
  };
}

async function loadSupportAuthor() {
  const service = createServiceClient();
  const configuredEmail = supportAdminEmail()?.toLowerCase() ?? null;

  if (configuredEmail) {
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
  } catch {
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

  let emailSent = false;
  try {
    await sendSupportTicketCreatedEmail({
      ticket,
      author: publicAuthorSummary({
        adminProfile: supportAuthor.adminProfile,
        firstName,
        lastName,
        email,
      }),
    });
    emailSent = true;
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
  });
}
