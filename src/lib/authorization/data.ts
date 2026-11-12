/**
 * Seller authorization of the intermediated model (Phase 8a): the admin
 * invites the seller, the seller accepts the Termos do Anunciante on the
 * invite page (no login) and only then the listing may be published.
 *
 * Receives `sql` by parameter and does not import `server-only` (like the
 * jobs), so the integration tests run the same code. Every write goes to
 * audit_log. `key` is HASH_SALT (it signs the invite links).
 */
import type postgres from "postgres";

import { SELLER_TERMS_VERSION } from "@/content/seller-terms";
import { normalizePhoneBR } from "@/lib/extraction/normalize";
import { parseCnpj, parseCpf } from "@/lib/identity/document";

import {
  inviteCode,
  inviteExpired,
  inviteExpiresAt,
  inviteMatches,
  parseInviteCode,
} from "./invite";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

export type OutreachStatus = "to_contact" | "invited" | "authorized" | "declined";

export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  to_contact: "A contatar",
  invited: "Convite enviado",
  authorized: "Autorizado",
  declined: "Recusado",
};

export interface Outreach {
  status: OutreachStatus;
  invitedAt: Date | null;
  invitedBy: string | null;
  respondedAt: Date | null;
  declineReason: string | null;
  commissionCents: number | null;
  termsVersion: string | null;
  seller: {
    id: string;
    name: string;
    type: string;
    phone: string | null;
    email: string | null;
    cpf: string | null;
    cnpj: string | null;
  } | null;
}

/** The fixed commission set in Configurações, in cents; null while not defined (0). */
export async function commissionCents(sql: Sql | Tx): Promise<number | null> {
  const [row] = await sql<{ value: unknown }[]>`
    select value from public.app_settings where key = 'seller_commission_brl'`;
  const reais = Number(row?.value);
  return Number.isFinite(reais) && reais > 0 ? Math.round(reais * 100) : null;
}

export async function getOutreach(sql: Sql, listingId: string): Promise<Outreach> {
  const [row] = await sql<
    {
      status: Exclude<OutreachStatus, "to_contact">;
      invited_at: Date | null;
      invited_by: string | null;
      responded_at: Date | null;
      decline_reason: string | null;
      commission_cents: number | null;
      terms_version: string | null;
      seller_id: string | null;
      display_name: string | null;
      seller_type: string | null;
      phone_e164: string | null;
      email: string | null;
      cpf: string | null;
      cnpj: string | null;
    }[]
  >`
    select o.status, o.invited_at, o.invited_by, o.responded_at, o.decline_reason,
      o.commission_cents, o.terms_version, s.id as seller_id, s.display_name,
      s.type as seller_type, s.phone_e164, s.email, s.cpf, s.cnpj
    from public.listing_outreach o
    left join public.sellers s on s.id = o.seller_id
    where o.listing_id = ${listingId}`;
  if (!row) {
    return {
      status: "to_contact",
      invitedAt: null,
      invitedBy: null,
      respondedAt: null,
      declineReason: null,
      commissionCents: null,
      termsVersion: null,
      seller: null,
    };
  }
  return {
    status: row.status,
    invitedAt: row.invited_at,
    invitedBy: row.invited_by,
    respondedAt: row.responded_at,
    declineReason: row.decline_reason,
    commissionCents: row.commission_cents,
    termsVersion: row.terms_version,
    seller: row.seller_id
      ? {
          id: row.seller_id,
          name: row.display_name!,
          type: row.seller_type!,
          phone: row.phone_e164,
          email: row.email,
          cpf: row.cpf,
          cnpj: row.cnpj,
        }
      : null,
  };
}

/** The invite page path for an invited listing (shown again whenever the admin opens it). */
export function invitePath(
  key: string,
  invite: { listingId: string; shortId: string; invitedAt: Date },
): string {
  return `/autorizar/${inviteCode(key, invite)}`;
}

async function audit(
  tx: Tx,
  entry: { actor: string; action: string; id: string; changes: object; note?: string | null },
) {
  await tx`
    insert into public.audit_log (actor, action, entity, entity_id, changes, note)
    values (${entry.actor}, ${entry.action}, 'listing', ${entry.id},
      ${tx.json(entry.changes as postgres.JSONValue)}, ${entry.note ?? null})`;
}

export type InviteResult =
  { ok: true; invitedAt: Date; shortId: string } | { ok: false; error: string };

