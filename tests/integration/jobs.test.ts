import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseServerEnv } from "@/lib/env/schema";
import { emptyUsage } from "@/lib/extraction/cost";
import type { ExtractInput, ExtractResult } from "@/lib/extraction/extract";
import type { Extraction } from "@/lib/extraction/schema";
import { createFixtureWorld, type FixtureWorld } from "@/lib/instagram/fixtures";
import { createJobDeps, type JobDeps, runNamedJob } from "@/lib/jobs";
import { getListingBySlug } from "@/lib/listings/queries";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-11-08T12:00:00-03:00");
const DAY = 86_400_000;

/**
 * Deterministic stand-in for Claude: reads model, year, km and price from the
 * fixture captions with regexes, so each fixture car becomes its own listing.
 */
const MODEL = /\b(XC\d0|EX\d0|C\d0|S\d0|V40 Cross Country|V\d0|850)\b/i;
function stubExtraction(caption: string): Extraction {
  const model = MODEL.exec(caption)?.[1] ?? null;
  const years = [...caption.matchAll(/\b(19[89]\d|20[0-2]\d)\b/g)].map((m) => Number(m[1]));
  const km = /([\d.]+)\s*(mil)?\s*km/i.exec(caption);
  const price = /R\$\s*([\d.]+)|Valor: (\d+) mil/.exec(caption);
  const forSale = !!model && !!price && !/for sale/i.test(caption);
  return {
    is_vehicle_for_sale: forSale,
    confidence: forSale ? 0.95 : 0.9,
    model: forSale ? model : null,
    engine: null,
    trim: null,
    version_text: null,
    year_fab: null,
    year_model: forSale ? (years.at(-1) ?? null) : null,
    km: null,
    km_text: forSale && km ? km[0] : null,
    price: null,
    price_text: forSale && price ? price[0] : null,
    city: null,
    uf: null,
    color: null,
    transmission: null,
    fuel: null,
    options: [],
    seller_type: "loja",
    phones: [],
    summary_ptbr: forSale ? "Carro em bom estado, com manutenção em dia." : "",
    red_flags: [],
  };
}

