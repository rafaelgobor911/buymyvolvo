import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAdminListing, moderationQueue, saveListing } from "@/lib/admin/listings";
import { getOutreach } from "@/lib/authorization/data";
import { SELLER_TERMS_VERSION } from "@/content/seller-terms";
import { adminDeletePhoto, addPhoto, listPhotos } from "@/lib/photos/data";
import { createPublicListing, submittedListingForPhotos } from "@/lib/submissions/create";
import { parsePublicListingForm, type PublicListing } from "@/lib/submissions/form";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-11-18T12:00:00-03:00");
const ADMIN = { actor: "admin:admin.teste@example.com", adminEmail: "admin.teste@example.com" };

const parsed = parsePublicListingForm(
  {
    modelo: "xc40",
    motor: "t5",
    versao: "r-design",
    ano_fab: "2019",
    ano_modelo: "2020",
    km: "33.000",
    preco: "169.900",
    cidade: "Joinville",
    uf: "SC",
    cambio: "automatico",
    combustivel: "gasolina",
    descricao: "Carro de garagem, revisões em dia.",
    tipo: "particular",
    nome: "Pessoa Teste Formulário",
    whatsapp: "(47) 90000-0911",
    cpf: "135.792.468-28",
    termos: "on",
  },
  NOW,
);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const LISTING: PublicListing = parsed.listing;

