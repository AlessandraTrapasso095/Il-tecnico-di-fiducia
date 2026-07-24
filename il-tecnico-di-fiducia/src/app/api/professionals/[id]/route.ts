import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { normalizeItalianProvinceCode } from "@/lib/locations/italian-provinces";
import { isProfessionalVisibleToCustomers } from "@/lib/server/professional-visibility";
import { normalizeWebsiteUrl } from "@/lib/validation/website-url";

type UpdateProfessionalPayload = {
  first_name?: string;
  last_name?: string;
  province_code?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  public_email?: string | null;
  website_url?: string | null;
  specializations?: string[];
  services_offered?: string[];
  operational_provinces?: string[];
  education?: unknown[];
  work_experiences?: unknown[];
  certifications?: unknown[];
  available_remote?: boolean;
  available_travel?: boolean;
};

function optionalText(value: unknown, maxLength: number) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
}

function optionalLongText(value: unknown, maxLength: number) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
}

function optionalStringArray(value: unknown, maxItems = 30, maxLength = 80) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => (item.length > maxLength ? item.slice(0, maxLength) : item));
}

function optionalJsonList(value: unknown, maxItems = 30) {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, maxItems).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return {};
    return item;
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (
    profile.role === "customer" &&
    !(await isProfessionalVisibleToCustomers(id))
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: professional, error: professionalError } = await supabase
    .from("professional_directory")
    .select(
      "id, first_name, last_name, province_code, headline, bio, specializations, avatar_url, cover_url, available_remote, available_travel, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (professionalError) {
    return NextResponse.json(
      { error: "Failed to load professional" },
      { status: 500 },
    );
  }

  if (!professional) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from("professional_categories")
    .select("category_id")
    .eq("professional_id", id);

  if (mappingsError) {
    return NextResponse.json(
      { error: "Failed to load professional categories" },
      { status: 500 },
    );
  }

  const categoryIds = (mappings ?? []).map((m) => m.category_id);
  const { data: categories, error: categoriesError } = categoryIds.length
    ? await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .in("id", categoryIds)
    : { data: [], error: null };

  if (categoriesError) {
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 },
    );
  }

  let contactRequest: { id: string; status: string; created_at: string } | null = null;
  let isFollowing: boolean | null = null;
  let isSaved: boolean | null = null;

  if (profile.role === "customer") {
    const { data: lastRequest } = await supabase
      .from("contact_requests")
      .select("id, status, created_at")
      .eq("customer_id", user.id)
      .eq("professional_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    contactRequest = lastRequest ?? null;

    const { data: saved } = await supabase
      .from("saved_professionals")
      .select("professional_id")
      .eq("customer_id", user.id)
      .eq("professional_id", id)
      .maybeSingle();
    isSaved = !!saved;
  }

  if (profile.role === "professional") {
    const { data: followRow } = await supabase
      .from("professional_follows")
      .select("followed_id")
      .eq("follower_id", user.id)
      .eq("followed_id", id)
      .maybeSingle();
    isFollowing = !!followRow;
  }

  return NextResponse.json({
    professional,
    categories: categories ?? [],
    viewer: {
      role: profile.role,
      contact_request: contactRequest,
      is_following: isFollowing,
      is_saved: isSaved,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional", "admin"] });
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (profile.role !== "admin" && id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: UpdateProfessionalPayload;
  try {
    payload = (await request.json()) as UpdateProfessionalPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileUpdates: Record<string, unknown> = {};
  const professionalUpdates: Record<string, unknown> = {};

  const firstName = optionalText(payload.first_name, 80);
  const lastName = optionalText(payload.last_name, 80);
  const provinceCode = optionalText(payload.province_code, 2);
  const phone = optionalText(payload.phone, 40);

  if (firstName !== undefined) {
    if (!isNonEmptyString(firstName)) {
      return NextResponse.json({ error: "first_name is required" }, { status: 400 });
    }
    profileUpdates.first_name = firstName;
  }
  if (lastName !== undefined) {
    if (!isNonEmptyString(lastName)) {
      return NextResponse.json({ error: "last_name is required" }, { status: 400 });
    }
    profileUpdates.last_name = lastName;
  }
  if (provinceCode !== undefined) {
    const normalizedProvince = provinceCode ? normalizeItalianProvinceCode(provinceCode) : null;
    if (provinceCode && !normalizedProvince) {
      return NextResponse.json({ error: "Invalid province" }, { status: 400 });
    }
    profileUpdates.province_code = normalizedProvince;
  }
  if (phone !== undefined) profileUpdates.phone = phone || null;

  const headline = optionalText(payload.headline, 140);
  const bio = optionalLongText(payload.bio, 3000);
  const publicEmail = optionalText(payload.public_email, 160);
  const hasWebsiteUrl = Object.prototype.hasOwnProperty.call(payload, "website_url");
  const websiteUrl = normalizeWebsiteUrl(payload.website_url);
  const specializations = optionalStringArray(payload.specializations);
  const servicesOffered = optionalStringArray(payload.services_offered);
  const operationalProvinces = optionalStringArray(payload.operational_provinces, 110, 2);
  const education = optionalJsonList(payload.education);
  const workExperiences = optionalJsonList(payload.work_experiences);
  const certifications = optionalJsonList(payload.certifications);

  if (headline !== undefined) professionalUpdates.headline = headline || null;
  if (bio !== undefined) professionalUpdates.bio = bio || null;
  if (publicEmail !== undefined) professionalUpdates.public_email = publicEmail || null;
  if (hasWebsiteUrl) {
    if (websiteUrl === undefined) {
      return NextResponse.json({ error: "URL sito web non valido." }, { status: 400 });
    }
    professionalUpdates.website_url = websiteUrl;
  }
  if (specializations !== undefined) professionalUpdates.specializations = specializations;
  if (servicesOffered !== undefined) professionalUpdates.services_offered = servicesOffered;
  if (operationalProvinces !== undefined) {
    const normalizedOperationalProvinces = operationalProvinces.map((code) =>
      normalizeItalianProvinceCode(code),
    );
    if (normalizedOperationalProvinces.some((code) => !code)) {
      return NextResponse.json(
        { error: "Invalid operational province" },
        { status: 400 },
      );
    }
    professionalUpdates.operational_provinces = normalizedOperationalProvinces;
  }
  if (education !== undefined) professionalUpdates.education = education;
  if (workExperiences !== undefined) professionalUpdates.work_experiences = workExperiences;
  if (certifications !== undefined) professionalUpdates.certifications = certifications;
  if (typeof payload.available_remote === "boolean") {
    professionalUpdates.available_remote = payload.available_remote;
  }
  if (typeof payload.available_travel === "boolean") {
    professionalUpdates.available_travel = payload.available_travel;
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (Object.keys(professionalUpdates).length > 0) {
    const { error } = await supabase
      .from("professional_profiles")
      .update(professionalUpdates)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const { data: professional } = await supabase
    .from("professional_profiles")
    .select(
      "id, headline, bio, specializations, avatar_url, cover_url, public_email, website_url, education, work_experiences, certifications, services_offered, operational_provinces, available_remote, available_travel, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({ professional });
}
