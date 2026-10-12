import "server-only";

import {
  appBaseUrl,
  emailReplyTo,
  escapeHtml,
  sendTransactionalEmail,
  supportAdminEmail,
} from "@/lib/server/email";
import {
  generateGuestAccessToken,
  guestTicketUrl,
} from "@/lib/server/guest-support";
import type { AdminUserSummary } from "@/lib/server/admin-user-summaries";

type TicketEmailData = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  updated_at?: string;
};

function fullName(user: Pick<AdminUserSummary, "first_name" | "last_name" | "email">) {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email;
}

export function ticketStatusLabel(status: string) {
  if (status === "waiting") return "In attesa";
  if (status === "closed") return "Risolto";
  return "Aperto";
}

function roleLabel(role: string) {
  if (role === "professional") return "Professionista";
  if (role === "admin") return "Admin";
  return "Cliente";
}

export async function sendSupportTicketCreatedEmail({
  ticket,
  author,
}: {
  ticket: TicketEmailData;
  author: AdminUserSummary;
}) {
  const adminUrl = `${appBaseUrl()}/admin/supporto`;
  const createdAt = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ticket.created_at));

  return sendTransactionalEmail({
    to: supportAdminEmail(),
    subject: "Nuovo ticket supporto ricevuto",
    text: [
      "Nuovo ticket supporto ricevuto",
      "",
      `Utente: ${fullName(author)}`,
      `Email: ${author.email}`,
      `Ruolo: ${roleLabel(author.role)}`,
      `Oggetto: ${ticket.subject}`,
      `Testo: ${ticket.body}`,
      `Data invio: ${createdAt}`,
      `Apri supporto admin: ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Nuovo ticket supporto ricevuto</h2>
        <p><strong>Utente:</strong> ${escapeHtml(fullName(author))}</p>
        <p><strong>Email:</strong> ${escapeHtml(author.email)}</p>
        <p><strong>Ruolo:</strong> ${escapeHtml(roleLabel(author.role))}</p>
        <p><strong>Oggetto:</strong> ${escapeHtml(ticket.subject)}</p>
        <p><strong>Testo:</strong><br>${escapeHtml(ticket.body).replaceAll("\n", "<br>")}</p>
        <p><strong>Data invio:</strong> ${escapeHtml(createdAt)}</p>
        <p>
          <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">
            Apri supporto admin
          </a>
        </p>
      </div>
    `,
  });
}

