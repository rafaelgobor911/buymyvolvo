/**
 * A listing sent by its seller through the public form (Phase 9b). The seller
 * accepts the Termos do Anunciante (commission and photo license) in the form,
 * so the listing enters moderation already authorized; the admin confirms with
 * the seller by WhatsApp, reviews and approves.
 *
 * Anti-abuse: a honeypot (in the action), a limit of listings per device per
 * day (salted hash of the IP) and the blocklist. Receives `sql` by parameter.
 */
import type postgres from "postgres";

import { SELLER_TERMS_VERSION } from "@/content/seller-terms";
import { commissionCents, recordSellerTerms, upsertSeller } from "@/lib/authorization/data";
import { dedupeKey } from "@/lib/extraction/dedupe";
import type { NormalizedListing } from "@/lib/extraction/normalize";
import { findExistingListing, isBlocked, shortId } from "@/lib/extraction/pipeline";
import { listingSlug } from "@/lib/listings/format";
import { getEngine, getModel, getTrim } from "@/lib/taxonomy";

import type { PublicListing } from "./form";

type Sql = postgres.Sql;

export type SubmitResult =
  | { ok: true; listingId: string; shortId: string }
  | { ok: false; code: "unavailable" | "rate_limited" | "refused"; error: string };

/** Whether the form can take listings now (the commission must be defined). */
export async function publicFormAvailable(sql: Sql): Promise<boolean> {
  return (await commissionCents(sql)) !== null;
}

/** The same fields the pipeline's dedupe uses, from the form. */
const asNormalized = (l: PublicListing): NormalizedListing =>
  ({
    isListing: true,
    modelId: l.modelId,
    engineId: l.engineId,
    trimId: l.trimId,
    yearModel: l.yearModel,
    km: l.km,
    contactPhone: l.phone,
    contactIgUsername: null,
  }) as NormalizedListing;

export async function createPublicListing(
  sql: Sql,
  input: { listing: PublicListing; ipHash: string | null; now?: Date },
): Promise<SubmitResult> {
  const now = input.now ?? new Date();
  const l = input.listing;
  const commission = await commissionCents(sql);
  if (!commission) {
    return {
      ok: false,
      code: "unavailable",
      error: "O cadastro de anúncios abre em breve. Fale com a gente pelo Instagram.",
    };
  }
  if (input.ipHash) {
    const [limit] = await sql<{ value: unknown }[]>`
      select value from public.app_settings where key = 'public_listings_per_day'`;
    const perDay = Number(limit?.value) > 0 ? Number(limit?.value) : 3;
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.listing_submissions
      where ip_hash = ${input.ipHash} and created_at > now() - interval '24 hours'`;
    if (n >= perDay) {
      return {
        ok: false,
        code: "rate_limited",
        error: "Muitos anúncios enviados deste aparelho hoje. Tente amanhã ou fale com a gente.",
      };
    }
  }
  if (await isBlocked(sql, "phone", l.phone)) {
    return {
      ok: false,
      code: "refused",
      error: "Não foi possível cadastrar este anúncio. Fale com a gente pelo Instagram.",
    };
  }

  const n = asNormalized(l);
  const key = dedupeKey(n);
  return sql.begin(async (tx) => {
    const existing = await findExistingListing(tx, n, key, l.description ?? "");
    if (existing?.status === "removed") {
      return {
        ok: false as const,
        code: "refused" as const,
        error:
          "Este carro foi retirado do site a pedido do vendedor. Fale com a gente pelo Instagram.",
      };
    }
    let similar: string | null = null;
    if (existing) {
      const [row] = await tx<{ short_id: string }[]>`
        select short_id from public.listings where id = ${existing.id}`;
      similar = row?.short_id ?? null;
    }

    const sellerId = await upsertSeller(tx, {
      name: l.name,
      type: l.sellerType,
      phone: l.phone,
      email: l.email,
      cpf: l.cpf,
      cnpj: l.cnpj,
      via: null,
      now,
    });
    await recordSellerTerms(tx, sellerId, now);

    const slug = listingSlug(
      {
        modelName: getModel(l.modelId)!.name,
        engineName: l.engineId ? getEngine(l.engineId)?.name : null,
        trimName: l.trimId ? getTrim(l.trimId)?.name : null,
        yearModel: l.yearModel,
        city: l.city,
        uf: l.uf,
      },
      shortId(),
    );
    const [listing] = await tx<{ id: string; short_id: string }[]>`
      insert into public.listings (
        slug, status, origin, model_id, engine_id, trim_id, version_text, year_fab, year_model,
        km, price_cents, city, uf, color, transmission, fuel, options, seller_type, seller_id,
        contact_phone_e164, seller_description, red_flags, first_seen_at, last_seen_at,
        dedupe_key, authorized_at, review_note
      ) values (
        ${slug}, 'pending_review', 'direct', ${l.modelId}, ${l.engineId}, ${l.trimId},
        ${l.versionText}, ${l.yearFab}, ${l.yearModel}, ${l.km}, ${l.priceCents}, ${l.city},
        ${l.uf}, ${l.color}, ${l.transmission}, ${l.fuel}, ${l.options}, ${l.sellerType},
        ${sellerId}, ${l.phone}, ${l.description}, ${[]}, ${now}, ${now}, ${key}, ${now},
        ${similar ? `Parece um anúncio que já existe (${similar}).` : null}
      ) returning id, short_id`;
    await tx`
      insert into public.listing_outreach (
        listing_id, status, responded_at, seller_id, terms_version, commission_cents
      ) values (
        ${listing!.id}, 'authorized', ${now}, ${sellerId}, ${SELLER_TERMS_VERSION}, ${commission}
      )`;
    await tx`
      insert into public.listing_submissions (listing_id, ip_hash, created_at)
      values (${listing!.id}, ${input.ipHash}, ${now})`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes, note)
      values ('public:listing-form', 'listing.submit', 'listing', ${listing!.id},
        ${tx.json({
          status: { from: null, to: "pending_review" },
          authorized_at: { from: null, to: now.toISOString() },
          commission_cents: { from: null, to: commission },
        })},
        ${"Anúncio enviado pelo vendedor no formulário do site"})`;
    return { ok: true as const, listingId: listing!.id, shortId: listing!.short_id };
  });
}

/** The listing a photo upload may go to: sent by the form, still in moderation. */
export async function submittedListingForPhotos(
  sql: Sql,
  listingId: string,
): Promise<{ id: string; sellerId: string } | null> {
  if (!/^[0-9a-f-]{36}$/.test(listingId)) return null;
  const [row] = await sql<{ id: string; seller_id: string | null }[]>`
    select l.id, l.seller_id from public.listings l
    join public.listing_submissions s on s.listing_id = l.id
    where l.id = ${listingId} and l.status = 'pending_review' and l.origin = 'direct'`;
  return row?.seller_id ? { id: row.id, sellerId: row.seller_id } : null;
}
