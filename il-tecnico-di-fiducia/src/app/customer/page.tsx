import CustomerDashboardClient from "./customer-dashboard-client";

import type { ConversationRow, MeResponse } from "@/lib/types/chat";
import { listConversationsForViewer } from "@/lib/server/conversations";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function readParam(
  searchParams: { [key: string]: string | string[] | undefined },
  key: string,
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : "";
}

function readBooleanParam(
  searchParams: { [key: string]: string | string[] | undefined },
  key: string,
) {
  const value = readParam(searchParams, key);
  return value === "true" || value === "1";
}

export default async function CustomerDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile, supabase, user } = await requirePageAuth({ allowedRoles: ["customer"] });
  const sp = await searchParams;
  let initialConversations: ConversationRow[] = [];
  let initialConversationsError: string | null = null;

  try {
    initialConversations = await listConversationsForViewer({
      supabase,
      userId: user.id,
      role: "customer",
    });
  } catch {
    initialConversationsError = "Impossibile caricare le conversazioni.";
  }

  const initialMe: MeResponse = {
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id,
      role: "customer",
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
  };

  return (
    <CustomerDashboardClient
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        province_code: profile.province_code,
      }}
      initialFilters={{
        q: readParam(sp, "q"),
        categoryId: readParam(sp, "category_id"),
        subcategoryId: readParam(sp, "subcategory_id"),
        provinceCode: readParam(sp, "province_code"),
        remote: readBooleanParam(sp, "remote"),
        travel: readBooleanParam(sp, "travel"),
      }}
      initialMessages={{
        me: initialMe,
        conversations: initialConversations,
        conversationsError: initialConversationsError,
        activeConversationId: readParam(sp, "conversation") || null,
        initialView:
          readParam(sp, "section") === "messages" || readParam(sp, "conversation")
            ? "messages"
            : "explore",
      }}
    />
  );
}