/**
 * Creates (or renews) the invite of a listing in moderation. A renewed invite
 * changes `invited_at`, which invalidates the previous link. Needs the
 * commission: the seller must see the value before authorizing.
 */
export async function createInvite(
  sql: Sql,
  input: { listingId: string; actor: string; now: Date },
): Promise<InviteResult> {
  return sql.begin(async (tx) => {
    const [listing] = await tx<{ id: string; short_id: string; status: string }[]>`
      select id, short_id, status from public.listings where id = ${input.listingId} for update`;
    if (!listing) return { ok: false, error: "Anúncio não encontrado." };
    if (listing.status !== "pending_review") {
      return { ok: false, error: "Só anúncios em moderação recebem convite." };
    }
    if (!(await commissionCents(tx))) {
      return {
        ok: false,
        error: "Defina a comissão em Configurações antes de convidar o vendedor.",
      };
    }
    const [current] = await tx<{ status: string; invited_at: Date | null }[]>`
      select status, invited_at from public.listing_outreach
      where listing_id = ${listing.id} for update`;
    if (current?.status === "authorized") {
      return { ok: false, error: "O vendedor já autorizou este anúncio." };
    }
    // Millisecond precision: the link signs invited_at as read back from the database.
    const invitedAt = new Date(Math.floor(input.now.getTime()));
    await tx`
      insert into public.listing_outreach (listing_id, status, invited_at, invited_by)
      values (${listing.id}, 'invited', ${invitedAt}, ${input.actor})
      on conflict (listing_id) do update set
        status = 'invited', invited_at = excluded.invited_at, invited_by = excluded.invited_by,
        responded_at = null, decline_reason = null`;
    await audit(tx, {
      actor: input.actor,
      action: current ? "listing.invite_renew" : "listing.invite",
      id: listing.id,
      changes: {
        outreach: { from: current?.status ?? "to_contact", to: "invited" },
        invited_at: { from: current?.invited_at ?? null, to: invitedAt },
      },
    });
    return { ok: true, invitedAt, shortId: listing.short_id };
  });
}

/**
 * The seller said no (to the admin, on WhatsApp or Instagram, or on the invite
 * page): the listing is rejected. A repost brings it back to moderation, and
 * the admin sees it was declined before.
 */
async function decline(
  tx: Tx,
  input: { listingId: string; actor: string; reason: string | null; now: Date; note: string },
): Promise<void> {
  const [listing] = await tx<{ status: string }[]>`
    select status from public.listings where id = ${input.listingId} for update`;
  await tx`
    insert into public.listing_outreach (listing_id, status, responded_at, decline_reason)
    values (${input.listingId}, 'declined', ${input.now}, ${input.reason})
    on conflict (listing_id) do update set
      status = 'declined', responded_at = excluded.responded_at,
      decline_reason = excluded.decline_reason`;
  if (listing?.status === "pending_review") {
    await tx`
      update public.listings set status = 'rejected', rejected_at = ${input.now},
        review_note = ${"Vendedor não autorizou a intermediação"}
      where id = ${input.listingId}`;
  }
  await audit(tx, {
    actor: input.actor,
    action: "listing.decline",
    id: input.listingId,
    changes: {
      outreach: { from: null, to: "declined" },
      ...(listing?.status === "pending_review"
        ? { status: { from: "pending_review", to: "rejected" } }
        : {}),
    },
    note: [input.note, input.reason].filter(Boolean).join(": ").slice(0, 500),
  });
}

