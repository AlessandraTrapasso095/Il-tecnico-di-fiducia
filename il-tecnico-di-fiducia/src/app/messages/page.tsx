import type { ConversationRow, MeResponse, UserRole } from "@/lib/types/chat";
import { listConversationsForViewer } from "@/lib/server/conversations";
import { createClient } from "@/lib/supabase/server";

import MessagesClient from "./messages-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

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
  } catch {
    initialConversationsError = "Impossibile caricare le conversazioni.";
  }

  return (
    <MessagesClient
      initialMe={initialMe}
      initialMeError={initialMeError}
      initialConversations={initialConversations}
      initialConversationsError={initialConversationsError}
      initialActiveConversationId={initialActiveConversationId}
    />
  );
}
