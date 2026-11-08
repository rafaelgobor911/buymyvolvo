/**
 * npm run leads                 (last 7 days)
 * npm run leads -- --days=30 [--limit=100]
 *
 * Lists contact clicks recorded as leads until the admin screen exists
 * (Phase 5). Shows no buyer data: leads only keep salted hashes.
 */
import { connect, loadLocalEnv } from "./db/lib";

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(hit.indexOf("=") + 1);
}

const positive = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

async function main() {
  loadLocalEnv();
  const days = positive(flag("days"), 7);
  const limit = positive(flag("limit"), 50);
  const sql = connect(process.env.DATABASE_URL);
  try {
    const rows = await sql<
      {
        created_at: Date;
        ref_code: string;
        channel: string;
        click_count: number;
        slug: string;
        referrer: string | null;
        utm_source: string | null;
        outcome: string;
      }[]
    >`
      select ld.created_at, ld.ref_code, ld.channel, ld.click_count, l.slug, ld.referrer,
        ld.utm_source, ld.outcome
      from public.leads ld
      join public.listings l on l.id = ld.listing_id
      where ld.created_at > now() - make_interval(days => ${days})
      order by ld.created_at desc
      limit ${limit}`;
    const [totals] = await sql<{ leads: number; clicks: number; listings: number }[]>`
      select count(*)::int as leads, coalesce(sum(click_count), 0)::int as clicks,
        count(distinct listing_id)::int as listings
      from public.leads where created_at > now() - make_interval(days => ${days})`;

    console.log(
      `Últimos ${days} dias: ${totals!.leads} leads (${totals!.clicks} cliques) em ${totals!.listings} anúncios.`,
    );
    for (const r of rows) {
      const when = r.created_at.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const origin = [r.referrer, r.utm_source && `utm=${r.utm_source}`].filter(Boolean).join(" ");
      console.log(
        `${when}  ${r.ref_code}  ${r.channel.padEnd(9)} ${String(r.click_count).padStart(2)}×  ${r.slug}${origin ? `  ← ${origin}` : ""}${r.outcome === "unknown" ? "" : `  [${r.outcome}]`}`,
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
