import "server-only";

import { appBaseUrl, escapeHtml, sendTransactionalEmail } from "@/lib/server/email";
import { logApiError } from "@/lib/server/api-logger";
import {
  getNotificationDeliveryState,
  logNotificationEmailDecision,
} from "@/lib/server/notification-delivery";
import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ReviewNotificationRow = {
  id: string;
  professional_id: string;
  customer_id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
};

function fullName(profile: ProfileRow | null | undefined, fallback = "Utente") {
  const name = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  return name || fallback;
}

async function loadProfiles(service: ServiceClient, userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await service
    .from("profiles")
    .select("id, email, first_name, last_name")
    .in("id", ids);

  if (error) {
    logApiError("REVIEW NOTIFICATION ERROR", {
      query: "profiles select review notification recipients",
      user_ids: ids,
      error,
    });
    return new Map<string, ProfileRow>();
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile as ProfileRow]));
}

async function ensureNotification({
  service,
  recipientId,
  actorId,
  type,
  entityId,
  legacyTypes = [],
}: {
  service: ServiceClient;
  recipientId: string;
  actorId: string;
  type: string;
  entityId: string;
  legacyTypes?: string[];
}) {
  const notificationTypes = Array.from(new Set([type, ...legacyTypes]));
  const { data: existingNotifications, error: existingNotificationError } = await service
    .from("notifications")
    .select("id, type")
    .eq("recipient_id", recipientId)
    .eq("actor_id", actorId)
    .eq("entity_type", "review")
    .eq("entity_id", entityId)
    .in("type", notificationTypes)
    .limit(1);

  if (existingNotificationError) {
    logApiError("REVIEW NOTIFICATION ERROR", {
      query: "notifications select existing review notification",
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      entity_id: entityId,
      error: existingNotificationError,
    });
  }

  const existingNotification = existingNotifications?.[0] as
    | { id: string; type: string }
    | undefined;
  if (existingNotification?.id) {
    if (existingNotification.type !== type) {
      const { error } = await service
        .from("notifications")
        .update({ type })
        .eq("id", existingNotification.id);

      if (error) {
        logApiError("REVIEW NOTIFICATION ERROR", {
          query: "notifications normalize legacy review notification type",
          notification_id: existingNotification.id,
          from_type: existingNotification.type,
          to_type: type,
          error,
        });
      }
    }

    return true;
  }

  const { error } = await service.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    entity_type: "review",
    entity_id: entityId,
  });

  if (error) {
    logApiError("REVIEW NOTIFICATION ERROR", {
      query: "notifications insert review notification",
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      entity_id: entityId,
      error,
    });
    return false;
  }

  return true;
}

function reviewTitleLine(review: ReviewNotificationRow) {
  return review.title?.trim() ? `Titolo: ${review.title.trim()}` : null;
}

function reviewBodyLine(review: ReviewNotificationRow) {
  return review.body?.trim() ? `Testo: ${review.body.trim()}` : null;
}

