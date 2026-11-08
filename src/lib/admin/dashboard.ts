/**
 * Admin home: counts and the alerts that need attention. Receives `sql` by
 * parameter.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

export interface DashboardAlert {
  tone: "warning" | "error";
  text: string;
  href?: string;
}

export interface Dashboard {
  pending: number;
  active: number;
  newToday: number;
  leads7d: number;
  clicks7d: number;
  alerts: DashboardAlert[];
}

export async function loadDashboard(sql: Sql): Promise<Dashboard> {
  const [counts] = await sql<
    { pending: number; active: number; new_today: number; leads: number; clicks: number }[]
  >`
    select
      (select count(*)::int from public.listings where status = 'pending_review') as pending,
      (select count(*)::int from public.listings where status = 'active') as active,
      (select count(*)::int from public.listings where created_at > now() - interval '24 hours') as new_today,
      (select count(*)::int from public.leads where created_at > now() - interval '7 days') as leads,
      (select coalesce(sum(click_count), 0)::int from public.leads
        where created_at > now() - interval '7 days') as clicks`;

  const alerts: DashboardAlert[] = [];
  if (counts!.pending > 0) {
    alerts.push({
      tone: "warning",
      text: `${counts!.pending} anúncio(s) esperando moderação.`,
      href: "/admin/moderacao",
    });
  }

  // Alerts and failures from each job's latest real run (dry runs do not count).
  const runs = await sql<
    {
      job_name: string;
      status: string;
      error: string | null;
      alerts: string[] | null;
      started_at: Date;
    }[]
  >`
    select distinct on (job_name) job_name, status, error, stats->'alerts' as alerts, started_at
    from public.job_runs
    where not dry_run and started_at > now() - interval '3 days' and status <> 'skipped'
    order by job_name, started_at desc`;
  for (const run of runs) {
    if (run.status === "failed") {
      alerts.push({
        tone: "error",
        text: `O job ${run.job_name} falhou: ${run.error ?? "erro sem mensagem"}`,
        href: `/admin/jobs?job=${run.job_name}`,
      });
    }
    for (const text of run.alerts ?? []) {
      alerts.push({ tone: "warning", text, href: `/admin/jobs?job=${run.job_name}` });
    }
  }

  const failing = await sql<{ handle: string; type: string; last_error: string | null }[]>`
    select handle, type, last_error from public.sources
    where active and consecutive_failures >= 3 order by handle`;
  for (const s of failing) {
    const name = s.type === "ig_hashtag" ? `#${s.handle}` : `@${s.handle}`;
    alerts.push({
      tone: "error",
      text: `A fonte ${name} falhou 3 vezes seguidas: ${s.last_error ?? ""}`.trim(),
      href: "/admin/fontes",
    });
  }

  const [budget] = await sql<{ used: number; max: number }[]>`
    select count(distinct hashtag)::int as used,
      coalesce((select (value #>> '{}')::int from public.app_settings where key = 'hashtag_budget_max'), 25) as max
    from public.hashtag_budget where window_started_at > now() - interval '7 days'`;
  if (budget && budget.used >= budget.max - 2) {
    alerts.push({
      tone: "warning",
      text: `Orçamento de hashtags: ${budget.used} de ${budget.max} usadas nos últimos 7 dias.`,
      href: "/admin/fontes",
    });
  }

  const [claims] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.listing_claims where status = 'pending'`;
  if (claims && claims.n > 0) {
    alerts.push({
      tone: "warning",
      text: `${claims.n} reivindicação(ões) de anúncio esperando confirmação.`,
      href: "/admin/reivindicacoes",
    });
  }

  const [removals] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.removal_requests where status = 'pending'`;
  if (removals && removals.n > 0) {
    alerts.push({
      tone: "error",
      text: `${removals.n} pedido(s) de remoção para confirmar (prazo de 48h).`,
      href: "/admin/remocoes",
    });
  }

  return {
    pending: counts!.pending,
    active: counts!.active,
    newToday: counts!.new_today,
    leads7d: counts!.leads,
    clicks7d: counts!.clicks,
    alerts,
  };
}
