import type { ConversationRow, MeResponse, UserRole } from "@/lib/types/chat";
import { AuthenticatedPresence } from "@/components/realtime/authenticated-presence";
import { listConversationsForViewer } from "@/lib/server/conversations";
import { createClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";

import MessagesClient from "./messages-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function serializeMessagesPageError(error: unknown) {
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

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  let initialMe: MeResponse | null = null;
  let initialMeError: string | null = null;
  let initialConversations: ConversationRow[] = [];
  let initialConversationsError: string | null = null;
  const sp = await searchParams;
  const conversationRaw = typeof sp.conversation === "string" ? sp.conversation : null;
  const initialActiveConversationId = conversationRaw?.trim() || null;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    initialMeError = "Devi effettuare l’accesso per vedere i messaggi.";
    return (
      <MessagesClient
        initialMe={null}
        initialMeError={initialMeError}
        initialConversations={[]}
      />
    );
  }

  const { data: isActive, error: activeError } = await supabase.rpc("is_active_user");
  if (activeError || !isActive) {
    initialMeError = "Sessione non autorizzata.";
    return (
      <MessagesClient
        initialMe={null}
        initialMeError={initialMeError}
        initialConversations={[]}
      />
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    initialMeError = "Impossibile caricare il profilo.";
    return (
      <MessagesClient
        initialMe={null}
        initialMeError={initialMeError}
        initialConversations={[]}
      />
    );
  }

  const role = profile.role as UserRole;
  initialMe = {
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id,
      role,
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
  };

  try {
    initialConversations = await listConversationsForViewer({
      supabase,
      userId: user.id,
      role,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[messages/page] initial_conversations", {
      conversation_id: initialActiveConversationId,
      user_id: user.id,
      role,
      error: serializeMessagesPageError(error),
    });
    initialConversationsError = "Impossibile caricare le conversazioni.";
  }

  return (
    <AuthenticatedPresence
      userId={user.id}
      role={role}
      activeConversationId={initialActiveConversationId}
    >
      <MessagesClient
        initialMe={initialMe}
        initialMeError={initialMeError}
        initialConversations={initialConversations}
        initialConversationsError={initialConversationsError}
        initialActiveConversationId={initialActiveConversationId}
      />
    </AuthenticatedPresence>
  );
}