describe.skipIf(!url)("collection jobs (fixtures)", () => {
  let sql: postgres.Sql;
  let world: FixtureWorld;
  let deps: JobDeps;
  const extracted: ExtractInput[] = [];

  const cleanup = async () => {
    const fx = sql`select id from public.raw_posts where ig_media_id like 'fx%'`;
    const listings = sql`select listing_id from public.listing_sources where raw_post_id in (${fx})`;
    await sql`delete from public.listings where id in (${listings})`;
    await sql`delete from public.raw_posts where ig_media_id like 'fx%'`;
    await sql`delete from public.sources where handle ~ '[._]demo$'`;
    await sql`delete from public.hashtag_budget where ig_user_id like 'fx%'`;
    await sql`delete from public.job_runs`;
    await sql`delete from public.job_locks`;
  };

  const run = (name: Parameters<typeof runNamedJob>[1], options = {}) =>
    runNamedJob(sql, name, deps, { now: NOW, force: true, ...options });
  const listingOf = async (mediaId: string) => {
    const [row] = await sql<{ status: string; sold_at: Date | null; expires_at: Date | null }[]>`
      select l.status, l.sold_at, l.expires_at from public.listings l
      join public.listing_sources ls on ls.listing_id = l.id
      join public.raw_posts rp on rp.id = ls.raw_post_id
      where rp.ig_media_id = ${mediaId}`;
    return row;
  };

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, onnotice: () => {} });
    await cleanup();
    world = createFixtureWorld(NOW);
    deps = createJobDeps(parseServerEnv({}), {
      fixtures: world,
      extract: async (input): Promise<ExtractResult> => {
        extracted.push(input);
        return {
          output: stubExtraction(input.caption),
          model: "stub",
          usage: emptyUsage(),
          attempts: 1,
        };
      },
    });
    for (const handle of [...Object.keys(world.accounts), ...world.unavailable]) {
      await sql`insert into public.sources (type, handle) values ('ig_business_account', ${handle})`;
    }
    for (const tag of Object.keys(world.hashtags)) {
      await sql`insert into public.sources (type, handle, poll_interval_minutes) values ('ig_hashtag', ${tag}, 60)`;
    }
  });

  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it("a dry run reads the API but keeps nothing except its job_runs row", async () => {
    const result = await run("collect-business-discovery", { dryRun: true });
    expect(result.status).toBe("succeeded");
    expect(result.stats).toMatchObject({ scanned: 3, unavailable: 1, new: 33 });
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.raw_posts where ig_media_id like 'fx%'`;
    expect(count).toBe(0);
    const [runRow] = await sql<{ dry_run: boolean; status: string }[]>`
      select dry_run, status from public.job_runs where id = ${result.id}`;
    expect(runRow).toEqual({ dry_run: true, status: "succeeded" });
  });

  it("collects shops idempotently and records profile and errors on the sources", async () => {
    const first = await run("collect-business-discovery");
    expect(first.stats).toMatchObject({ scanned: 3, unavailable: 1, posts: 33, new: 33 });
    const again = await run("collect-business-discovery");
    expect(again.stats).toMatchObject({ posts: 33, new: 0, gone: 0 });

    const sources = await sql<
      {
        handle: string;
        ig_biography: string | null;
        last_error: string | null;
        consecutive_failures: number;
      }[]
    >`select handle, ig_biography, last_error, consecutive_failures from public.sources
      where type = 'ig_business_account' and handle ~ '[._]demo$' order by handle`;
    const byHandle = Object.fromEntries(sources.map((s) => [s.handle, s]));
    expect(byHandle["nordica.veiculos.demo"]!.ig_biography).toContain("(20) 3000-0100");
    expect(byHandle["nordica.veiculos.demo"]!.last_error).toBeNull();
    expect(byHandle["perfil.pessoal.demo"]!.last_error).toMatch(/Conta não encontrada/);
    expect(byHandle["perfil.pessoal.demo"]!.consecutive_failures).toBe(2);
  });

  it("skips the run while another one holds the lock", async () => {
    await sql`insert into public.job_locks (job_name, locked_until, locked_by)
              values ('collect-business-discovery', now() + interval '1 hour', 'other-worker')`;
    const result = await run("collect-business-discovery");
    expect(result).toMatchObject({ status: "skipped", stats: { reason: "locked" } });
    await sql`delete from public.job_locks`;
  });

  it("processes pending posts into listings, giving the extractor the account bio", async () => {
    const result = await run("process-posts", { limit: 100 });
    expect(result.status).toBe("succeeded");
    expect(result.stats).toMatchObject({ processed: 33 });
    expect(Number(result.stats.published)).toBeGreaterThanOrEqual(28);
    expect(Number(result.stats.prefiltered_out)).toBe(2); // store hours + "VENDIDO" post
    const nordica = extracted.find((i) => i.igUsername === "nordica.veiculos.demo");
    expect(nordica?.bio).toContain("Seminovos Volvo em Curitiba");
  });

  it("marks a listing sold when its caption is edited, and expires one whose post was deleted", async () => {
    expect((await listingOf("fxm_nordica_01"))?.status).toBe("active");
    expect((await listingOf("fxm_nordica_02"))?.status).toBe("active");
    const posts = world.accounts["nordica.veiculos.demo"]!.posts;
    posts.find((p) => p.id === "fxm_nordica_01")!.caption += "\n\nVENDIDO ✅";
    posts.splice(
      posts.findIndex((p) => p.id === "fxm_nordica_02"),
      1,
    );

    const result = await run("collect-business-discovery");
    expect(result.stats).toMatchObject({ captionChanged: 1, sold: 1, gone: 1, expired: 1 });
    expect(await listingOf("fxm_nordica_01")).toMatchObject({ status: "sold", sold_at: NOW });
    expect(await listingOf("fxm_nordica_02")).toMatchObject({ status: "expired", expires_at: NOW });
  });

  it("keeps hashtag queries inside the budget, counting searches Meta already registered", async () => {
    world.searched.push("fxh_manual"); // e.g. a search made by hand in the Graph API Explorer
    await sql`update public.app_settings set value = '2' where key = 'hashtag_budget_max'`;
    try {
      const result = await run("collect-hashtags");
      expect(result.stats).toMatchObject({
        syncedFromMeta: 1,
        queried: 1,
        skippedForBudget: 1,
        budgetUsed: 2,
      });
      expect(result.alerts.join(" ")).toMatch(/Orçamento de hashtags esgotado/);
      const budget = await sql<{ hashtag: string }[]>`
        select hashtag from public.hashtag_budget where ig_user_id = ${world.igUserId} order by hashtag`;
      expect(budget.map((b) => b.hashtag)).toContain("ext_fxh_manual");

      // A hashtag already in the window can be queried again without a new slot.
      const again = await run("collect-hashtags");
      expect(again.stats).toMatchObject({ queried: 1, skippedForBudget: 1, budgetUsed: 2 });
    } finally {
      await sql`update public.app_settings set value = '25' where key = 'hashtag_budget_max'`;
    }
    const rest = await run("collect-hashtags");
    expect(rest.stats).toMatchObject({ queried: 2, skippedForBudget: 0 });
    // A hashtag first registered as ext_<id> keeps a single slot once named.
    world.searched.push("fxh_volvoseminovo");
    await sql`delete from public.hashtag_budget where hashtag = 'volvoseminovo_demo'`;
    await sql`insert into public.hashtag_budget (ig_user_id, hashtag, ig_hashtag_id)
              values (${world.igUserId}, 'ext_fxh_volvoseminovo', 'fxh_volvoseminovo')`;
    await run("collect-hashtags");
    const slots = await sql<{ hashtag: string }[]>`
      select hashtag from public.hashtag_budget where ig_hashtag_id = 'fxh_volvoseminovo'`;
    expect(slots.map((s) => s.hashtag)).toEqual(["volvoseminovo_demo"]);
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.raw_posts where ig_media_id like 'fxm_tag_%'`;
    expect(count).toBe(5); // 4 + 1 from the last 24h; the 40h-old post is not returned
  });

  it("flags an old hashtag-only listing as possibly unavailable on its page", async () => {
    await run("process-posts", { limit: 100 });
    const slugOf = async (mediaId: string) => {
      const [row] = await sql<{ slug: string; id: string }[]>`
        select l.slug, l.id from public.listings l
        join public.listing_sources ls on ls.listing_id = l.id
        join public.raw_posts rp on rp.id = ls.raw_post_id
        where rp.ig_media_id = ${mediaId}`;
      return row!;
    };
    const tag = await slugOf("fxm_tag_02");
    const shop = await slugOf("fxm_nordica_04");
    expect((await getListingBySlug(tag.slug))?.possiblyUnavailable).toBe(false);
    await sql`update public.listings set first_seen_at = now() - interval '20 days'
              where id in (${tag.id}, ${shop.id})`;
    expect((await getListingBySlug(tag.slug))?.possiblyUnavailable).toBe(true);
    // Business Discovery posts are re-read, so their listings never get the warning.
    expect((await getListingBySlug(shop.slug))?.possiblyUnavailable).toBe(false);
  });

  it("expires hashtag-only listings after the configured days, leaving shop listings alone", async () => {
    await run("process-posts", { limit: 100 });
    expect((await listingOf("fxm_tag_01"))?.status).toBe("active");
    const later = new Date(NOW.getTime() + 31 * DAY);
    const result = await run("expire-listings", { now: later });
    expect(Number(result.stats.expired)).toBeGreaterThanOrEqual(1);
    expect((await listingOf("fxm_tag_01"))?.status).toBe("expired");
    expect((await listingOf("fxm_nordica_03"))?.status).toBe("active");
  });

  it("alerts before the token expires and fails when it is invalid", async () => {
    world.token.expiresInDays = 5;
    const soon = await run("token-health");
    expect(soon.status).toBe("succeeded");
    expect(soon.alerts.join(" ")).toMatch(/vence em 5 dia\(s\)/);

    world.token.valid = false;
    const invalid = await run("token-health");
    expect(invalid.status).toBe("failed");
    expect(invalid.error).toMatch(/Token do Instagram inválido/);
  });
});
