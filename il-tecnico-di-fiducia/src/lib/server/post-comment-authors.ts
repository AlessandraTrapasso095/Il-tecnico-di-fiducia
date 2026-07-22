import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logApiError } from "@/lib/server/api-logger";
import { createServiceClient } from "@/lib/supabase/service";

export type ResolvedCommentAuthor = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
};

type ProfileAuthorRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProfessionalAvatarRow = {
  id: string;
  avatar_url: string | null;
};

function authorDisplayName(author: Pick<ResolvedCommentAuthor, "first_name" | "last_name">) {
  return `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim();
}

export async function resolveCommentAuthors(
  authorIds: string[],
  client?: SupabaseClient,
) {
  const uniqueAuthorIds = Array.from(new Set(authorIds.filter(Boolean)));
  const authorsById = new Map<string, ResolvedCommentAuthor>();

  if (uniqueAuthorIds.length === 0) return authorsById;

  try {
    const service = client ?? createServiceClient();
    const { data: profiles, error: profilesError } = await service
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", uniqueAuthorIds);

    if (profilesError) {
      logApiError("POST_COMMENTS AUTHORS ERROR", {
        query: "profiles select comment authors",
        author_count: uniqueAuthorIds.length,
        error: profilesError,
      });
      return authorsById;
    }

    const { data: professionalAvatars, error: professionalAvatarsError } = await service
      .from("professional_directory")
      .select("id, avatar_url")
      .in("id", uniqueAuthorIds);

    if (professionalAvatarsError) {
      logApiError("POST_COMMENTS AUTHORS ERROR", {
        query: "professional_directory select comment author avatars",
        author_count: uniqueAuthorIds.length,
        error: professionalAvatarsError,
      });
    }

    const avatarById = new Map(
      ((professionalAvatars ?? []) as ProfessionalAvatarRow[]).map((row) => [
        row.id,
        row.avatar_url,
      ]),
    );

    for (const profile of (profiles ?? []) as ProfileAuthorRow[]) {
      const firstName = profile.first_name ?? "";
      const lastName = profile.last_name ?? "";
      const author = {
        id: profile.id,
        user_id: profile.id,
        first_name: firstName,
        last_name: lastName,
        display_name: authorDisplayName({ first_name: firstName, last_name: lastName }),
        avatar_url: avatarById.get(profile.id) ?? null,
      };

      authorsById.set(profile.id, author);
    }
  } catch (error) {
    logApiError("POST_COMMENTS AUTHORS ERROR", {
      query: "resolve comment authors",
      author_count: uniqueAuthorIds.length,
      error,
    });
  }

  return authorsById;
}