export async function recordDecline(
  sql: Sql,
  input: { listingId: string; actor: string; reason?: string | null; now: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const reason = input.reason?.trim().slice(0, 500) || null;
  return sql.begin(async (tx) => {
    const [o] = await tx<{ status: string }[]>`
      select status from public.listing_outreach where listing_id = ${input.listingId}`;
    if (o?.status === "authorized") {
      return {
        ok: false as const,
        error: "O vendedor já autorizou: para tirar do ar, mude o status.",
      };
    }
    const [exists] = await tx`select 1 from public.listings where id = ${input.listingId}`;
    if (!exists) return { ok: false as const, error: "Anúncio não encontrado." };
    await decline(tx, { ...input, reason, note: "Vendedor recusou (registrado pelo admin)" });
    return { ok: true as const };
  });
}

// --- The invite page -------------------------------------------------------------

export interface InviteListing {
  id: string;
  shortId: string;
  modelName: string;
  engineName: string | null;
  trimName: string | null;
  versionText: string | null;
  yearFab: number | null;
  yearModel: number | null;
  km: number | null;
  priceCents: number | null;
  city: string | null;
  uf: string | null;
  summary: string | null;
}

export type InviteView =
  | {
      kind: "open";
      listing: InviteListing;
      /** The seller's other listings in moderation (same phone or same shop account). */
      others: InviteListing[];
      commissionCents: number;
      sellerType: "loja" | "particular" | null;
      expiresAt: Date;
    }
  | { kind: "authorized" }
  | { kind: "declined" }
  | { kind: "expired" }
  /** The commission is not defined, or the listing left moderation. */
  | { kind: "unavailable" }
  | { kind: "invalid" };

const LISTING_SELECT = (sql: Sql | Tx) => sql`
  select l.id, l.short_id, m.name as model_name, e.name as engine_name, t.name as trim_name,
    l.version_text, l.year_fab, l.year_model, l.km, l.price_cents, l.city, l.uf, l.summary_ptbr,
    l.status, l.seller_type, l.contact_phone_e164, l.authorized_at
  from public.listings l
  join public.vehicle_models m on m.id = l.model_id
  left join public.vehicle_engines e on e.id = l.engine_id
  left join public.vehicle_trims t on t.id = l.trim_id`;

interface ListingRow {
  id: string;
  short_id: string;
  model_name: string;
  engine_name: string | null;
  trim_name: string | null;
  version_text: string | null;
  year_fab: number | null;
  year_model: number | null;
  km: number | null;
  price_cents: string | null;
  city: string | null;
  uf: string | null;
  summary_ptbr: string | null;
  status: string;
  seller_type: "loja" | "particular" | null;
  contact_phone_e164: string | null;
  authorized_at: Date | null;
}

const toInviteListing = (r: ListingRow): InviteListing => ({
  id: r.id,
  shortId: r.short_id,
  modelName: r.model_name,
  engineName: r.engine_name,
  trimName: r.trim_name,
  versionText: r.version_text,
  yearFab: r.year_fab,
  yearModel: r.year_model,
  km: r.km,
  priceCents: r.price_cents === null ? null : Number(r.price_cents),
  city: r.city,
  uf: r.uf,
  summary: r.summary_ptbr,
});

interface ResolvedInvite {
  listing: ListingRow;
  outreach: { status: string; invited_at: Date | null };
}

/** The listing and outreach row behind a code, or why the code does not open the page. */
async function resolveInvite(
  sql: Sql | Tx,
  key: string,
  code: string,
  now: Date,
  lock = false,
): Promise<ResolvedInvite | { kind: Exclude<InviteView["kind"], "open"> }> {
  const parsed = parseInviteCode(code);
  if (!parsed) return { kind: "invalid" };
  const [listing] = await sql<ListingRow[]>`
    ${LISTING_SELECT(sql)} where l.short_id = ${parsed.shortId}
    ${lock ? sql`for update of l` : sql``}`;
  if (!listing) return { kind: "invalid" };
  const [outreach] = await sql<{ status: string; invited_at: Date | null }[]>`
    select status, invited_at from public.listing_outreach where listing_id = ${listing.id}
    ${lock ? sql`for update` : sql``}`;
  if (
    !outreach?.invited_at ||
    !inviteMatches(key, code, { listingId: listing.id, invitedAt: outreach.invited_at })
  ) {
    return { kind: "invalid" };
  }
  if (outreach.status === "authorized") return { kind: "authorized" };
  if (outreach.status === "declined") return { kind: "declined" };
  if (inviteExpired(outreach.invited_at, now)) return { kind: "expired" };
  if (listing.status !== "pending_review") return { kind: "unavailable" };
  return { listing, outreach };
}

/**
 * Other listings of the same seller still waiting for authorization: same
 * phone, or posts of the same shop account (Business Discovery).
 */
async function sameSellerListings(sql: Sql | Tx, listing: ListingRow): Promise<ListingRow[]> {
  return sql<ListingRow[]>`
    ${LISTING_SELECT(sql)}
    left join public.listing_outreach o on o.listing_id = l.id
    where l.id <> ${listing.id} and l.status = 'pending_review' and l.authorized_at is null
      and (o.status is null or o.status = 'invited')
      and (
        (${listing.contact_phone_e164}::text is not null
          and l.contact_phone_e164 = ${listing.contact_phone_e164})
        or exists (
          select 1
          from public.listing_sources a
          join public.raw_posts ra on ra.id = a.raw_post_id
          join public.sources sa on sa.id = ra.source_id and sa.type = 'ig_business_account'
          join public.raw_posts rb on rb.source_id = sa.id
          join public.listing_sources b on b.raw_post_id = rb.id
          where a.listing_id = ${listing.id} and b.listing_id = l.id
        )
      )
    order by l.created_at, l.id
    limit 30`;
}

export async function loadInvite(
  sql: Sql,
  key: string,
  code: string,
  now: Date,
): Promise<InviteView> {
  const resolved = await resolveInvite(sql, key, code, now);
  if ("kind" in resolved) return resolved;
  const commission = await commissionCents(sql);
  if (!commission) return { kind: "unavailable" };
  const others = await sameSellerListings(sql, resolved.listing);
  return {
    kind: "open",
    listing: toInviteListing(resolved.listing),
    others: others.map(toInviteListing),
    commissionCents: commission,
    sellerType: resolved.listing.seller_type,
    expiresAt: inviteExpiresAt(resolved.outreach.invited_at!),
  };
}

export interface AcceptForm {
  name: string;
  type: string;
  phone: string;
  email: string;
  cpf: string;
  cnpj: string;
  terms: boolean;
  /** Ids of the seller's other listings also authorized (from the page's list). */
  alsoIds: string[];
}

export type AcceptErrors = Partial<
  Record<"name" | "type" | "phone" | "email" | "cpf" | "cnpj" | "terms" | "form", string>
>;

export type AcceptResult = { ok: true; authorized: number } | { ok: false; errors: AcceptErrors };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CPF_ERROR = "CPF inválido: confira os números.";
export const CNPJ_ERROR = "CNPJ inválido: confira os números e letras.";

export function parseAcceptForm(form: AcceptForm):
  | {
      ok: true;
      name: string;
      type: "loja" | "particular";
      phone: string;
      email: string | null;
      cpf: string;
      cnpj: string | null;
    }
  | { ok: false; errors: AcceptErrors } {
  const errors: AcceptErrors = {};
  const name = form.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) errors.name = "Informe o seu nome ou o nome da loja.";
  const type = form.type === "loja" || form.type === "particular" ? form.type : null;
  if (!type) errors.type = "Diga se é loja ou particular.";
  const phone = normalizePhoneBR(form.phone);
  if (!phone) errors.phone = "Informe um WhatsApp válido, com DDD.";
  const email = form.email.trim().toLowerCase();
  if (email && (email.length > 120 || !EMAIL.test(email))) errors.email = "E-mail inválido.";
  const cpf = parseCpf(form.cpf);
  if (!cpf) errors.cpf = CPF_ERROR;
  const cnpj = type === "loja" && form.cnpj.trim() ? parseCnpj(form.cnpj) : null;
  if (type === "loja" && form.cnpj.trim() && !cnpj) errors.cnpj = CNPJ_ERROR;
  if (!form.terms) errors.terms = "Para autorizar, aceite os Termos do Anunciante.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, name, type: type!, phone: phone!, email: email || null, cpf: cpf!, cnpj };
}

