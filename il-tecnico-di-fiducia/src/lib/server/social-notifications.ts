import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

type SocialNotificationInput = {
  recipientId: string | null | undefined;
  actorId: string;
  type: "follow_started" | "post_liked" | "post_commented";
  entityType: "professional" | "post";
  entityId: string;
  dedupe?: "always" | "recent";
};

export async function ensureSocialNotification({
  recipientId,
  actorId,
  type,
  entityType,
  entityId,
  dedupe = "always",
}: SocialNotificationInput) {
  if (!recipientId || recipientId === actorId) return;

  const service = createServiceClient();
  let existingQuery = service
    .from("notifications")
    .select("id")
    .eq("recipient_id", recipientId)
    .eq("actor_id", actorId)
    .eq("type", type)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1);

  if (dedupe === "recent") {
    existingQuery = existingQuery.gte(
      "created_at",
      new Date(Date.now() - 10_000).toISOString(),
    );
  }

  const { data: existing, error: lookupError } = await existingQuery;
  if (lookupError) {
    console.error("[notifications] Failed to check existing social notification", lookupError);
    return;
  }

  if ((existing ?? []).length > 0) return;

  const { error } = await service.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    entity_type: entityType,
    entity_id: entityId,
  });

  if (error) {
    console.error("[notifications] Failed to create social notification", error);
  }
}
