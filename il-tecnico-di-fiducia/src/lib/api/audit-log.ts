import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type AuditLogInput = {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(
  supabase: SupabaseClient,
  { actorId, action, targetType, targetId = null, metadata = {} }: AuditLogInput,
) {
  try {
    await supabase.from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
  } catch {
    // Audit logging is best-effort here: never let a dashboard action fail
    // solely because an older environment has not applied the audit migration yet.
  }
}
