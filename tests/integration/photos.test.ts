import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setSellerPlan } from "@/lib/admin/ops";
import { addPhoto, coverPhotos, deletePhoto, listPhotos, movePhoto } from "@/lib/photos/data";
import { PHOTOS_PER_LISTING } from "@/lib/photos/process";
import { testUserId } from "@/lib/sellers/access";
import { saveSellerProfile, sellerEditableListing, updateSellerListing } from "@/lib/sellers/data";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("seller photos and editing (database)", () => {
  let sql: postgres.Sql;
  let listingId: string;
  let sellerId: string;
  let otherSellerId: string;

  const profile = async (email: string) => {
    const r = await saveSellerProfile(sql, {
      authUserId: testUserId(email),
      email,
      displayName: email.split("@")[0]!,
      type: "loja",
      phone: "",
    });
    if (!r.ok) throw new Error("profile");
    return r.sellerId;
  };
  const photo = (n: number) => ({
    id: randomUUID(),
    listingId,
    sellerId,
    storagePath: `${listingId}/foto-${n}`,
    width: 1600,
    height: 1200,
    licenseVersion: "v-teste",
    actor: `seller:${sellerId}`,
  });

  beforeAll(async () => {
    sql = postgres(url!, { max: 2, onnotice: () => {} });
    sellerId = await profile("fotos.a@example.com");
    otherSellerId = await profile("fotos.b@example.com");
    [{ id: listingId }] = await sql<{ id: string }[]>`
      insert into listings (slug, status, origin, model_id, engine_id, year_model, price_cents,
        contact_phone_e164, seller_id, is_claimed)
      values ('volvo-xc40-t5-2020-teste-ph001', 'active', 'instagram', 'xc40', 't5', 2020, 15000000,
        '+5541900000601', ${sellerId}, true)
      returning id`;
  });

  afterAll(async () => {
    await sql`delete from listings where id = ${listingId}`;
    await sql`delete from sellers where id = any(${[sellerId, otherSellerId]})`;
    await sql.end();
  });

  it("adds photos in order up to the limit, only for the owner", async () => {
    expect(await addPhoto(sql, { ...photo(0), sellerId: otherSellerId })).toEqual({
      ok: false,
      error: "Anúncio não encontrado.",
    });
    for (let n = 0; n < PHOTOS_PER_LISTING; n++)
      expect(await addPhoto(sql, photo(n))).toEqual({ ok: true });
    expect(await addPhoto(sql, photo(99))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/até 15 fotos/),
    });
    const photos = await listPhotos(sql, listingId);
    expect(photos.map((p) => p.position)).toEqual([...Array(PHOTOS_PER_LISTING).keys()]);
    expect((await coverPhotos(sql, [listingId])).get(listingId)).toBe(`${listingId}/foto-0`);
  });

  it("reorders and deletes; another seller cannot touch them", async () => {
    const [first, second] = await listPhotos(sql, listingId);
    expect(await movePhoto(sql, { photoId: second!.id, sellerId, direction: "up" })).toBe(true);
    expect(await movePhoto(sql, { photoId: second!.id, sellerId, direction: "up" })).toBe(false);
    expect((await listPhotos(sql, listingId))[0]!.id).toBe(second!.id);
    expect(
      await movePhoto(sql, { photoId: first!.id, sellerId: otherSellerId, direction: "up" }),
    ).toBe(false);

    expect(
      await deletePhoto(sql, { photoId: first!.id, sellerId: otherSellerId, actor: "seller:x" }),
    ).toBeNull();
    expect(
      await deletePhoto(sql, { photoId: first!.id, sellerId, actor: `seller:${sellerId}` }),
    ).toBe(`${listingId}/foto-0`);
    expect(await listPhotos(sql, listingId)).toHaveLength(PHOTOS_PER_LISTING - 1);
  });

  it("the public (anon) reads photos of visible listings by granted columns", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`set local role anon`;
      return tx<{ storage_path: string }[]>`
        select storage_path from public.listing_photos where listing_id = ${listingId}
        order by position, id limit 1`;
    });
    expect(rows[0]?.storage_path).toBe(`${listingId}/foto-1`);
    await expect(
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        return tx`select license_terms_version from public.listing_photos limit 1`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("seller edits are saved with an audit entry; others cannot edit", async () => {
    const current = (await sellerEditableListing(sql, { sellerId, listingId }))!;
    const edit = {
      priceCents: 14_500_000,
      km: 30000,
      color: "preto",
      transmission: "automatico" as const,
      fuel: "gasolina" as const,
      city: "Curitiba",
      uf: "PR",
      phone: current.phone,
      igUsername: null,
      description: "Revisado.",
      options: ["teto solar"],
    };
    expect(
      await updateSellerListing(sql, {
        sellerId: otherSellerId,
        listingId,
        edit,
        actor: "seller:x",
      }),
    ).toEqual({
      ok: false,
      error: "Anúncio não encontrado.",
    });
    expect(
      await updateSellerListing(sql, { sellerId, listingId, edit, actor: `seller:${sellerId}` }),
    ).toMatchObject({
      ok: true,
    });
    const [audit] = await sql<{ action: string; changes: Record<string, unknown> }[]>`
      select action, changes from audit_log where entity = 'listing' and entity_id = ${listingId}
      order by at desc, id desc limit 1`;
    expect(audit?.action).toBe("listing.seller_update");
    expect(audit?.changes).toMatchObject({
      priceCents: { from: 15_000_000, to: 14_500_000 },
      description: { from: null, to: "Revisado." },
    });
  });

  it("the admin sets a plan by hand (audited)", async () => {
    expect(await setSellerPlan(sql, { sellerId, plan: "nope", actor: "admin:a@example.com" })).toBe(
      false,
    );
    expect(
      await setSellerPlan(sql, { sellerId, plan: "destaque", actor: "admin:a@example.com" }),
    ).toBe(true);
    const [row] = await sql<{ plan: string }[]>`select plan from sellers where id = ${sellerId}`;
    expect(row?.plan).toBe("destaque");
  });
});
