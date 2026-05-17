import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConversationRow, UserRole } from "@/lib/types/chat";

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

  if (role === "customer") {
    const proIds = Array.from(new Set(convs.map((c) => c.professional_id)));
    const { data: pros } =
      proIds.length > 0
        ? await supabase
            .from("professional_directory")
            .select("id, first_name, last_name, province_code, avatar_url, headline")
            .in("id", proIds)
        : { data: [] };

    const proById = new Map((pros ?? []).map((p) => [p.id, p]));

    return convs.map((c) => ({
      ...c,
      participant: proById.get(c.professional_id) ?? null,
    }));
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

    return convs.map((c) => ({
      ...c,
      participant: customerById.get(c.customer_id) ?? null,
    }));
  }

  return convs;
}
