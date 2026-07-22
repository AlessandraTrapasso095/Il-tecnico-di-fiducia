import "server-only";

import { createClient } from "@supabase/supabase-js";

export class MissingServerEnvError extends Error {
  envName: string;

  constructor(envName: string) {
    super(`Missing env: ${envName}`);
    this.name = "MissingServerEnvError";
    this.envName = envName;
  }
}

export function isMissingServerEnvError(error: unknown): error is MissingServerEnvError {
  return error instanceof MissingServerEnvError;
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new MissingServerEnvError("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new MissingServerEnvError("SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
