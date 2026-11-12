/**
 * Records a contact click as a lead and returns where to send the buyer.
 *
 * Intermediated model (Phase 8a): buyers write to Buy My Volvo's WhatsApp
 * (app_settings.bmv_whatsapp_numbers), never to the seller. With several
 * numbers, new leads alternate between them; a repeated click keeps its number.
 *
 * Receives `sql` by parameter and does not import `server-only`, like the
 * jobs: the same code runs in the route handler, the CLI and the tests. Runs
 * with the table owner's role.
 */
import type postgres from "postgres";

import { nextBmvNumber, readBmvNumbers } from "@/lib/authorization/messages";

import {
  DEFAULT_MESSAGE_TEMPLATE,
  generateRefCode,
  isFictitiousPhone,
  REF_CODE_PATTERN,
  renderMessage,
  whatsappUrl,
} from "./contact";
import type { ClickOrigin } from "./request";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

/** "instagram" only in leads recorded before Phase 8a (Direct to the seller). */
export type LeadChannel = "whatsapp" | "instagram";

/** The slug's last part, e.g. `4245s2` in `/r/4245s2`. */
export const SHORT_ID_PATTERN = /^[a-z0-9]{2,12}$/;

export interface SiteInfo {
  name: string;
  url: string;
}

interface ContactRow {
  id: string;
  slug: string;
  short_id: string;
  status: "pending_review" | "active" | "sold" | "expired" | "removed" | "rejected";
  seller_id: string | null;
  contact_phone_e164: string | null;
  contact_ig_username: string | null;
  model_name: string;
  engine_name: string | null;
  trim_name: string | null;
  version_text: string | null;
  year_model: number | null;
  authorized_at: Date | null;
}

const CONTACT_SELECT = (sql: Sql | Tx) => sql`
  select l.id, l.slug, l.short_id, l.status, l.seller_id, l.contact_phone_e164,
    l.contact_ig_username, m.name as model_name, e.name as engine_name, t.name as trim_name,
    l.version_text, l.year_model, l.authorized_at
  from public.listings l
  join public.vehicle_models m on m.id = l.model_id
  left join public.vehicle_engines e on e.id = l.engine_id
  left join public.vehicle_trims t on t.id = l.trim_id`;

interface ContactSettings {
  template: string;
  dedupeHours: number;
  /** Buy My Volvo's WhatsApp numbers (empty: contact unavailable). */
  numbers: string[];
}

async function contactSettings(sql: Sql | Tx): Promise<ContactSettings> {
  const rows = await sql<{ key: string; value: unknown }[]>`
    select key, value from public.app_settings
    where key in ('whatsapp_message_template', 'lead_dedupe_hours', 'bmv_whatsapp_numbers')`;
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const template = get("whatsapp_message_template");
  const hours = Number(get("lead_dedupe_hours"));
  return {
    template:
      typeof template === "string" && template.includes("{") ? template : DEFAULT_MESSAGE_TEMPLATE,
    dedupeHours: Number.isFinite(hours) && hours >= 0 ? hours : 24,
    numbers: readBmvNumbers(get("bmv_whatsapp_numbers")),
  };
}

function messageFor(row: ContactRow, template: string, site: SiteInfo, ref: string): string {
  const version = [row.engine_name, row.trim_name].filter(Boolean).join(" ");
  const fallback = row.version_text && row.version_text.length <= 40 ? row.version_text : null;
  return renderMessage(template, {
    modelo: row.model_name,
    versao: version || fallback,
    ano: row.year_model,
    site: site.name,
    url: `${site.url}/a/${row.short_id}`,
    ref,
  });
}

export interface ClickInput {
  shortId: string;
  ipHash: string | null;
  uaHash: string | null;
  origin: ClickOrigin;
  site: SiteInfo;
}

export type ClickResult =
  | {
      kind: "contact";
      channel: "whatsapp";
      /** wa.me link to Buy My Volvo's number, with the message. */
      url: string;
      refCode: string;
      message: string;
      /** The Buy My Volvo number that receives this lead. */
      routedTo: string;
      /** Same device, same listing, inside the dedupe window: no new lead. */
      repeated: boolean;
      /** Demo listing or demo number (DDD 20): show the preview page instead of WhatsApp. */
      fictitious: boolean;
    }
  /** Sold, expired or no Buy My Volvo number configured: back to the listing page, no lead. */
  | { kind: "listing"; slug: string }
  | { kind: "not_found" };