export async function notifyReviewReceived({
  service,
  review,
}: {
  service: ServiceClient;
  review: ReviewNotificationRow;
}) {
  try {
    await ensureNotification({
      service,
      recipientId: review.professional_id,
      actorId: review.customer_id,
      type: "review_received",
      legacyTypes: ["review_created"],
      entityId: review.id,
    });

    const deliveryState = await getNotificationDeliveryState({
      service,
      recipientId: review.professional_id,
      recipientType: "professional",
    });
    if (!deliveryState.emailRequired) {
      logNotificationEmailDecision({
        scope: "reviews.review_received",
        state: deliveryState,
      });
      return;
    }

    const profiles = await loadProfiles(service, [
      review.customer_id,
      review.professional_id,
    ]);
    const customer = profiles.get(review.customer_id) ?? null;
    const professional = profiles.get(review.professional_id) ?? null;
    const customerName = fullName(customer, "Un cliente");
    const professionalName = fullName(professional, "ciao");
    const href = `${appBaseUrl()}/professionista/profilo?tab=reviews&review=${encodeURIComponent(review.id)}`;
    const optionalLines = [reviewTitleLine(review), reviewBodyLine(review)].filter(
      Boolean,
    ) as string[];

    const emailResult = await sendTransactionalEmail({
      to: professional?.email,
      subject: "Hai ricevuto una nuova recensione",
      text: [
        `Ciao ${professionalName},`,
        "",
        `${customerName} ti ha lasciato una recensione.`,
        `Valutazione: ${review.rating}/5`,
        ...optionalLines,
        "",
        `Apri la sezione recensioni: ${href}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#141b2c">
          <h2 style="color:#002654">Nuova recensione</h2>
          <p>Ciao ${escapeHtml(professionalName)},</p>
          <p><strong>${escapeHtml(customerName)}</strong> ti ha lasciato una recensione.</p>
          <p><strong>Valutazione:</strong> ${review.rating}/5</p>
          ${
            review.title?.trim()
              ? `<p><strong>Titolo:</strong> ${escapeHtml(review.title.trim())}</p>`
              : ""
          }
          ${
            review.body?.trim()
              ? `<p><strong>Testo:</strong> ${escapeHtml(review.body.trim())}</p>`
              : ""
          }
          <p>
            <a href="${escapeHtml(href)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">
              Apri recensioni
            </a>
          </p>
        </div>
      `,
    });
    logNotificationEmailDecision({
      scope: "reviews.review_received",
      state: deliveryState,
      emailResult,
    });
  } catch (error) {
    console.error("[reviews] Failed to notify review received", {
      review_id: review.id,
      professional_id: review.professional_id,
      customer_id: review.customer_id,
      error,
      message: error instanceof Error ? error.message : null,
      stack: error instanceof Error ? error.stack : null,
    });
  }
}

export async function notifyReviewReplied({
  service,
  review,
  replyBody,
}: {
  service: ServiceClient;
  review: ReviewNotificationRow;
  replyBody: string;
}) {
  try {
    await ensureNotification({
      service,
      recipientId: review.customer_id,
      actorId: review.professional_id,
      type: "review_replied",
      entityId: review.id,
    });

    const deliveryState = await getNotificationDeliveryState({
      service,
      recipientId: review.customer_id,
      recipientType: "customer",
    });
    if (!deliveryState.emailRequired) {
      logNotificationEmailDecision({
        scope: "reviews.review_replied",
        state: deliveryState,
      });
      return;
    }

    const profiles = await loadProfiles(service, [
      review.customer_id,
      review.professional_id,
    ]);
    const customer = profiles.get(review.customer_id) ?? null;
    const professional = profiles.get(review.professional_id) ?? null;
    const customerName = fullName(customer, "ciao");
    const professionalName = fullName(professional, "Il professionista");
    const href = `${appBaseUrl()}/professionisti/${encodeURIComponent(review.professional_id)}?tab=reviews&review=${encodeURIComponent(review.id)}`;

    const emailResult = await sendTransactionalEmail({
      to: customer?.email,
      subject: "Il professionista ha risposto alla tua recensione",
      text: [
        `Ciao ${customerName},`,
        "",
        `${professionalName} ha risposto alla tua recensione.`,
        "",
        `Risposta: ${replyBody}`,
        review.title?.trim() ? `Recensione: ${review.title.trim()}` : "",
        "",
        `Apri la sezione recensioni: ${href}`,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#141b2c">
          <h2 style="color:#002654">Risposta alla recensione</h2>
          <p>Ciao ${escapeHtml(customerName)},</p>
          <p><strong>${escapeHtml(professionalName)}</strong> ha risposto alla tua recensione.</p>
          <p><strong>Risposta:</strong> ${escapeHtml(replyBody)}</p>
          ${
            review.title?.trim()
              ? `<p><strong>Recensione:</strong> ${escapeHtml(review.title.trim())}</p>`
              : ""
          }
          <p>
            <a href="${escapeHtml(href)}" style="display:inline-block;background:#FF8500;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">
              Apri recensione
            </a>
          </p>
        </div>
      `,
    });
    logNotificationEmailDecision({
      scope: "reviews.review_replied",
      state: deliveryState,
      emailResult,
    });
  } catch (error) {
    console.error("[reviews] Failed to notify review reply", {
      review_id: review.id,
      professional_id: review.professional_id,
      customer_id: review.customer_id,
      error,
      message: error instanceof Error ? error.message : null,
      stack: error instanceof Error ? error.stack : null,
    });
  }
}
