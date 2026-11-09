/** Job history and sellers for the admin. Receives `sql` by parameter. */
import type postgres from "postgres";

type Sql = postgres.Sql;

export interface JobRunRow {
  id: string;
  jobName: string;
  status: "running" | "succeeded" | "failed" | "skipped";
  dryRun: boolean;
  startedAt: Date;
  finishedAt: Date | null;
  stats: Record<string, unknown> | null;
  aiCostUsd: number | null;
  error: string | null;
}

export async function jobHistory(
  sql: Sql,
  input: { job?: string | null; limit?: number } = {},
): Promise<JobRunRow[]> {
  const rows = await sql<(Omit<JobRunRow, "aiCostUsd"> & { aiCostUsd: string | null })[]>`
    select id, job_name as "jobName", status, dry_run as "dryRun", started_at as "startedAt",
      finished_at as "finishedAt", stats, ai_cost_usd as "aiCostUsd", error
    from public.job_runs
    where ${input.job ? sql`job_name = ${input.job}` : sql`true`}
    order by started_at desc limit ${input.limit ?? 60}`;
  return rows.map((r) => ({ ...r, aiCostUsd: r.aiCostUsd === null ? null : Number(r.aiCostUsd) }));
}

/** AI cost of real runs in the last 30 days. */
export async function aiCost30d(sql: Sql): Promise<number> {
  const [row] = await sql<{ cost: string | null }[]>`
    select sum(ai_cost_usd) as cost from public.job_runs
    where not dry_run and started_at > now() - interval '30 days'`;
  return Number(row?.cost ?? 0);
}

export interface SellerRow {
  id: string;
  displayName: string;
  type: string;
  verifiedVia: string | null;
  plan: string | null;
  createdAt: Date;
  activeListings: number;
  leads30d: number;
}

export async function listSellers(sql: Sql): Promise<SellerRow[]> {
  return sql<SellerRow[]>`
    select s.id, s.display_name as "displayName", s.type, s.verified_via as "verifiedVia",
      s.plan, s.created_at as "createdAt",
      (select count(*)::int from public.listings l where l.seller_id = s.id and l.status = 'active')
        as "activeListings",
      (select count(*)::int from public.leads ld join public.listings l on l.id = ld.listing_id
        where l.seller_id = s.id and ld.created_at > now() - interval '30 days') as "leads30d"
    from public.sellers s
    order by s.display_name`;
}

/** Plans are set by hand while there is no payment provider. */
export async function setSellerPlan(
  sql: Sql,
  input: { sellerId: string; plan: string; actor: string },
): Promise<boolean> {
  if (!["free", "destaque", "loja_pro"].includes(input.plan)) return false;
  return sql.begin(async (tx) => {
    const [row] = await tx<{ plan: string | null }[]>`
      select plan from public.sellers where id = ${input.sellerId} for update`;
    if (!row || row.plan === input.plan) return false;
    await tx`update public.sellers set plan = ${input.plan} where id = ${input.sellerId}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'seller.plan', 'seller', ${input.sellerId},
        ${tx.json({ plan: { from: row.plan, to: input.plan } })})`;
    return true;
  });
}