/**
 * The seller who authorizes (invite page or public form): found by the CPF,
 * then by the WhatsApp number (when that seller has no other CPF), or
 * created. `via` is set only when the contact was proven (the invite went to
 * the number published in the listing); the public form does not prove it,
 * and the admin confirms by WhatsApp before approving.
 */
export async function upsertSeller(
  tx: Tx,
  input: {
    name: string;
    type: "loja" | "particular";
    phone: string;
    email: string | null;
    cpf: string;
    cnpj: string | null;
    via: "invite_link" | null;
    now: Date;
  },
): Promise<string> {
  const [byCpf] = await tx<{ id: string }[]>`
    select id from public.sellers where cpf = ${input.cpf} for update`;
  const [byPhone] = byCpf
    ? [byCpf]
    : await tx<{ id: string }[]>`
        select id from public.sellers where phone_e164 = ${input.phone} and cpf is null
        order by created_at limit 1 for update`;
  const existing = byCpf ?? byPhone;
  if (existing) {
    await tx`
      update public.sellers set
        cpf = ${input.cpf}, cnpj = coalesce(${input.cnpj}, cnpj),
        phone_e164 = coalesce(phone_e164, ${input.phone}),
        email = coalesce(email, ${input.email}),
        verified_via = coalesce(verified_via, ${input.via}),
        verified_at = case when ${input.via}::text is null then verified_at
          else coalesce(verified_at, ${input.now}) end,
        terms_version_accepted = ${SELLER_TERMS_VERSION}, terms_accepted_at = ${input.now}
      where id = ${existing.id}`;
    return existing.id;
  }
  const [created] = await tx<{ id: string }[]>`
    insert into public.sellers (
      display_name, type, phone_e164, email, cpf, cnpj, verified_via, verified_at,
      terms_version_accepted, terms_accepted_at
    ) values (
      ${input.name}, ${input.type}, ${input.phone}, ${input.email}, ${input.cpf}, ${input.cnpj},
      ${input.via}, ${input.via ? input.now : null}, ${SELLER_TERMS_VERSION}, ${input.now}
    ) returning id`;
  return created!.id;
}

