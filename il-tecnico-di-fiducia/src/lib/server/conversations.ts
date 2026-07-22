import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConversationRow, UserRole } from "@/lib/types/chat";
import { loadCustomerVisibleProfessionalIds } from "@/lib/server/professional-visibility";
import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

type ListConversationsArgs = {
  supabase: SupabaseClient;
  userId: string;
  role: UserRole;
  statusFilter?: string | null;
};

export async function listConversationsForViewer({
  supabase,
  userId,
  role,
  statusFilter,
}: ListConversationsArgs): Promise<ConversationRow[]> {
  const { data: hidden, error: hiddenError } = await supabase
    .from("conversation_user_state")
    .select("conversation_id, hidden_at")
    .eq("user_id", userId)
    .not("hidden_at", "is", null);

  const hiddenConversationIds = hiddenError
    ? []
    : (hidden ?? []).map((r) => r.conversation_id);

  if (hiddenError) {
    logApiError("CONVERSATIONS ERROR", {
      user_id: userId,
      role,
      query: "conversation_user_state select hidden conversations",
      error: hiddenError,
    });
  }

  let builder = supabase
    .from("conversations")
    .select(
      "id, request_id, status, customer_id, professional_id, last_message_at, last_message_body, last_message_sender_id, created_at, updated_at",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (role === "customer") {
    builder = builder.eq("customer_id", userId);
  } else if (role === "professional") {
    builder = builder.eq("professional_id", userId);
  }

  if (statusFilter) {
    builder = builder.eq("status", statusFilter);
  }

  if (hiddenConversationIds.length > 0) {
    const inList = hiddenConversationIds.map((id) => `"${id}"`).join(",");
    builder = builder.not("id", "in", `(${inList})`);
  }

  const { data: conversations, error } = await builder;
  if (error) throw error;

  const convs = (conversations ?? []) as ConversationRow[];
  if (convs.length === 0) return [];

  let service: SupabaseClient | null = null;
  try {
    service = createServiceClient();
  } catch (error) {
    logApiError("CONVERSATIONS ENRICHMENT ERROR", {
      user_id: userId,
      role,
      query: "create service client for conversation enrichment",
      error,
    });
  }

  async function onlineByUserId(ids: string[], client: SupabaseClient | null) {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return new Map<string, boolean>();
    if (!client) return new Map<string, boolean>();

    const { data, error: activityError } = await client
      .from("user_activity")
      .select("user_id, last_seen_at")
      .in("user_id", uniqueIds);

    if (activityError) {
      logApiError("CONVERSATIONS ENRICHMENT ERROR", {
        user_id: userId,
        role,
        query: "user_activity select conversation participants",
        participant_count: uniqueIds.length,
        error: activityError,
      });
      return new Map<string, boolean>();
    }

    const onlineWindowMs = 60 * 1000;
    return new Map(
      (data ?? []).map((row) => [
        row.user_id,
        Boolean(row.last_seen_at) &&
          Date.now() - new Date(row.last_seen_at).getTime() <= onlineWindowMs,
      ]),
    );
  }

  if (role === "customer") {
    const proIds = Array.from(new Set(convs.map((c) => c.professional_id)));
    let visibleIds = new Set<string>();
    if (service) {
      try {
        visibleIds = await loadCustomerVisibleProfessionalIds(proIds, service);
      } catch (error) {
        logApiError("CONVERSATIONS ENRICHMENT ERROR", {
          user_id: userId,
          role,
          query: "load visible professionals for conversations",
          professional_count: proIds.length,
          error,
        });
      }
    }

    const profileClient = service ?? supabase;
    const { data: pros, error: prosError } =
      proIds.length > 0
        ? await profileClient
            .from("professional_directory")
            .select("id, first_name, last_name, province_code, avatar_url, headline")
            .in("id", proIds)
        : { data: [], error: null };

    if (prosError) {
      logApiError("CONVERSATIONS ENRICHMENT ERROR", {
        user_id: userId,
        role,
        query: "professional_directory select conversation participants",
        professional_count: proIds.length,
        error: prosError,
      });
    }

    const proById = new Map((pros ?? []).map((p) => [p.id, p]));
    if (!service) {
      visibleIds = new Set(proById.keys());
    }

    const online = await onlineByUserId(proIds, service);

    return convs.map((c) => {
      const participant = proById.get(c.professional_id) ?? null;
      return {
        ...c,
        professional_available: visibleIds.has(c.professional_id),
        participant: participant
          ? { ...participant, is_online: online.get(participant.id) ?? false }
          : null,
      };
    });
  }

  if (role === "professional") {
    const customerIds = Array.from(new Set(convs.map((c) => c.customer_id)));
    const { data: customers } =
      customerIds.length > 0
        ? await supabase
            .from("customer_directory")
            .select("id, first_name, last_name, province_code")
            .in("id", customerIds)
        : { data: [] };

    const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

    const online = await onlineByUserId(customerIds, service ?? supabase);

    return convs.map((c) => {
      const participant = customerById.get(c.customer_id) ?? null;
      return {
        ...c,
        participant: participant
          ? { ...participant, is_online: online.get(participant.id) ?? false }
          : null,
      };
    });
  }

  return convs;
}
