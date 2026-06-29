import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

async function countRows(
  supabase: Awaited<ReturnType<typeof requirePageAuth>>["supabase"],
  table: string,
  filters: Array<[string, string, unknown]> = [],
) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [column, operator, value] of filters) {
    if (operator === "eq") query = query.eq(column, value);
    if (operator === "neq") query = query.neq(column, value);
    if (operator === "in" && Array.isArray(value)) query = query.in(column, value);
  }
  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

function MetricCard({
  icon,
  label,
  value,
  tone = "blue",
  href,
}: {
  icon: string;
  label: string;
  value: number | null;
  tone?: "blue" | "orange" | "green" | "red";
  href?: string;
}) {
  const colors = {
    blue: "bg-primary-fixed text-primary",
    orange: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-error-container text-error",
  };

  const content = (
    <div className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors[tone]}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </span>
        {href ? (
          <span className="material-symbols-outlined text-outline">arrow_forward</span>
        ) : null}
      </div>
      <p className="font-label-md text-sm text-on-surface-variant">{label}</p>
      <p className="mt-2 font-headline-md text-[34px] text-primary">
        {value === null ? "—" : value.toLocaleString("it-IT")}
      </p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function AdminPage() {
  const { supabase, profile } = await requirePageAuth({
    allowedRoles: ["admin"],
    loginPath: "/admin/login",
  });

  const [clients, professionals, admins, tickets] = await Promise.all([
    countRows(supabase, "profiles", [["role", "eq", "customer"]]),
    countRows(supabase, "profiles", [["role", "eq", "professional"]]),
    countRows(supabase, "profiles", [["role", "eq", "admin"]]),
    countRows(supabase, "support_tickets"),
  ]);

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Panoramica reale della piattaforma."
      adminName={profile.first_name || profile.email}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="group" label="Clienti" value={clients} href="/admin/clienti" />
        <MetricCard
          icon="engineering"
          label="Professionisti"
          value={professionals}
          href="/admin/professionisti"
        />
        <MetricCard icon="shield_person" label="Admin" value={admins} href="/admin/admin" />
        <MetricCard
          icon="support_agent"
          label="Ticket"
          value={tickets}
          tone="orange"
          href="/admin/supporto"
        />
      </section>
    </AdminShell>
  );
}
