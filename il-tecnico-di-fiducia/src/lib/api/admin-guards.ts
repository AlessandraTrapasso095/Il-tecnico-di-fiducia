import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRoleRow = {
  role: "customer" | "professional" | "admin";
};

export async function getAdminCount(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) {
    throw new Error(`Failed to count admins: ${error.message}`);
  }

  return count ?? 0;
}

export async function assertNotLastAdmin(
  supabase: SupabaseClient,
  targetUserId: string,
  action: "delete" | "ban",
) {
  const { data: target, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target user: ${error.message}`);
  }

  if (!target) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const role = (target as ProfileRoleRow).role;
  if (role !== "admin") {
    return { ok: true as const };
  }

  const adminCount = await getAdminCount(supabase);
  if (adminCount <= 1) {
    return {
      ok: false as const,
      reason: "last_admin" as const,
      message:
        action === "delete"
          ? "Cannot delete the last admin"
          : "Cannot ban the last admin",
    };
  }

  return { ok: true as const };
}

