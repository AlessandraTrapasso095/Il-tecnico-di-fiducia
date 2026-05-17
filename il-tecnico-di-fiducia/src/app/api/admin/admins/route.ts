import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { createServiceClient } from "@/lib/supabase/service";

type CreateAdminPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  let payload: CreateAdminPayload;
  try {
    payload = (await request.json()) as CreateAdminPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !isNonEmptyString(payload.email) ||
    !isNonEmptyString(payload.password) ||
    !isNonEmptyString(payload.first_name) ||
    !isNonEmptyString(payload.last_name)
  ) {
    return NextResponse.json(
      { error: "email, password, first_name, last_name are required" },
      { status: 400 },
    );
  }

  if (payload.password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  const { data, error } = await service.auth.admin.createUser({
    email: payload.email.trim(),
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      // Do NOT set role from metadata (DB trigger forbids admin anyway).
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userId = data.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Failed to create admin user" }, { status: 500 });
  }

  // Promote to admin + force password change on first login.
  const { error: profileError } = await service
    .from("profiles")
    .update({
      role: "admin",
      must_change_password: true,
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
    })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Ensure the admin is not present in customer/professional directory tables.
  await service.from("customer_directory").delete().eq("id", userId);
  await service.from("professional_directory").delete().eq("id", userId);

  return NextResponse.json({
    ok: true,
    user: { id: userId, email: payload.email.trim() },
  });
}

