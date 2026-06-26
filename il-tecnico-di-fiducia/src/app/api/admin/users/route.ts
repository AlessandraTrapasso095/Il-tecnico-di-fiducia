import { NextResponse, type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { clampInt } from "@/lib/api/validation";

type UserRoleFilter = "customer" | "professional" | "admin";

function isValidRole(value: string): value is UserRoleFilter {
  return value === "customer" || value === "professional" || value === "admin";
}

function sanitizeSearch(raw: string) {
  return raw
    .replace(/[^\p{L}\p{N}\s.@'+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const searchParams = request.nextUrl.searchParams;
  const roleRaw = searchParams.get("role");
  const qRaw = searchParams.get("q");

  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("page_size"), 50, 1, 100);
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let builder = supabase
    .from("profiles")
    .select(
      "id, role, email, first_name, last_name, province_code, phone, must_change_password, is_banned, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (roleRaw) {
    if (!isValidRole(roleRaw)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    builder = builder.eq("role", roleRaw);
  }

  if (qRaw && qRaw.trim().length > 0) {
    const q = sanitizeSearch(qRaw);
    if (q.length > 0) {
      builder = builder.or(
        `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`,
      );
    }
  }

  const { data: users, error, count } = await builder;
  if (error) {
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }

  const rows = users ?? [];
  const ids = rows.map((u) => u.id);

  const { data: activities } = ids.length
    ? await supabase
        .from("user_activity")
        .select("user_id, last_seen_at")
        .in("user_id", ids)
    : { data: [] };

  const lastSeenById = new Map((activities ?? []).map((a) => [a.user_id, a.last_seen_at]));
  const onlineWindowMs = 2 * 60 * 1000;

  const professionalIds = rows.filter((u) => u.role === "professional").map((u) => u.id);
  const { data: subs } =
    professionalIds.length > 0
      ? await supabase
          .from("professional_subscriptions")
          .select("professional_id, status, current_period_end, updated_at")
          .in("professional_id", professionalIds)
      : { data: [] };
  const subscriptionById = new Map((subs ?? []).map((s) => [s.professional_id, s]));

  const { data: professionalDirectoryRows } =
    professionalIds.length > 0
      ? await supabase
          .from("professional_directory")
          .select("id, headline, specializations, available_remote, available_travel")
          .in("id", professionalIds)
      : { data: [] };
  const professionalDirectoryById = new Map(
    (professionalDirectoryRows ?? []).map((row) => [row.id, row]),
  );

  // Metrics (batched)
  const customerIds = rows.filter((u) => u.role === "customer").map((u) => u.id);

  const contactedProsByCustomer = new Map<string, Set<string>>();
  if (customerIds.length > 0) {
    const { data: reqs } = await supabase
      .from("contact_requests")
      .select("customer_id, professional_id")
      .in("customer_id", customerIds);

    for (const r of reqs ?? []) {
      const set = contactedProsByCustomer.get(r.customer_id) ?? new Set<string>();
      set.add(r.professional_id);
      contactedProsByCustomer.set(r.customer_id, set);
    }
  }

  const reviewsLeftCountByCustomer = new Map<string, number>();
  if (customerIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("customer_id")
      .in("customer_id", customerIds);

    for (const r of reviews ?? []) {
      reviewsLeftCountByCustomer.set(
        r.customer_id,
        (reviewsLeftCountByCustomer.get(r.customer_id) ?? 0) + 1,
      );
    }
  }

  const acceptedCustomersByPro = new Map<string, Set<string>>();
  if (professionalIds.length > 0) {
    const { data: accepted } = await supabase
      .from("contact_requests")
      .select("professional_id, customer_id")
      .eq("status", "accepted")
      .in("professional_id", professionalIds);

    for (const r of accepted ?? []) {
      const set = acceptedCustomersByPro.get(r.professional_id) ?? new Set<string>();
      set.add(r.customer_id);
      acceptedCustomersByPro.set(r.professional_id, set);
    }
  }

  const reviewsReceivedByPro = new Map<string, { count: number; sum: number }>();
  if (professionalIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("professional_id, rating")
      .in("professional_id", professionalIds);

    for (const r of reviews ?? []) {
      const agg = reviewsReceivedByPro.get(r.professional_id) ?? { count: 0, sum: 0 };
      agg.count += 1;
      agg.sum += r.rating;
      reviewsReceivedByPro.set(r.professional_id, agg);
    }
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    users: rows.map((u) => {
      const lastSeenAt = lastSeenById.get(u.id) ?? null;
      const isOnline =
        lastSeenAt !== null &&
        Date.now() - new Date(lastSeenAt).getTime() <= onlineWindowMs;

      const subscription = u.role === "professional" ? (subscriptionById.get(u.id) ?? null) : null;
      const professional_directory =
        u.role === "professional" ? (professionalDirectoryById.get(u.id) ?? null) : null;

      const customerMetrics =
        u.role === "customer"
          ? {
              professionals_contacted: contactedProsByCustomer.get(u.id)?.size ?? 0,
              reviews_left: reviewsLeftCountByCustomer.get(u.id) ?? 0,
            }
          : null;

      const proAgg = reviewsReceivedByPro.get(u.id) ?? { count: 0, sum: 0 };
      const professionalMetrics =
        u.role === "professional"
          ? {
              customers_accepted: acceptedCustomersByPro.get(u.id)?.size ?? 0,
              reviews_received: proAgg.count,
              average_rating: proAgg.count > 0 ? proAgg.sum / proAgg.count : null,
            }
          : null;

      return {
        ...u,
        activity: { last_seen_at: lastSeenAt, is_online: isOnline },
        subscription,
        professional_directory,
        metrics: customerMetrics ?? professionalMetrics,
      };
    }),
  });
}
