import MessagesClient from "@/app/messages/messages-client";
import type { ConversationRow, MeResponse } from "@/lib/types/chat";
import { listConversationsForViewer } from "@/lib/server/conversations";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function withRequestSubjects(
  conversations: ConversationRow[],
  supabase: Awaited<ReturnType<typeof requirePageAuth>>["supabase"],
) {
  const requestIds = Array.from(
    new Set(conversations.map((conversation) => conversation.request_id).filter(Boolean)),
  );

  if (requestIds.length === 0) return conversations;

  const { data } = await supabase
    .from("contact_requests")
    .select("id, subject")
    .in("id", requestIds);

  const subjectById = new Map((data ?? []).map((row) => [row.id, row.subject]));

  return conversations.map((conversation) => ({
    ...conversation,
    request_subject: subjectById.get(conversation.request_id) ?? null,
  }));
}

export default async function ProfessionalMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user, profile } = await requirePageAuth({
    allowedRoles: ["professional"],
  });

  const sp = await searchParams;
  const conversationRaw = typeof sp.conversation === "string" ? sp.conversation : null;
  const initialActiveConversationId = conversationRaw?.trim() || null;

  const initialMe: MeResponse = {
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id,
      role: "professional",
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
  };

  let initialConversations: ConversationRow[] = [];
  let initialConversationsError: string | null = null;

  try {
    const conversations = await listConversationsForViewer({
      supabase,
      userId: user.id,
      role: "professional",
    });
    initialConversations = await withRequestSubjects(conversations, supabase);
  } catch {
    initialConversationsError = "Impossibile caricare le conversazioni.";
  }

  return (
    <MessagesClient
      embedded
      initialMe={initialMe}
      initialConversations={initialConversations}
      initialConversationsError={initialConversationsError}
      initialActiveConversationId={initialActiveConversationId}
    />
  );
}
