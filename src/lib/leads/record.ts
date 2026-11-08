/**
 * Records a contact click as a lead and returns where to send the buyer.
 *
 * Receives `sql` by parameter and does not import `server-only`, like the
 * jobs: the same code runs in the route handler, the CLI and the tests. Runs
 * with the table owner's role (it reads the phone, which anon cannot).
 */
import type postgres from "postgres";

import {
  DEFAULT_MESSAGE_TEMPLATE,
  generateRefCode,
  instagramUrl,
  isFictitiousPhone,
  REF_CODE_PATTERN,
  renderMessage,
  whatsappUrl,
} from "./contact";
import type { ClickOrigin } from "./request";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

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
  source_permalink: string | null;
  source_username: string | null;
}

const CONTACT_SELECT = (sql: Sql | Tx) => sql`
  select l.id, l.slug, l.short_id, l.status, l.seller_id, l.contact_phone_e164,
    l.contact_ig_username, m.name as model_name, e.name as engine_name, t.name as trim_name,
    l.version_text, l.year_model, src.permalink as source_permalink,
    src.ig_username as source_username
  from public.listings l
  join public.vehicle_models m on m.id = l.model_id
  left join public.vehicle_engines e on e.id = l.engine_id
  left join public.vehicle_trims t on t.id = l.trim_id
  left join lateral (
    select rp.permalink, rp.ig_username
    from public.listing_sources ls
    join public.raw_posts rp on rp.id = ls.raw_post_id
    where ls.listing_id = l.id
    order by ls.is_primary desc, ls.created_at
    limit 1
  ) src on true`;

interface ContactSettings {
  template: string;
  dedupeHours: number;
}

async function contactSettings(sql: Sql | Tx): Promise<ContactSettings> {
  const rows = await sql<{ key: string; value: unknown }[]>`
    select key, value from public.app_settings
    where key in ('whatsapp_message_template', 'lead_dedupe_hours')`;
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const template = get("whatsapp_message_template");
  const hours = Number(get("lead_dedupe_hours"));
  return {
    template:
      typeof template === "string" && template.includes("{") ? template : DEFAULT_MESSAGE_TEMPLATE,
    dedupeHours: Number.isFinite(hours) && hours >= 0 ? hours : 24,
  };
}

function channelFor(row: ContactRow): LeadChannel | null {
  if (row.contact_phone_e164) return "whatsapp";
  return instagramTarget(row) ? "instagram" : null;
}

const instagramTarget = (row: ContactRow) =>
  instagramUrl({
    username: row.contact_ig_username ?? row.source_username,
    permalink: row.source_permalink,
  });

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
      channel: LeadChannel;
      /** wa.me link with the message, ig.me Direct link or the post. */
      url: string;
      refCode: string;
      message: string | null;
      /** Same device, same listing, inside the dedupe window: no new lead. */
      repeated: boolean;
      /** Demo listing (DDD 20): show the preview page instead of opening WhatsApp. */
      fictitious: boolean;
    }
  /** Sold, expired or without any contact: back to the listing page, no lead. */
  | { kind: "listing"; slug: string }
  | { kind: "not_found" };

export async function recordClick(sql: Sql, input: ClickInput): Promise<ClickResult> {
  if (!SHORT_ID_PATTERN.test(input.shortId)) return { kind: "not_found" };
  const [row] = await sql<ContactRow[]>`${CONTACT_SELECT(sql)} where l.short_id = ${input.shortId}`;
  // Listings under review, removed or rejected are not public: behave as if they did not exist.
  if (!row || !["active", "sold", "expired"].includes(row.status)) {
    return { kind: "not_found" };
  }
  const channel = row.status === "active" ? channelFor(row) : null;
  if (!channel) return { kind: "listing", slug: row.slug };

  const settings = await contactSettings(sql);
  const { origin } = input;
  const lead = await sql.begin(async (tx) => {
    // Serializes simultaneous clicks of the same device on the same listing.
    const lockKey = [row.id, input.ipHash ?? "", input.uaHash ?? "", channel].join("|");
    await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const [existing] = await tx<{ id: string; ref_code: string }[]>`
      select id, ref_code from public.leads
      where listing_id = ${row.id} and channel = ${channel}
        and ip_hash is not distinct from ${input.ipHash}
        and ua_hash is not distinct from ${input.uaHash}
        and created_at > now() - make_interval(secs => ${Math.round(settings.dedupeHours * 3600)})
      order by created_at desc
      limit 1`;
    if (existing) {
      await tx`
        update public.leads set click_count = click_count + 1, last_clicked_at = now()
        where id = ${existing.id}`;
      return { refCode: existing.ref_code, repeated: true };
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const [inserted] = await tx<{ ref_code: string }[]>`
        insert into public.leads (
          listing_id, seller_id, ref_code, channel, ip_hash, ua_hash, referrer,
          utm_source, utm_medium, utm_campaign
        ) values (
          ${row.id}, ${row.seller_id}, ${generateRefCode()}, ${channel}, ${input.ipHash},
          ${input.uaHash}, ${origin.referrer}, ${origin.utmSource}, ${origin.utmMedium},
          ${origin.utmCampaign}
        )
        on conflict (ref_code) do nothing
        returning ref_code`;
      if (inserted) return { refCode: inserted.ref_code, repeated: false };
    }
    throw new Error("Could not generate a unique lead reference code.");
  });

  if (channel === "whatsapp") {
    const message = messageFor(row, settings.template, input.site, lead.refCode);
    return {
      kind: "contact",
      channel,
      url: whatsappUrl(row.contact_phone_e164!, message),
      refCode: lead.refCode,
      message,
      repeated: lead.repeated,
      fictitious: isFictitiousPhone(row.contact_phone_e164),
    };
  }
  return {
    kind: "contact",
    channel,
    url: instagramTarget(row)!,
    refCode: lead.refCode,
    message: null,
    repeated: lead.repeated,
    fictitious: false,
  };
}

/** Public listing page for a short code, without recording anything (bots, short links). */
export async function publicSlugFor(sql: Sql, shortId: string): Promise<string | null> {
  if (!SHORT_ID_PATTERN.test(shortId)) return null;
  const [row] = await sql<{ slug: string }[]>`
    select slug from public.listings
    where short_id = ${shortId} and status in ('active', 'sold', 'expired')`;
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
 * The message a demo click would have sent. Only for fictitious listings
 * (DDD 20): a real lead's details are never shown publicly.
 */
export async function leadPreview(
  sql: Sql,
  refCode: string,
  site: SiteInfo,
): Promise<LeadPreview | null> {
  if (!REF_CODE_PATTERN.test(refCode)) return null;
  const [lead] = await sql<{ listing_id: string; channel: LeadChannel; click_count: number }[]>`
    select listing_id, channel, click_count from public.leads where ref_code = ${refCode}`;
  if (!lead || lead.channel !== "whatsapp") return null;
  const [row] = await sql<ContactRow[]>`${CONTACT_SELECT(sql)} where l.id = ${lead.listing_id}`;
  if (!row || !isFictitiousPhone(row.contact_phone_e164)) return null;
  const settings = await contactSettings(sql);
  return {
    refCode,
    slug: row.slug,
    title: [row.model_name, row.engine_name, row.trim_name].filter(Boolean).join(" "),
    message: messageFor(row, settings.template, site, refCode),
    clickCount: lead.click_count,
  };
}
