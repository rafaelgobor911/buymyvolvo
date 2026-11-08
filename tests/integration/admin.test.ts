import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadDashboard } from "@/lib/admin/dashboard";
import { parseListingForm } from "@/lib/admin/listing-form";
import {
  getAdminListing,
  listingHistory,
  moderationQueue,
  nextInQueue,
  saveListing,
  searchAdminListings,
  setListingStatus,
} from "@/lib/admin/listings";
import { readSettings, saveSettings } from "@/lib/admin/settings";

const url = process.env.TEST_DATABASE_URL;
const ADMIN = { actor: "admin:admin.teste@example.com", adminEmail: "admin.teste@example.com" };

describe.skipIf(!url)("admin (database)", () => {
  let sql: postgres.Sql;
  let sourceId: string;
  let pendingId: string;
  let otherPendingId: string;
  let activeId: string;

  beforeAll(async () => {
    sql = postgres(url!, { max: 2, onnotice: () => {} });
    [{ id: sourceId }] = await sql<{ id: string }[]>`
      insert into sources (type, handle, active) values ('ig_business_account', 'admin_test', false)
      returning id`;
    const listing = async (suffix: string, status: string, createdAgo: string) => {
      const [{ id }] = await sql<{ id: string }[]>`
        insert into listings (slug, status, origin, model_id, engine_id, year_fab, year_model, km,
          price_cents, city, uf, contact_phone_e164, confidence, created_at)
        values (${`volvo-xc40-t5-2019-teste-${suffix}`}, ${status}, 'instagram', 'xc40', 't5',
          2018, 2019, 52000, 14500000, 'Curitiba', 'PR', '+5541900000301', 0.6,
          now() - ${createdAgo}::interval)
        returning id`;
      return id;
    };
    // Older than anything in the seed, so they lead the queue.
    pendingId = await listing("adm001", "pending_review", "400 days");
    otherPendingId = await listing("adm002", "pending_review", "399 days");
    activeId = await listing("adm003", "active", "1 day");
    const [{ id: postId }] = await sql<{ id: string }[]>`
      insert into raw_posts (ig_media_id, source_id, permalink, caption, processing_status, extraction_json)
      values ('admin-test-media', ${sourceId}, 'https://www.instagram.com/p/AdminTest/',
        'Vendo XC40 T5 2019 R$ 145 mil', 'extracted',
        ${sql.json({ normalized: { issues: [{ code: "year_invalid", message: "Ano incoerente." }] } })})
      returning id`;
    await sql`insert into listing_sources (listing_id, raw_post_id, is_primary) values (${pendingId}, ${postId}, true)`;
  });

  afterAll(async () => {
    const ids = [pendingId, otherPendingId, activeId];
    await sql`delete from listings where id = any(${ids})`;
    await sql`delete from raw_posts where source_id = ${sourceId}`;
    await sql`delete from sources where id = ${sourceId}`;
    await sql`update app_settings set value = '10' where key = 'token_alert_days'`;
    await sql.end();
  });

  it("lists the moderation queue oldest first, with the post and its issues", async () => {
    const queue = await moderationQueue(sql);
    expect(queue.slice(0, 2).map((q) => q.id)).toEqual([pendingId, otherPendingId]);
    expect(queue[0]).toMatchObject({ title: "XC40 T5", firstIssue: "Ano incoerente." });
    expect(await nextInQueue(sql, pendingId)).toBe(otherPendingId);

    const listing = await getAdminListing(sql, pendingId);
    expect(listing?.post).toMatchObject({
      caption: "Vendo XC40 T5 2019 R$ 145 mil",
      issues: [{ code: "year_invalid", message: "Ano incoerente." }],
    });
    expect(await getAdminListing(sql, "not-a-uuid")).toBeNull();
  });

  it("approving saves the fixes, rebuilds the slug, publishes and records everything", async () => {
    const current = (await getAdminListing(sql, pendingId))!;
    const parsed = parseListingForm(
      {
        modelo: "xc40",
        motor: "t5",
        versao: "r-design",
        ano_fab: "2018",
        ano_modelo: "2019",
        km: "52.000",
        preco: "139.900",
        cidade: "Curitiba",
        uf: "PR",
        vendedor: "particular",
        telefone: current.phone!,
        alertas: [],
      },
      current,
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const result = await saveListing(sql, {
      id: pendingId,
      patch: parsed.patch,
      approve: true,
      ...ADMIN,
    });
    expect(result.ok).toBe(true);

    const after = (await getAdminListing(sql, pendingId))!;
    expect(after).toMatchObject({
      status: "active",
      trimId: "r-design",
      priceCents: 13_990_000,
      sellerType: "particular",
      slug: `volvo-xc40-t5-r-design-2019-curitiba-pr-${current.shortId}`,
      shortId: current.shortId,
    });

    const [history] = await listingHistory(sql, pendingId);
    expect(history).toMatchObject({ actor: ADMIN.actor, action: "listing.approve" });
    expect(history!.changes).toMatchObject({
      trimId: { from: null, to: "r-design" },
      priceCents: { from: 14_500_000, to: 13_990_000 },
      status: { from: "pending_review", to: "active" },
    });

    const corrections = await sql<{ field: string; extracted: unknown; corrected: unknown }[]>`
      select field, extracted, corrected from extraction_corrections
      where listing_id = ${pendingId} order by field`;
    expect(corrections.map((c) => c.field)).toEqual(["priceCents", "sellerType", "trimId"]);
    expect(corrections.find((c) => c.field === "priceCents")).toMatchObject({
      extracted: 14_500_000,
      corrected: 13_990_000,
    });
  });

  it("publishing needs the minimum fields; rejecting needs a reason", async () => {
    const current = (await getAdminListing(sql, otherPendingId))!;
    const noYear = parseListingForm({ modelo: "xc40", ano_modelo: "" }, current);
    if (!noYear.ok) throw new Error("expected a valid form");
    expect(
      await saveListing(sql, {
        id: otherPendingId,
        patch: { ...noYear.patch, phone: null },
        approve: true,
        ...ADMIN,
      }),
    ).toEqual({ ok: false, error: "Para publicar, informe o ano-modelo e o preço ou um contato." });

    expect(
      await setListingStatus(sql, { id: otherPendingId, status: "rejected", actor: ADMIN.actor }),
    ).toEqual({
      ok: false,
      error: "Diga o motivo da rejeição.",
    });
    expect(
      await setListingStatus(sql, {
        id: otherPendingId,
        status: "rejected",
        actor: ADMIN.actor,
        note: "Não é anúncio de venda",
      }),
    ).toEqual({ ok: true, changed: 1 });
    const [row] = await sql<{ status: string; rejected_at: Date | null; review_note: string }[]>`
      select status, rejected_at, review_note from listings where id = ${otherPendingId}`;
    expect(row).toMatchObject({ status: "rejected", review_note: "Não é anúncio de venda" });
    expect(row!.rejected_at).toBeInstanceOf(Date);

    // A published listing keeps its slug when edited (links must not break).
    const active = (await getAdminListing(sql, activeId))!;
    const edit = parseListingForm(
      {
        modelo: "xc40",
        motor: "t5",
        ano_modelo: "2019",
        cidade: "Londrina",
        uf: "PR",
        preco: "145.000",
      },
      active,
    );
    if (!edit.ok) throw new Error("expected a valid form");
    await saveListing(sql, {
      id: activeId,
      patch: { ...edit.patch, phone: active.phone },
      ...ADMIN,
    });
    expect((await getAdminListing(sql, activeId))?.slug).toBe(active.slug);
    // Not from moderation: no extraction correction recorded.
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from extraction_corrections where listing_id = ${activeId}`;
    expect(n).toBe(0);
  });

  it("finds listings by short code and status", async () => {
    const active = (await getAdminListing(sql, activeId))!;
    const byCode = await searchAdminListings(sql, { q: active.shortId });
    expect(byCode.items.map((i) => i.id)).toEqual([activeId]);
    const rejected = await searchAdminListings(sql, { status: "rejected" });
    expect(rejected.items.map((i) => i.id)).toContain(otherPendingId);
    expect(rejected.items.every((i) => i.status === "rejected")).toBe(true);
  });

  it("saves settings with an audit entry", async () => {
    const values = await readSettings(sql);
    expect(await saveSettings(sql, { ...values, token_alert_days: 12 }, ADMIN.actor)).toBe(1);
    expect((await readSettings(sql)).token_alert_days).toBe(12);
    expect(await saveSettings(sql, { ...values, token_alert_days: 12 }, ADMIN.actor)).toBe(0);
    const [entry] = await sql<{ entity_id: string; changes: unknown }[]>`
      select entity_id, changes from audit_log where entity = 'app_settings' order by at desc, id desc limit 1`;
    expect(entry).toEqual({
      entity_id: "token_alert_days",
      changes: { value: { from: 10, to: 12 } },
    });
  });

  it("the dashboard counts the queue; the audit trail is append-only and private", async () => {
    const dashboard = await loadDashboard(sql);
    expect(dashboard.pending).toBeGreaterThan(0);
    expect(dashboard.alerts[0]).toMatchObject({ href: "/admin/moderacao" });

    await expect(sql`update audit_log set note = 'x'`).rejects.toThrow(/append-only/);
    await expect(sql`delete from audit_log`).rejects.toThrow(/append-only/);
    for (const table of ["audit_log", "extraction_corrections"]) {
      await expect(
        sql.begin(async (tx) => {
          await tx`set local role anon`;
          return tx`select * from ${tx(table)} limit 1`;
        }),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