export async function recordClick(sql: Sql, input: ClickInput): Promise<ClickResult> {
  if (!SHORT_ID_PATTERN.test(input.shortId)) return { kind: "not_found" };
  const [row] = await sql<ContactRow[]>`${CONTACT_SELECT(sql)} where l.short_id = ${input.shortId}`;
  // Listings under review, removed, rejected or never authorized are not public:
  // behave as if they did not exist.
  if (!row || !row.authorized_at || !["active", "sold", "expired"].includes(row.status)) {
    return { kind: "not_found" };
  }
  if (row.status !== "active") return { kind: "listing", slug: row.slug };
  const settings = await contactSettings(sql);
  if (settings.numbers.length === 0) return { kind: "listing", slug: row.slug };

  const channel = "whatsapp" as const;
  const { origin } = input;
  const lead = await sql.begin(async (tx) => {
    // Serializes simultaneous clicks of the same device on the same listing.
    const lockKey = [row.id, input.ipHash ?? "", input.uaHash ?? "", channel].join("|");
    await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const [existing] = await tx<{ id: string; ref_code: string; routed_to: string | null }[]>`
      select id, ref_code, routed_to from public.leads
      where listing_id = ${row.id} and channel = ${channel}
        and ip_hash is not distinct from ${input.ipHash}
        and ua_hash is not distinct from ${input.uaHash}
        and created_at > now() - make_interval(secs => ${Math.round(settings.dedupeHours * 3600)})
      order by created_at desc
      limit 1`;
    if (existing && existing.routed_to && settings.numbers.includes(existing.routed_to)) {
      await tx`
        update public.leads set click_count = click_count + 1, last_clicked_at = now()
        where id = ${existing.id}`;
      return { refCode: existing.ref_code, routedTo: existing.routed_to, repeated: true };
    }
    // Round-robin: the number after the one that received the latest lead.
    const [last] = await tx<{ routed_to: string }[]>`
      select routed_to from public.leads where routed_to is not null
      order by created_at desc, id desc limit 1`;
    const routedTo = nextBmvNumber(settings.numbers, last?.routed_to ?? null)!;
    for (let attempt = 0; attempt < 8; attempt++) {
      const [inserted] = await tx<{ ref_code: string }[]>`
        insert into public.leads (
          listing_id, seller_id, ref_code, channel, routed_to, ip_hash, ua_hash, referrer,
          utm_source, utm_medium, utm_campaign
        ) values (
          ${row.id}, ${row.seller_id}, ${generateRefCode()}, ${channel}, ${routedTo},
          ${input.ipHash}, ${input.uaHash}, ${origin.referrer}, ${origin.utmSource},
          ${origin.utmMedium}, ${origin.utmCampaign}
        )
        on conflict (ref_code) do nothing
        returning ref_code`;
      if (inserted) return { refCode: inserted.ref_code, routedTo, repeated: false };
    }
    throw new Error("Could not generate a unique lead reference code.");
  });

  const message = messageFor(row, settings.template, input.site, lead.refCode);
  return {
    kind: "contact",
    channel,
    url: whatsappUrl(lead.routedTo, message),
    refCode: lead.refCode,
    message,
    routedTo: lead.routedTo,
    repeated: lead.repeated,
    fictitious: isFictitiousPhone(row.contact_phone_e164) || isFictitiousPhone(lead.routedTo),
  };
}

/** Public listing page for a short code, without recording anything (bots, short links). */
export async function publicSlugFor(sql: Sql, shortId: string): Promise<string | null> {
  if (!SHORT_ID_PATTERN.test(shortId)) return null;
  const [row] = await sql<{ slug: string }[]>`
    select slug from public.listings
    where short_id = ${shortId} and status in ('active', 'sold', 'expired')
      and authorized_at is not null`;
  return row?.slug ?? null;
}

export interface LeadPreview {
  refCode: string;
  slug: string;
  title: string;
  message: string;
  clickCount: number;
}

/**
 * The message a demo click would have sent. Only for fictitious listings or a
 * fictitious Buy My Volvo number (DDD 20, local and test databases): a real
 * lead's details are never shown publicly.
 */
export async function leadPreview(
  sql: Sql,
  refCode: string,
  site: SiteInfo,
): Promise<LeadPreview | null> {
  if (!REF_CODE_PATTERN.test(refCode)) return null;
  const [lead] = await sql<
    { listing_id: string; channel: LeadChannel; click_count: number; routed_to: string | null }[]
  >`
    select listing_id, channel, click_count, routed_to from public.leads
    where ref_code = ${refCode}`;
  if (!lead || lead.channel !== "whatsapp") return null;
  const [row] = await sql<ContactRow[]>`${CONTACT_SELECT(sql)} where l.id = ${lead.listing_id}`;
  if (!row || !(isFictitiousPhone(row.contact_phone_e164) || isFictitiousPhone(lead.routed_to))) {
    return null;
  }
  const settings = await contactSettings(sql);
  return {
    refCode,
    slug: row.slug,
    title: [row.model_name, row.engine_name, row.trim_name].filter(Boolean).join(" "),
    message: messageFor(row, settings.template, site, refCode),
    clickCount: lead.click_count,
  };
}
