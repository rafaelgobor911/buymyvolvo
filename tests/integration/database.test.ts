import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getListingBySlug, searchListings } from "@/lib/listings/queries";
import { PAGE_SIZE, resolveSearch } from "@/lib/search/filters";

import { migrate } from "../../scripts/db/lib";
import { FIXTURE_LISTINGS } from "../../scripts/db/fixtures";
import { fixtureSlug } from "../../scripts/db/sql-gen";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-11-07T12:00:00-03:00");

const search = (q: string, extra: Record<string, string> = {}) =>
  searchListings(resolveSearch({ q, ...extra }, { now: NOW }));

const slugOf = (predicate: (l: (typeof FIXTURE_LISTINGS)[number]) => boolean) =>
  FIXTURE_LISTINGS.map((l, i) => ({ l, slug: fixtureSlug(l, i) })).filter(({ l }) => predicate(l));

const activeCount = FIXTURE_LISTINGS.filter((l) => (l.status ?? "active") === "active").length;

describe.skipIf(!url)("database", () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(url!, { max: 1, onnotice: () => {} });
  });

  afterAll(async () => {
    await sql.end();
    await (globalThis as { __db?: postgres.Sql }).__db?.end();
  });

  describe("migrations", () => {
    it("are idempotent: a second run applies nothing", async () => {
      expect(await migrate(sql, () => {})).toEqual([]);
    });

    it("enable RLS on every public table", async () => {
      const rows = await sql<{ relname: string }[]>`
        select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
      expect(rows.map((r) => r.relname)).toEqual([]);
    });
  });

  describe("row level security (anon)", () => {
    const asAnon = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        return fn(tx);
      });

    it("hides pending and removed listings", async () => {
      const rows = await asAnon(
        (tx) => tx<{ status: string }[]>`select distinct status from listings`,
      );
      expect(rows.map((r) => r.status).sort()).toEqual(["active", "expired", "sold"]);
    });

    it.each([
      ["leads", "select * from leads"],
      ["listing phone", "select contact_phone_e164 from listings"],
      ["raw post caption", "select caption from raw_posts"],
      ["seller phone", "select phone_e164 from sellers"],
      ["blocklist", "select * from blocklist"],
      ["app settings", "select * from app_settings"],
    ])("denies %s", async (_name, query) => {
      await expect(asAnon((tx) => tx.unsafe(query))).rejects.toThrow(/permission denied/);
    });

    it("denies writes", async () => {
      await expect(
        asAnon((tx) => tx`update listings set price_cents = 1 where status = 'active'`),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("search acceptance (PROMPT.md §5 + §14)", () => {
    it("s60 t5 returns only S60 T5 (no S60 T4, no V60 T5)", async () => {
      const r = await search("s60 t5");
      const expected = slugOf(
        (l) => l.model === "s60" && l.engine === "t5" && (l.status ?? "active") === "active",
      );
      expect(r.total).toBe(expected.length);
      expect(r.items.map((i) => i.slug).sort()).toEqual(expected.map((e) => e.slug).sort());
      expect(r.items.every((i) => i.modelName === "S60" && i.engineName === "T5")).toBe(true);
    });

    it("S60T5 2019 filters the model year", async () => {
      const r = await search("S60T5 2019");
      expect(r.total).toBeGreaterThan(0);
      expect(r.items.every((i) => i.yearModel === 2019 && i.engineName === "T5")).toBe(true);
    });

    it("xc60 t8 polestar returns Polestar Engineered only", async () => {
      const r = await search("xc60 t8 polestar");
      expect(r.total).toBe(2);
      expect(r.items.every((i) => i.trimName === "Polestar Engineered")).toBe(true);
    });

    it("xc40 elétrico até 200 mil returns electric XC40/EX40 up to R$ 200k", async () => {
      const r = await search("xc40 elétrico até 200 mil");
      expect(r.total).toBe(2);
      expect(r.items.every((i) => i.fuel === "eletrico" && (i.priceCents ?? 0) <= 200_000_00)).toBe(
        true,
      );
      expect(new Set(r.items.map((i) => i.modelName))).toEqual(new Set(["XC40", "EX40"]));
    });

    it("v40 r-design sp includes the V40 Cross Country", async () => {
      const r = await search("v40 r-design sp");
      expect(r.items.every((i) => i.uf === "SP" && i.trimName === "R-Design")).toBe(true);
      expect(new Set(r.items.map((i) => i.modelName))).toEqual(
        new Set(["V40", "V40 Cross Country"]),
      );
    });

    it("xc90 t8 2020 a 2022 até 60 mil km applies years and km", async () => {
      const r = await search("xc90 t8 2020 a 2022 até 60 mil km");
      expect(r.total).toBe(2);
      for (const i of r.items) {
        expect(i.yearModel).toBeGreaterThanOrEqual(2020);
        expect(i.yearModel).toBeLessThanOrEqual(2022);
        expect(i.km).toBeLessThanOrEqual(60_000);
      }
    });

    it("850 t5r and c30 t5 manual", async () => {
      expect((await search("850 t5r")).items.map((i) => i.engineName)).toEqual(["T-5R"]);
      const c30 = await search("c30 t5 manual");
      expect(c30.total).toBe(1);
      expect(c30.items[0]?.transmission).toBe("manual");
    });

    it("volvo de loja em curitiba", async () => {
      const r = await search("volvo de loja em curitiba");
      expect(r.total).toBe(5);
      expect(r.items.every((i) => i.city === "Curitiba" && i.sellerType === "loja")).toBe(true);
    });

    it("xc60 t8 sp até 250 mil applies every filter (§14)", async () => {
      const r = await search("xc60 t8 sp até 250 mil");
      expect(r.total).toBe(2);
      for (const i of r.items) {
        expect(i.uf).toBe("SP");
        expect(i.priceCents).toBeLessThanOrEqual(250_000_00);
        expect(i.engineName).toBe("T8");
      }
    });

    it("tolerates typos in free text", async () => {
      expect((await search("teto solr")).total).toBeGreaterThan(0);
    });

    it("explicit filter params override what was parsed from q", async () => {
      const r = await search("s60 t5", { motor: "t4" });
      expect(r.items.every((i) => i.engineName === "T4")).toBe(true);
      expect(r.total).toBe(1);
    });
  });

  describe("listing pages and pagination", () => {
    it("paginates all active listings", async () => {
      const page1 = await search("");
      expect(page1.total).toBe(activeCount);
      expect(page1.items).toHaveLength(PAGE_SIZE);
      const last = await search("", { pagina: String(page1.pageCount) });
      expect(last.items.length).toBe(activeCount - PAGE_SIZE * (page1.pageCount - 1));
    });

    it("sorts by price and km", async () => {
      const byPrice = await search("", { ordem: "menor-preco" });
      const prices = byPrice.items.map((i) => i.priceCents!);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      const byKm = await search("", { ordem: "menor-km" });
      const kms = byKm.items.map((i) => i.km!);
      expect(kms).toEqual([...kms].sort((a, b) => a - b));
    });

    it("never returns removed or pending listings by slug", async () => {
      for (const { slug } of slugOf(
        (l) => l.status === "removed" || l.status === "pending_review",
      )) {
        expect(await getListingBySlug(slug)).toBeNull();
      }
    });

    it("still shows sold listings (with their status)", async () => {
      const [sold] = slugOf((l) => l.status === "sold");
      expect((await getListingBySlug(sold!.slug))?.status).toBe("sold");
    });
  });
});