export async function sendSupportTicketReplyEmail({
  ticket,
  author,
  replyBody,
}: {
  ticket: TicketEmailData;
  author: AdminUserSummary;
  replyBody: string;
}) {
  const supportUrl =
    author.role === "professional"
      ? `${appBaseUrl()}/professionista/supporto`
      : `${appBaseUrl()}/customer`;

  return sendTransactionalEmail({
    to: author.email,
    replyTo: emailReplyTo(),
    subject: "Risposta al tuo ticket - Il Tecnico di Fiducia",
    text: [
      `Ciao ${fullName(author)},`,
      "",
      `Abbiamo risposto al tuo ticket: ${ticket.subject}`,
      "",
      replyBody,
      "",
      `Stato ticket: ${ticketStatusLabel(ticket.status)}`,
      `Apri supporto: ${supportUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Risposta al tuo ticket</h2>
        <p>Ciao ${escapeHtml(fullName(author))},</p>
        <p>Abbiamo risposto al tuo ticket: <strong>${escapeHtml(ticket.subject)}</strong></p>
        <div style="background:#f1f3ff;border-radius:16px;padding:16px;margin:16px 0">
          ${escapeHtml(replyBody).replaceAll("\n", "<br>")}
        </div>
        <p><strong>Stato ticket:</strong> ${escapeHtml(ticketStatusLabel(ticket.status))}</p>
        <p>
          <a href="${escapeHtml(supportUrl)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">
            Apri supporto
          </a>
        </p>
      </div>
    `,
  });
}

export async function sendSupportTicketResolvedEmail({
  ticket,
  author,
}: {
  ticket: TicketEmailData;
  author: AdminUserSummary;
}) {
  const supportUrl =
    author.role === "professional"
      ? `${appBaseUrl()}/professionista/supporto`
      : `${appBaseUrl()}/customer`;

  return sendTransactionalEmail({
    to: author.email,
    replyTo: emailReplyTo(),
    subject: "Ticket risolto - Il Tecnico di Fiducia",
    text: [
      `Ciao ${fullName(author)},`,
      "",
      `Il tuo ticket "${ticket.subject}" è stato segnato come risolto.`,
      `Apri supporto: ${supportUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Ticket risolto</h2>
        <p>Ciao ${escapeHtml(fullName(author))},</p>
        <p>Il tuo ticket <strong>${escapeHtml(ticket.subject)}</strong> è stato segnato come risolto.</p>
        <p>
          <a href="${escapeHtml(supportUrl)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">
            Apri supporto
          </a>
        </p>
      </div>
    `,
  });
}

export async function sendSupportTicketUserReplyEmail({
  ticket,
  author,
  replyBody,
}: {
  ticket: TicketEmailData;
  author: AdminUserSummary;
  replyBody: string;
}) {
  const adminUrl = `${appBaseUrl()}/admin/supporto?ticket=${ticket.id}`;
  const repliedAt = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return sendTransactionalEmail({
    to: supportAdminEmail(),
    subject: "Nuova risposta a un ticket supporto",
    text: [
      "Nuova risposta a un ticket supporto",
      "",
      `Utente: ${fullName(author)}`,
      `Email: ${author.email}`,
      `Ruolo: ${roleLabel(author.role)}`,
      `Oggetto ticket: ${ticket.subject}`,
      `Risposta: ${replyBody}`,
      `Data: ${repliedAt}`,
      `Apri supporto admin: ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Nuova risposta a un ticket supporto</h2>
        <p><strong>Utente:</strong> ${escapeHtml(fullName(author))}</p>
        <p><strong>Email:</strong> ${escapeHtml(author.email)}</p>
        <p><strong>Ruolo:</strong> ${escapeHtml(roleLabel(author.role))}</p>
        <p><strong>Oggetto ticket:</strong> ${escapeHtml(ticket.subject)}</p>
        <div style="background:#f1f3ff;border-radius:16px;padding:16px;margin:16px 0">
          ${escapeHtml(replyBody).replaceAll("\n", "<br>")}
        </div>
        <p><strong>Data:</strong> ${escapeHtml(repliedAt)}</p>
        <p>
          <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">
            Apri supporto admin
          </a>
        </p>
      </div>
    `,
  });
}


export async function sendGuestSupportTicketReplyEmail({
  ticket,
  replyBody,
}: {
  ticket: TicketEmailData & {
    guest_first_name: string | null;
    guest_last_name: string | null;
    guest_email: string;
  };
  replyBody: string;
}) {
  const token = generateGuestAccessToken(ticket.id);
  const supportUrl = guestTicketUrl({
    ticketId: ticket.id,
    token,
  });

  const guestName =
    `${ticket.guest_first_name ?? ""} ${ticket.guest_last_name ?? ""}`.trim() ||
    "Utente";

  return sendTransactionalEmail({
    to: ticket.guest_email,
    replyTo: emailReplyTo(),
    subject: "Risposta al tuo ticket - Il Tecnico di Fiducia",
    text: [
      `Ciao ${guestName},`,
      "",
      `Abbiamo risposto al tuo ticket: ${ticket.subject.replace(/^Contatto pubblico:\s*/i, "")}`,
      "",
      replyBody,
      "",
      `Stato ticket: ${ticketStatusLabel(ticket.status)}`,
      `Visualizza risposta: ${supportUrl}`,
      "",
      "Questa casella email non è destinata alla ricezione delle risposte. Usa il pulsante/link del ticket per continuare la conversazione.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Abbiamo risposto al tuo ticket</h2>
        <p>Ciao ${escapeHtml(guestName)},</p>
        <p>
          Abbiamo risposto alla tua richiesta:
          <strong>${escapeHtml(ticket.subject.replace(/^Contatto pubblico:\s*/i, ""))}</strong>
        </p>

        <div style="background:#f1f3ff;border-radius:16px;padding:16px;margin:16px 0">
          ${escapeHtml(replyBody).replaceAll("\n", "<br>")}
        </div>

        <p><strong>Stato ticket:</strong> ${escapeHtml(ticketStatusLabel(ticket.status))}</p>

        <p style="margin:24px 0">
          <a
            href="${escapeHtml(supportUrl)}"
            style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:13px 22px;font-weight:700"
          >
            Visualizza risposta
          </a>
        </p>

        <p style="font-size:14px;color:#526070">
          Per rispondere utilizza il ticket. Questa casella email non è destinata alla ricezione dei messaggi.
        </p>
      </div>
    `,
  });
}


export async function sendGuestSupportTicketResolvedEmail({
  ticket,
  replyBody,
}: {
  ticket: TicketEmailData & {
    guest_first_name: string | null;
    guest_last_name: string | null;
    guest_email: string;
  };
  replyBody?: string;
}) {
  const token = generateGuestAccessToken(ticket.id);
  const supportUrl = guestTicketUrl({
    ticketId: ticket.id,
    token,
  });

  const guestName =
    `${ticket.guest_first_name ?? ""} ${ticket.guest_last_name ?? ""}`.trim() ||
    "Utente";

  const cleanSubject = ticket.subject.replace(/^Contatto pubblico:\s*/i, "");

  return sendTransactionalEmail({
    to: ticket.guest_email,
    replyTo: emailReplyTo(),
    subject: "Ticket risolto - Il Tecnico di Fiducia",
    text: [
      `Ciao ${guestName},`,
      "",
      `Il tuo ticket "${cleanSubject}" è stato segnato come risolto.`,
      ...(replyBody
        ? ["", "Ultima risposta dell'assistenza:", replyBody]
        : []),
      "",
      "Puoi continuare a consultare la conversazione, ma il ticket non accetta più nuove risposte.",
      `Rivedi cronologia ticket: ${supportUrl}`,
      "",
      "Questa casella email non è destinata alla ricezione dei messaggi.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Ticket risolto</h2>

        <p>Ciao ${escapeHtml(guestName)},</p>

        <p>
          Il tuo ticket
          <strong>${escapeHtml(cleanSubject)}</strong>
          è stato segnato come risolto.
        </p>

        ${
          replyBody
            ? `
              <p><strong>Ultima risposta dell'assistenza:</strong></p>
              <div style="background:#f1f3ff;border-radius:16px;padding:16px;margin:16px 0">
                ${escapeHtml(replyBody).replaceAll("\n", "<br>")}
              </div>
            `
            : ""
        }

        <p>
          Puoi continuare a consultare la conversazione, ma non è più possibile
          inviare nuove risposte.
        </p>

        <p style="margin:24px 0">
          <a
            href="${escapeHtml(supportUrl)}"
            style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:13px 22px;font-weight:700"
          >
            Rivedi cronologia ticket
          </a>
        </p>

        <p style="font-size:14px;color:#526070">
          Questa casella email non è destinata alla ricezione dei messaggi.
        </p>
      </div>
    `,
  });
}
