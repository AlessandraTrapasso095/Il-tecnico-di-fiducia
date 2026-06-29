import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt } from "@/lib/api/validation";
import { createServiceClient } from "@/lib/supabase/service";

type MarkReadPayload = {
  ids: string[];
};

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
};

function notificationHref(notification: NotificationRow, recipientRole: string) {
  if (notification.type === "follow_started" && notification.actor_id) {
    return `/professionisti/${notification.actor_id}`;
  }

  if (
    (notification.type === "post_commented" || notification.type === "post_liked") &&
    notification.entity_type === "post" &&
    notification.entity_id
  ) {
    return `/professionista#post-${notification.entity_id}`;
  }

  if (notification.entity_type === "contact_request") {
    return "/professionista/messaggi";
  }

  if (notification.entity_type === "review") {
    return "/professionista/profilo";
  }

  if (notification.entity_type === "support_ticket") {
    return recipientRole === "professional" ? "/professionista/supporto" : "/customer";
  }

  return recipientRole === "professional" ? "/professionista" : "/customer";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const limit = clampInt(request.nextUrl.searchParams.get("limit"), 50, 1, 200);
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";

  let builder = supabase
    .from("notifications")
    .select("id, recipient_id, actor_id, type, entity_type, entity_id, created_at, read_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    builder = builder.is("read_at", null);
  }

  const { data, error } = await builder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }

  const notifications = (data ?? []) as NotificationRow[];
  const actorIds = Array.from(
    new Set(notifications.map((notification) => notification.actor_id).filter(Boolean)),
  ) as string[];

  const service = createServiceClient();
  const [{ data: actors }, { data: professionalAvatars }] =
    actorIds.length > 0
      ? await Promise.all([
          service
            .from("profiles")
            .select("id, role, first_name, last_name")
            .in("id", actorIds),
          service
            .from("professional_profiles")
            .select("id, avatar_url")
            .in("id", actorIds),
        ])
      : [{ data: [] }, { data: [] }];

  const avatarByActorId = new Map(
    (professionalAvatars ?? []).map((actor) => [actor.id, actor.avatar_url]),
  );
  const actorsById = new Map(
    (actors ?? []).map((actor) => [
      actor.id,
      {
        id: actor.id,
        role: actor.role,
        first_name: actor.first_name,
        last_name: actor.last_name,
        avatar_url: avatarByActorId.get(actor.id) ?? null,
      },
    ]),
  );

  return NextResponse.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      actor: notification.actor_id ? actorsById.get(notification.actor_id) ?? null : null,
      href: notificationHref(notification, profile.role),
    })),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;

  let payload: MarkReadPayload;
  try {
    payload = (await request.json()) as MarkReadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .in("id", payload.ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
