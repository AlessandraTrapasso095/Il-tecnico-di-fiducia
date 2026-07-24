import "server-only";

import {
  appBaseUrl,
  escapeHtml,
  sendTransactionalEmail,
  supportAdminEmail,
} from "@/lib/server/email";

export type ProfessionSuggestionEmailData = {
  id: string;
  profession_name: string;
  proposer_first_name: string;
  proposer_last_name: string;
  proposer_email: string;
  motivation: string;
  suggested_subcategories: string | null;
  amount_total: number | null;
  currency: string | null;
};

function proposerName(suggestion: ProfessionSuggestionEmailData) {
  return `${suggestion.proposer_first_name} ${suggestion.proposer_last_name}`.trim();
}

function formattedAmount(suggestion: ProfessionSuggestionEmailData) {
  if (!suggestion.amount_total || !suggestion.currency) return "Pagamento confermato";

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: suggestion.currency.toUpperCase(),
  }).format(suggestion.amount_total / 100);
}

export async function sendProfessionSuggestionAdminEmail(
  suggestion: ProfessionSuggestionEmailData,
) {
  const adminUrl = `${appBaseUrl()}/admin`;
  const subcategories =
    suggestion.suggested_subcategories?.trim() || "Non indicate";

  return sendTransactionalEmail({
    to: supportAdminEmail(),
    subject: "Nuova proposta figura professionale",
    text: [
      "Nuova proposta figura professionale",
      "",
      `Nome: ${proposerName(suggestion)}`,
      `Email: ${suggestion.proposer_email}`,
      `Professione proposta: ${suggestion.profession_name}`,
      `Sottocategorie suggerite: ${subcategories}`,
      `Motivazione: ${suggestion.motivation}`,
      `Pagamento: ${formattedAmount(suggestion)}`,
      `Apri admin: ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Nuova proposta figura professionale</h2>
        <p><strong>Nome:</strong> ${escapeHtml(proposerName(suggestion))}</p>
        <p><strong>Email:</strong> ${escapeHtml(suggestion.proposer_email)}</p>
        <p><strong>Professione proposta:</strong> ${escapeHtml(suggestion.profession_name)}</p>
        <p><strong>Sottocategorie suggerite:</strong> ${escapeHtml(subcategories)}</p>
        <p><strong>Motivazione:</strong><br>${escapeHtml(suggestion.motivation).replaceAll("\n", "<br>")}</p>
        <p><strong>Pagamento:</strong> ${escapeHtml(formattedAmount(suggestion))}</p>
        <p>
          <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">
            Apri admin
          </a>
        </p>
      </div>
    `,
  });
}

export async function sendProfessionSuggestionUserConfirmationEmail(
  suggestion: ProfessionSuggestionEmailData,
) {
  return sendTransactionalEmail({
    to: suggestion.proposer_email,
    subject: "Abbiamo ricevuto la tua proposta",
    text: [
      `Ciao ${proposerName(suggestion)},`,
      "",
      "Grazie per la tua proposta.",
      `Figura professionale indicata: ${suggestion.profession_name}`,
      "",
      "Il nostro team valuterà la figura professionale indicata e ti aggiornerà tramite email.",
      "",
      "Il Tecnico di Fiducia",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#141b2c">
        <h2 style="color:#002654">Grazie per la tua proposta</h2>
        <p>Ciao ${escapeHtml(proposerName(suggestion))},</p>
        <p>Abbiamo ricevuto la proposta per la figura professionale:</p>
        <p style="background:#f1f3ff;border-radius:16px;padding:14px 16px"><strong>${escapeHtml(suggestion.profession_name)}</strong></p>
        <p>Il nostro team valuterà la figura professionale indicata e ti aggiornerà tramite email.</p>
        <p>Il Tecnico di Fiducia</p>
      </div>
    `,
  });
}
