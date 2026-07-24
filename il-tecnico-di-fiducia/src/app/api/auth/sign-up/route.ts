import { NextResponse } from "next/server";

import {
  enforceRateLimit,
  getClientIp,
  hashRateLimitId,
} from "@/lib/api/rate-limit";
import { mapSupabaseAuthError } from "@/lib/api/auth-errors";
import { isNonEmptyString } from "@/lib/api/validation";
import { normalizeItalianProvinceCode } from "@/lib/locations/italian-provinces";
import { validateProfessionalTaxonomySelection } from "@/lib/server/professional-taxonomy";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type SignUpPayload = {
  role: "customer" | "professional";
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  province_code: string;
  phone?: string | null;
  accept_terms: boolean;
  category_id?: string | number | null;
  subcategory_id?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  // Rate-limit by IP early (before parsing JSON) to reduce abuse surface.
  const ip = getClientIp(request);
  const ipLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:signup:ip:${ip}`,
    maxHits: 8,
    windowSeconds: 60,
    errorMessage: "IP signup rate limit exceeded. Please try again later.",
  });
  if (ipLimited) return ipLimited;

  let payload: SignUpPayload;
  try {
    payload = (await request.json()) as SignUpPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.accept_terms) {
    return NextResponse.json(
      { error: "Terms must be accepted" },
      { status: 400 },
    );
  }

  if (payload.role !== "customer" && payload.role !== "professional") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.email) || !isNonEmptyString(payload.password)) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  // Also rate-limit by email (hashed) to reduce targeted abuse.
  const normalizedEmail = payload.email.trim().toLowerCase();
  const emailHash = await hashRateLimitId(`email:${normalizedEmail}`);
  const emailLimited = await enforceRateLimit({
    supabase,
    key: `v1:auth:signup:email:${emailHash}`,
    maxHits: 3,
    windowSeconds: 600,
    errorMessage: "Email signup rate limit exceeded. Please try again later.",
  });
  if (emailLimited) return emailLimited;

  if (
    !isNonEmptyString(payload.first_name) ||
    !isNonEmptyString(payload.last_name)
  ) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(payload.province_code)) {
    return NextResponse.json({ error: "Province is required" }, { status: 400 });
  }

  const rawProvinceCode = payload.province_code.trim();
  const provinceCode = normalizeItalianProvinceCode(rawProvinceCode);
  if (!provinceCode) {
    return NextResponse.json({ error: "Invalid province" }, { status: 400 });
  }

  const { data: province, error: provinceError } = await supabase
    .from("provinces")
    .select("code")
    .eq("code", provinceCode)
    .maybeSingle();

  if (provinceError) {
    return NextResponse.json(
      { error: "Unable to validate province" },
      { status: 500 },
    );
  }

  if (!province) {
    return NextResponse.json(
      { error: "Selected province is not configured in Supabase" },
      { status: 400 },
    );
  }

  const service = payload.role === "professional" ? createServiceClient() : null;
  const taxonomy =
    payload.role === "professional"
      ? await validateProfessionalTaxonomySelection(service!, {
          category_id: payload.category_id,
          subcategory_id: payload.subcategory_id,
        })
      : null;

  if (taxonomy && !taxonomy.ok) {
    return NextResponse.json({ error: taxonomy.error }, { status: taxonomy.status });
  }

  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim(),
    password: payload.password,
    options: {
      data: {
        role: payload.role,
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        province_code: provinceCode,
        phone: payload.phone ?? null,
        category_id: taxonomy?.ok ? String(taxonomy.selection.category.id) : null,
        subcategory_id: taxonomy?.ok ? taxonomy.selection.subcategory?.id ?? null : null,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: mapSupabaseAuthError(error.message) }, { status: 400 });
  }

  // Enforce "Confirm email" flow: session must be null until OTP confirmation.
  if (data.session) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error:
          "Email confirmation must be enabled in Supabase (Auth Providers -> Email -> Confirm email).",
      },
      { status: 400 },
    );
  }

  if (payload.role === "professional" && data.user?.id && taxonomy?.ok) {
    const professionalId = data.user.id;
    const { error: profileError } = await service!
      .from("professional_profiles")
      .upsert(
        {
          id: professionalId,
          subcategory_id: taxonomy.selection.subcategory?.id ?? null,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      return NextResponse.json(
        { error: "Non è stato possibile salvare la categoria professionale." },
        { status: 500 },
      );
    }

    const { error: deleteCategoryLinksError } = await service!
      .from("professional_categories")
      .delete()
      .eq("professional_id", professionalId);

    if (deleteCategoryLinksError) {
      return NextResponse.json(
        { error: "Non è stato possibile aggiornare la categoria professionale." },
        { status: 500 },
      );
    }

    const { error: insertCategoryLinkError } = await service!
      .from("professional_categories")
      .insert({
        professional_id: professionalId,
        category_id: taxonomy.selection.category.id,
      });

    if (insertCategoryLinkError) {
      return NextResponse.json(
        { error: "Non è stato possibile salvare la categoria professionale." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    email: payload.email.trim(),
    requires_email_otp: true,
  });
}
