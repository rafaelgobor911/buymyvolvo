import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getAdminListing, moderationQueue } from "@/lib/admin/listings";
import { createManualListing } from "@/lib/admin/manual";
import { getOutreach } from "@/lib/authorization/data";
import type { ExtractResult } from "@/lib/extraction/extract";
import type { Extraction } from "@/lib/extraction/schema";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-11-17T12:00:00-03:00");
const ACTOR = "admin:admin.teste@example.com";

const base: Extraction = {
  is_vehicle_for_sale: true,
  confidence: 0.95,
  model: "XC60",
  engine: "T8",
  trim: "Inscription",
  version_text: "T8 Inscription",
  year_fab: 2019,
  year_model: 2020,
  km: 41000,
  km_text: "41.000 km",
  price: 239900,
  price_text: "R$ 239.900",
  city: "Curitiba",
  uf: "PR",
  color: "preto",
  transmission: "automatico",
  fuel: "hibrido_plugin",
  options: [],
  seller_type: "particular",
  phones: ["(41) 90000-0901"],
  summary_ptbr: "SUV híbrido plug-in com baixa quilometragem e manutenção em dia.",
  red_flags: [],
};

const TEXT_A =
  "Vendo Volvo XC60 T8 Inscription 19/20, preto, 41.000 km, R$ 239.900. Curitiba/PR. (41) 90000-0901";

const answer = (output: Extraction) =>
  vi.fn(async (): Promise<ExtractResult> => ({
    output,
    model: "claude-haiku-5-5",
    usage: { inputTokens: 3000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
    attempts: 1,
  }));

describe.skipIf(!url)("listings from pasted ads (database)", () => {
  let sql: postgres.Sql;
  const created: string[] = [];

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, onnotice: () => {} });
    await sql`insert into blocklist (kind, value, reason) values ('phone', '+5541900000999', 'teste')`;
  });

  afterAll(async () => {
    await sql`delete from listings where id = any(${created})`;
    await sql`delete from blocklist where value = '+5541900000999'`;
    await sql.end();
  });

  it("reads the text and creates a listing in moderation, to contact, with the text kept inside", async () => {
    const extract = answer(base);
    const result = await createManualListing(sql, {
      text: TEXT_A,
      channel: "olx",
      sourceUrl: "https://www.olx.com.br/anuncio/teste",
      phone: null,
      force: false,
      actor: ACTOR,
      extract,
      now: NOW,
    });
    expect(result).toMatchObject({ ok: true, ready: true });
    if (!result.ok) return;
    created.push(result.id);
    // The text goes to the extraction as data, without account or bio.
    expect(extract).toHaveBeenCalledWith({ caption: TEXT_A, igUsername: null, bio: null });

    const listing = (await getAdminListing(sql, result.id))!;
    expect(listing).toMatchObject({
      status: "pending_review",
      origin: "admin",
      modelId: "xc60",
      engineId: "t8",
      yearModel: 2020,
      priceCents: 23_990_000,
      phone: "+5541900000901",
      city: "Curitiba",
      uf: "PR",
      authorizedAt: null,
      post: null,
      manual: {
        channel: "olx",
        sourceUrl: "https://www.olx.com.br/anuncio/teste",
        text: TEXT_A,
        createdBy: ACTOR,
      },
    });
    expect((await getOutreach(sql, result.id)).status).toBe("to_contact");
    const queue = await moderationQueue(sql, { outreach: "to_contact" });
    expect(queue.map((q) => q.id)).toContain(result.id);

    const [audit] = await sql<{ actor: string; action: string; note: string }[]>`
      select actor, action, note from audit_log where entity_id = ${result.id}`;
    expect(audit).toEqual({
      actor: ACTOR,
      action: "listing.create_manual",
      note: "Anúncio colado (OLX)",
    });
    const [source] = await sql<{ tokens_in: number; extraction_model: string }[]>`
      select tokens_in, extraction_model from manual_sources where listing_id = ${result.id}`;
    expect(source).toEqual({ tokens_in: 3000, extraction_model: "claude-haiku-5-5" });

    // Not public: the text never reaches anon, and neither does the listing.
    await expect(
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        return tx`select text from manual_sources limit 1`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("the same car again is flagged as a duplicate, and can be created anyway", async () => {
    const again = await createManualListing(sql, {
      text: `${TEXT_A} Aceito troca.`,
      channel: "whatsapp",
      sourceUrl: null,
      phone: null,
      force: false,
      actor: ACTOR,
      extract: answer(base),
      now: NOW,
    });
    expect(again).toMatchObject({
      ok: false,
      error: "Já existe um anúncio deste carro.",
      duplicate: { id: created[0], status: "pending_review" },
    });

    const forced = await createManualListing(sql, {
      text: `${TEXT_A} Aceito troca.`,
      channel: "whatsapp",
      sourceUrl: null,
      phone: null,
      force: true,
      actor: ACTOR,
      extract: answer(base),
      now: NOW,
    });
    expect(forced.ok).toBe(true);
    if (forced.ok) created.push(forced.id);
  });

  it("the typed phone beats the text; blocked contacts and non-listings are refused", async () => {
    const typed = await createManualListing(sql, {
      text: "Volvo XC40 T5 R-Design 2019, 52 mil km, R$ 145.000, Londrina",
      channel: "webmotors",
      sourceUrl: null,
      phone: "+5543999990001",
      force: false,
      actor: ACTOR,
      extract: answer({
        ...base,
        model: "XC40",
        engine: "T5",
        trim: "R-Design",
        version_text: "T5 R-Design",
        year_fab: 2018,
        year_model: 2019,
        km: 52000,
        km_text: "52 mil km",
        price: 145000,
        price_text: "R$ 145.000",
        city: "Londrina",
        fuel: "gasolina",
        phones: [],
      }),
      now: NOW,
    });
    expect(typed.ok).toBe(true);
    if (!typed.ok) return;
    created.push(typed.id);
    expect((await getAdminListing(sql, typed.id))?.phone).toBe("+5543999990001");

    const blocked = await createManualListing(sql, {
      text: TEXT_A,
      channel: "olx",
      sourceUrl: null,
      phone: "+5541900000999",
      force: false,
      actor: ACTOR,
      extract: answer(base),
      now: NOW,
    });
    expect(blocked).toMatchObject({ ok: false, error: expect.stringMatching(/bloqueio/) });

    const notAListing = await createManualListing(sql, {
      text: "Encontro de Volvo antigos no domingo, venha com a família!",
      channel: "other",
      sourceUrl: null,
      phone: null,
      force: false,
      actor: ACTOR,
      extract: answer({ ...base, is_vehicle_for_sale: false, model: null }),
      now: NOW,
    });
    expect(notAListing).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Não encontrei um Volvo à venda/),
    });

    const failing = await createManualListing(sql, {
      text: TEXT_A,
      channel: "olx",
      sourceUrl: null,
      phone: null,
      force: true,
      actor: ACTOR,
      extract: async () => {
        throw new Error('401 {"error": "invalid x-api-key sk-ant-api03-NOT-A-REAL-KEY"}');
      },
      now: NOW,
    });
    expect(failing).toEqual({
      ok: false,
      error: 'A leitura do texto falhou: 401 {"error": "invalid x-api-key sk-ant-…"}',
      usage: expect.any(Object),
    });
  });
});
