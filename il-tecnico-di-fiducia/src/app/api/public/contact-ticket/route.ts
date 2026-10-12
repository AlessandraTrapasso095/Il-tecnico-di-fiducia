import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { isNonEmptyString } from "@/lib/api/validation";
import { logApiError } from "@/lib/server/api-logger";
import {
  appBaseUrl,
  emailReplyTo,
  escapeHtml,
  sendTransactionalEmail,
  supportAdminEmail,
} from "@/lib/server/email";
import {
  generateGuestAccessToken,
  hashGuestAccessToken,
} from "@/lib/server/guest-support";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type PublicContactPayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  subject?: string;
  body?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 180;
const MAX_SUBJECT_LENGTH = 160;
const MAX_BODY_LENGTH = 5000;
const PUBLIC_CONTACT_SOURCE = "public_contact";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeBody(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_BODY_LENGTH);
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

function publicContactAdminEmail({
  ticket,
  firstName,
  lastName,
  email,
  subject,
  body,
}: {
  ticket: {
    id: string;
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
          <a
            href="${escapeHtml(adminUrl)}"
            style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700"
          >
            Apri supporto admin
          </a>
        </p>
      </div>
    `,
  };
}

function publicContactGuestConfirmationEmail({
  firstName,
  subject,
}: {
  firstName: string;
  subject: string;
}) {
  return {
    subject: "Richiesta ricevuta - Il Tecnico di Fiducia",
    text: [
      `Ciao ${firstName},`,
      "",
      "abbiamo ricevuto la tua richiesta di assistenza.",
      `Oggetto: ${subject}`,
      "",
      "Il nostro team la prenderà in carico e ti risponderà al più presto.",
      "",
      "Quando riceverai una risposta, ti invieremo un'email con il pulsante per aprire il ticket e continuare la conversazione.",
      "",
      "Questa casella email non è destinata alla ricezione delle risposte.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Abbiamo ricevuto la tua richiesta</h2>

        <p>Ciao ${escapeHtml(firstName)},</p>

        <p>
          abbiamo ricevuto la tua richiesta di assistenza relativa a
          <strong>${escapeHtml(subject)}</strong>.
        </p>

        <p>
          Il nostro team la prenderà in carico e ti risponderà al più presto.
        </p>

        <p>
          Quando riceverai una risposta, ti invieremo un'email con il pulsante
          per aprire il ticket e continuare la conversazione.
        </p>

        <p style="font-size:14px;color:#526070">
          Questa casella email non è destinata alla ricezione delle risposte.
        </p>
      </div>
    `,
  };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipLimited = await enforceRateLimit({
    key: `v1:public-contact:ip:${ip}`,
    maxHits: 5,
    windowSeconds: 300,
    errorMessage: "Troppe richieste. Riprova tra qualche minuto.",
  });

  if (ipLimited) {
    return ipLimited;
  }

  let payload: PublicContactPayload;

  try {
    payload = (await request.json()) as PublicContactPayload;
  } catch (error) {
    logApiError("PUBLIC_CONTACT INVALID_JSON", {
      query: "request.json public contact",
      error,
    });

    return NextResponse.json(
      { error: "Formato richiesta non valido." },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: "Compila tutti i campi richiesti." },
      { status: 400 },
    );
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Inserisci un indirizzo email valido." },
      { status: 400 },
    );
  }

  const emailHash = await hashRateLimitId(`email:${email}`);
  const emailLimited = await enforceRateLimit({
    key: `v1:public-contact:email:${emailHash}`,
    maxHits: 3,
    windowSeconds: 900,
    errorMessage:
      "Troppe richieste per questo indirizzo email. Riprova più tardi.",
  });

  if (emailLimited) {
    return emailLimited;
  }

  logPublicContact("REQUEST_RECEIVED", {
    has_first_name: Boolean(firstName),
    has_last_name: Boolean(lastName),
    email_domain: emailDomain(email),
    subject_length: subject.length,
    body_length: body.length,
    source: PUBLIC_CONTACT_SOURCE,
  });

  const service = createServiceClient();

  const ticketId = randomUUID();
  const guestToken = generateGuestAccessToken(ticketId);
  const guestTokenHash = hashGuestAccessToken(guestToken);
  const accessCreatedAt = new Date().toISOString();

  const { data: ticket, error: ticketError } = await service
    .from("support_tickets")
    .insert({
      id: ticketId,
      author_id: null,
      guest_first_name: firstName,
      guest_last_name: lastName,
      guest_email: email,
      guest_access_token_hash: guestTokenHash,
      guest_access_created_at: accessCreatedAt,
      subject: `Contatto pubblico: ${subject}`,
      body,
      status: "open",
    })
    .select(
      "id, author_id, guest_first_name, guest_last_name, guest_email, subject, body, status, created_at, updated_at",
    )
    .single();

  if (ticketError) {
    logApiError("PUBLIC_CONTACT TICKET ERROR", {
      query: "support_tickets insert guest public contact",
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
    guest_ticket: true,
    status: ticket.status,
    source: PUBLIC_CONTACT_SOURCE,
  });

  let adminEmailSent = false;
  let guestEmailSent = false;

  try {
    const adminRecipient = supportAdminEmail();

    const adminEmail = publicContactAdminEmail({
      ticket,
      firstName,
      lastName,
      email,
      subject,
      body,
    });

    const result = await sendTransactionalEmail({
      to: adminRecipient,
      ...adminEmail,
    });

    adminEmailSent = result.sent;
  } catch (emailError) {
    logApiError("PUBLIC_CONTACT ADMIN EMAIL ERROR", {
      query: "send public support admin notification",
      ticket_id: ticket.id,
      error: emailError,
    });
  }

  try {
    const confirmationEmail = publicContactGuestConfirmationEmail({
      firstName,
      subject,
    });

    const result = await sendTransactionalEmail({
      to: email,
      replyTo: emailReplyTo(),
      ...confirmationEmail,
    });

    guestEmailSent = result.sent;
  } catch (emailError) {
    logApiError("PUBLIC_CONTACT GUEST EMAIL ERROR", {
      query: "send public support guest confirmation",
      ticket_id: ticket.id,
      recipient_domain: emailDomain(email),
      error: emailError,
    });
  }

  logPublicContact("DELIVERY_RESULT", {
    ticket_id: ticket.id,
    admin_email_sent: adminEmailSent,
    guest_email_sent: guestEmailSent,
    source: PUBLIC_CONTACT_SOURCE,
  });

  return NextResponse.json(
    {
      ok: true,
      ticket_id: ticket.id,
      confirmation_email_sent: guestEmailSent,
    },
    { status: 201 },
  );
}