describe.skipIf(!url)("public listing form (database)", () => {
  let sql: postgres.Sql;
  let savedCommission: unknown;
  const created: string[] = [];

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, onnotice: () => {} });
    [{ value: savedCommission }] = await sql<{ value: unknown }[]>`
      select value from app_settings where key = 'seller_commission_brl'`;
    await sql`update app_settings set value = '1500' where key = 'seller_commission_brl'`;
    await sql`insert into blocklist (kind, value, reason) values ('phone', '+5547900000999', 'teste')`;
  });

  afterAll(async () => {
    await sql`delete from listings where id = any(${created})`;
    await sql`delete from sellers where phone_e164 like '+554790000091%'`;
    await sql`delete from blocklist where value = '+5547900000999'`;
    await sql`update app_settings set value = ${sql.json(savedCommission as number)}
              where key = 'seller_commission_brl'`;
    await sql.end();
  });

  it("the form's listing enters moderation already authorized, with the seller and the terms", async () => {
    const result = await createPublicListing(sql, { listing: LISTING, ipHash: "ip-a", now: NOW });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    created.push(result.listingId);

    const listing = (await getAdminListing(sql, result.listingId))!;
    expect(listing).toMatchObject({
      status: "pending_review",
      origin: "direct",
      modelId: "xc40",
      engineId: "t5",
      trimId: "r-design",
      yearModel: 2020,
      priceCents: 16_990_000,
      city: "Joinville",
      uf: "SC",
      phone: "+5547900000911",
      authorizedAt: NOW,
      post: null,
      manual: null,
    });
    const outreach = await getOutreach(sql, result.listingId);
    expect(outreach).toMatchObject({
      status: "authorized",
      commissionCents: 150_000,
      termsVersion: SELLER_TERMS_VERSION,
      seller: { name: "Pessoa Teste Formulário", type: "particular", phone: "+5547900000911" },
    });
    // The form does not prove the phone: the seller is not marked as verified.
    const [seller] = await sql<{ verified_via: string | null; cpf: string }[]>`
      select verified_via, cpf from sellers where phone_e164 = '+5547900000911'`;
    expect(seller).toEqual({ verified_via: null, cpf: "13579246828" });
    const terms = await sql<{ terms: string }[]>`
      select terms from terms_acceptances where seller_id = ${outreach.seller!.id} order by terms`;
    expect(terms.map((t) => t.terms)).toEqual(["photo_license", "seller_terms"]);
    const [row] = await sql<{ seller_description: string }[]>`
      select seller_description from listings where id = ${result.listingId}`;
    expect(row?.seller_description).toBe("Carro de garagem, revisões em dia.");

    const authorized = await moderationQueue(sql, { outreach: "authorized" });
    expect(authorized.map((q) => q.id)).toContain(result.listingId);

    // The admin approves: public.
    expect(
      await saveListing(sql, { id: result.listingId, patch: listing, approve: true, ...ADMIN }),
    ).toMatchObject({ ok: true });
    const visible = await sql.begin(async (tx) => {
      await tx`set local role anon`;
      return tx`select id from public.listings where id = ${result.listingId}`;
    });
    expect(visible).toHaveLength(1);
  });

  it("photos go to listings sent by the form while in moderation; the admin can delete them", async () => {
    const result = await createPublicListing(sql, {
      listing: { ...LISTING, phone: "+5547900000912", km: 90000, yearModel: 2019, yearFab: 2019 },
      ipHash: "ip-b",
      now: NOW,
    });
    if (!result.ok) throw new Error(result.error);
    created.push(result.listingId);
    const target = await submittedListingForPhotos(sql, result.listingId);
    expect(target?.id).toBe(result.listingId);
    const photoId = "00000000-0000-4000-9000-000000000911";
    expect(
      await addPhoto(sql, {
        id: photoId,
        listingId: result.listingId,
        sellerId: target!.sellerId,
        storagePath: `${result.listingId}/${photoId}`,
        width: 1600,
        height: 1200,
        licenseVersion: SELLER_TERMS_VERSION,
        actor: "public:listing-form",
      }),
    ).toEqual({ ok: true });
    expect(await listPhotos(sql, result.listingId)).toHaveLength(1);
    expect(await adminDeletePhoto(sql, { photoId, actor: ADMIN.actor })).toBe(
      `${result.listingId}/${photoId}`,
    );
    expect(await listPhotos(sql, result.listingId)).toHaveLength(0);

    // Instagram listings, or listings already out of moderation, take no photos this way.
    await sql`update listings set status = 'rejected', rejected_at = now() where id = ${result.listingId}`;
    expect(await submittedListingForPhotos(sql, result.listingId)).toBeNull();
    expect(await submittedListingForPhotos(sql, "not-a-uuid")).toBeNull();
  });

  it("the CPF identifies the seller, even from another WhatsApp", async () => {
    const before = await sql<{ id: string }[]>`select id from sellers where cpf = '13579246828'`;
    const result = await createPublicListing(sql, {
      listing: {
        ...LISTING,
        phone: "+5547900000914",
        modelId: "s60",
        engineId: "t5",
        trimId: null,
      },
      ipHash: "ip-f",
      now: NOW,
    });
    if (!result.ok) throw new Error(result.error);
    created.push(result.listingId);
    const [row] = await sql<{ seller_id: string; contact_phone_e164: string }[]>`
      select seller_id, contact_phone_e164 from listings where id = ${result.listingId}`;
    expect(row).toEqual({ seller_id: before[0]!.id, contact_phone_e164: "+5547900000914" });
  });

  it("limits listings per device, refuses blocked phones and flags a likely duplicate", async () => {
    await sql`update app_settings set value = '2' where key = 'public_listings_per_day'`;
    try {
      const first = await createPublicListing(sql, {
        listing: {
          ...LISTING,
          phone: "+5547900000913",
          modelId: "v60",
          engineId: "t5",
          trimId: null,
        },
        ipHash: "ip-c",
        now: NOW,
      });
      if (!first.ok) throw new Error(first.error);
      created.push(first.listingId);
      // Same car, same phone: created, with a note for the admin.
      const again = await createPublicListing(sql, {
        listing: {
          ...LISTING,
          phone: "+5547900000913",
          modelId: "v60",
          engineId: "t5",
          trimId: null,
        },
        ipHash: "ip-c",
        now: NOW,
      });
      if (!again.ok) throw new Error(again.error);
      created.push(again.listingId);
      const [note] = await sql<{ review_note: string }[]>`
        select review_note from listings where id = ${again.listingId}`;
      expect(note?.review_note).toBe(`Parece um anúncio que já existe (${first.shortId}).`);

      expect(
        await createPublicListing(sql, { listing: LISTING, ipHash: "ip-c", now: NOW }),
      ).toMatchObject({ ok: false, code: "rate_limited" });
    } finally {
      await sql`update app_settings set value = '3' where key = 'public_listings_per_day'`;
    }

    expect(
      await createPublicListing(sql, {
        listing: { ...LISTING, phone: "+5547900000999" },
        ipHash: "ip-d",
        now: NOW,
      }),
    ).toMatchObject({ ok: false, code: "refused" });

    await sql`update app_settings set value = '0' where key = 'seller_commission_brl'`;
    expect(
      await createPublicListing(sql, { listing: LISTING, ipHash: "ip-e", now: NOW }),
    ).toMatchObject({ ok: false, code: "unavailable" });
    await sql`update app_settings set value = '1500' where key = 'seller_commission_brl'`;
  });
});
