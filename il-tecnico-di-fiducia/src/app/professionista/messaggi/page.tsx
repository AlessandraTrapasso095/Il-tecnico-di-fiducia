import MessagesClient from "@/app/messages/messages-client";
import type { ConversationRow, MeResponse } from "@/lib/types/chat";
import { listConversationsForViewer } from "@/lib/server/conversations";
import { requirePageAuth } from "@/lib/server/require-page-auth";
import { unstable_rethrow } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function serializeServerError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      code: record.code,
      message: record.message,
      details: record.details,
      hint: record.hint,
      status: record.status,
      raw: record,
    };
  }

  return { error };
}

function logProfessionalMessagesError(
  stage: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  console.error("[professionista/messaggi]", stage, {
    ...context,
    error: serializeServerError(error),
  });
}

async function withRequestSubjects(
  conversations: ConversationRow[],
  supabase: Awaited<ReturnType<typeof requirePageAuth>>["supabase"],
) {
  const requestIds = Array.from(
    new Set(conversations.map((conversation) => conversation.request_id).filter(Boolean)),
  );

  if (requestIds.length === 0) return conversations;

  const { data, error } = await supabase
    .from("contact_requests")
    .select("id, subject")
    .in("id", requestIds);

  if (error) {
    logProfessionalMessagesError("contact_requests_subjects", error, {
      request_ids_count: requestIds.length,
    });
    return conversations;
  }

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
  } catch (error) {
    unstable_rethrow(error);
    logProfessionalMessagesError("initial_conversations", error, {
      conversation_id: initialActiveConversationId,
      user_id: user.id,
      role: "professional",
    });
    initialConversationsError = "Impossibile caricare le conversazioni.";
  }

  return (
    <div className="h-[calc(100dvh-80px)] min-h-0 overflow-hidden">
      <MessagesClient
        embedded
        initialMe={initialMe}
        initialConversations={initialConversations}
        initialConversationsError={initialConversationsError}
        initialActiveConversationId={initialActiveConversationId}
      />
    </div>
  );
}
