import "server-only";

export function mapSupabaseAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("email rate limit")) {
    return "Supabase Auth email rate limit exceeded. Please wait before requesting another OTP email, or configure custom SMTP for higher limits.";
  }

  if (message === "Database error saving new user") {
    return "Unable to complete signup. Check Supabase profile trigger and province seed.";
  }

  return message;
}