/** The Termos do Anunciante and the photo license (section 5), accepted now. */
export async function recordSellerTerms(tx: Tx, sellerId: string, now: Date): Promise<void> {
  await tx`
    insert into public.terms_acceptances (seller_id, terms, version, accepted_at)
    values (${sellerId}, 'seller_terms', ${SELLER_TERMS_VERSION}, ${now}),
      (${sellerId}, 'photo_license', ${SELLER_TERMS_VERSION}, ${now})
    on conflict (seller_id, terms, version) do nothing`;
}

/**
 * The seller authorizes on the invite page: the seller is created (or found by
 * the WhatsApp number), the terms and the photo license are recorded with the
 * commission shown, and the listings become publishable (the admin still
 * approves). Runs as the table owner, from the page's Server Action.
 */
export async function acceptInvite(
  sql: Sql,
  input: { key: string; code: string; form: AcceptForm; now: Date },
): Promise<AcceptResult> {
  const parsed = parseAcceptForm(input.form);
  if (!parsed.ok) return parsed;
  return sql.begin(async (tx) => {
    const resolved = await resolveInvite(tx, input.key, input.code, input.now, true);
    if ("kind" in resolved) {
      const message =
        resolved.kind === "authorized"
          ? "Este anúncio já foi autorizado."
          : resolved.kind === "expired"
            ? "Este link venceu. Peça um novo ao Buy My Volvo."
            : "Este link não está mais disponível.";
      return { ok: false as const, errors: { form: message } };
    }
    const commission = await commissionCents(tx);
    if (!commission) {
      return { ok: false as const, errors: { form: "Este link não está mais disponível." } };
    }
    const eligible = new Set((await sameSellerListings(tx, resolved.listing)).map((l) => l.id));
    const ids = [resolved.listing.id, ...input.form.alsoIds.filter((id) => eligible.has(id))];

    const sellerId = await upsertSeller(tx, {
      ...parsed,
      via: "invite_link",
      now: input.now,
    });
    await recordSellerTerms(tx, sellerId, input.now);

    for (const id of ids) {
      await tx`
        insert into public.listing_outreach (
          listing_id, status, responded_at, seller_id, terms_version, commission_cents
        ) values (
          ${id}, 'authorized', ${input.now}, ${sellerId}, ${SELLER_TERMS_VERSION}, ${commission}
        )
        on conflict (listing_id) do update set
          status = 'authorized', responded_at = excluded.responded_at,
          seller_id = excluded.seller_id, terms_version = excluded.terms_version,
          commission_cents = excluded.commission_cents, decline_reason = null`;
      await tx`
        update public.listings set authorized_at = ${input.now}, seller_id = ${sellerId}
        where id = ${id}`;
      await audit(tx, {
        actor: "public:authorization",
        action: "listing.authorize",
        id,
        changes: {
          authorized_at: { from: null, to: input.now },
          seller_id: { from: null, to: sellerId },
          commission_cents: { from: null, to: commission },
        },
        note:
          id === resolved.listing.id
            ? "Autorizado pelo vendedor no link do convite"
            : "Autorizado pelo vendedor junto com outro anúncio dele",
      });
    }
    return { ok: true as const, authorized: ids.length };
  });
}

/** The seller declines on the invite page. */
export async function declineInvite(
  sql: Sql,
  input: { key: string; code: string; reason?: string | null; now: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  return sql.begin(async (tx) => {
    const resolved = await resolveInvite(tx, input.key, input.code, input.now, true);
    if ("kind" in resolved)
      return { ok: false as const, error: "Este link não está mais disponível." };
    await decline(tx, {
      listingId: resolved.listing.id,
      actor: "public:authorization",
      reason: input.reason?.trim().slice(0, 500) || null,
      now: input.now,
      note: "Vendedor recusou no link do convite",
    });
    return { ok: true as const };
  });
}
