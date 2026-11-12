/**
 * Listings the admin creates from an ad text pasted by hand (Phase 9a): what
 * a seller sent on WhatsApp, or the text of their ad on another site, copied
 * by a person. Nothing here fetches anything: the text comes from the form.
 *
 * Same steps as an Instagram post: extraction (Claude) → normalization →
 * blocklist → deduplication → a listing in moderation, which then follows the
 * seller authorization flow (Phase 8a). The text stays internal
 * (manual_sources), like a caption.
 *
 * Receives `sql` and the extractor by parameter and does not import
 * `server-only` (like the jobs), so the integration tests run the same code.
 */
import type postgres from "postgres";

import { emptyUsage, type TokenUsage } from "@/lib/extraction/cost";
import { dedupeKey } from "@/lib/extraction/dedupe";
import type { ExtractInput, ExtractResult } from "@/lib/extraction/extract";
import { fillLocation } from "@/lib/extraction/location";
import {
  hasMinimumFields,
  normalizeExtraction,
  normalizePhoneBR,
} from "@/lib/extraction/normalize";
import {
  findExistingListing,
  isBlocked,
  publicErrorMessage,
  publishThreshold,
  shortId,
} from "@/lib/extraction/pipeline";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/extraction/prompt";
import { listingSlug } from "@/lib/listings/format";
import { getEngine, getModel, getTrim } from "@/lib/taxonomy";

import {
  MANUAL_CHANNEL_LABELS,
  MANUAL_CHANNELS,
  MANUAL_TEXT_MAX,
  MANUAL_TEXT_MIN,
  type ManualChannel,
} from "./manual-channels";

type Sql = postgres.Sql;

export { MANUAL_CHANNEL_LABELS, MANUAL_CHANNELS, type ManualChannel };

export interface ManualInput {
  text: string;
  channel: ManualChannel;
  sourceUrl: string | null;
  /** Typed by the admin: beats the phone found in the text. */
  phone: string | null;
  /** Create even when a listing of the same car already exists. */
  force: boolean;
}

export type ManualFormErrors = Partial<Record<"text" | "channel" | "sourceUrl" | "phone", string>>;

/** Validates the form (pure). */
export function parseManualForm(
  input: Record<string, string | undefined>,
): { ok: true; input: ManualInput } | { ok: false; errors: ManualFormErrors } {
  const errors: ManualFormErrors = {};
  const text = (input.texto ?? "").replace(/\r\n?/g, "\n").trim();
  if (text.length < MANUAL_TEXT_MIN)
    errors.text = "Cole o texto do anúncio (pelo menos uma frase).";
  else if (text.length > MANUAL_TEXT_MAX)
    errors.text = `Use no máximo ${MANUAL_TEXT_MAX.toLocaleString("pt-BR")} caracteres.`;
  const channel = (input.origem ?? "") as ManualChannel;
  if (!MANUAL_CHANNELS.includes(channel)) errors.channel = "Diga de onde veio o anúncio.";
  const rawUrl = (input.link ?? "").trim();
  let sourceUrl: string | null = null;
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (!/^https?:$/.test(url.protocol) || rawUrl.length > 500) throw new Error("bad url");
      sourceUrl = url.toString();
    } catch {
      errors.sourceUrl = "Link inválido (comece com https://).";
    }
  }
  const rawPhone = (input.telefone ?? "").trim();
  const phone = rawPhone ? normalizePhoneBR(rawPhone) : null;
  if (rawPhone && !phone) errors.phone = "Telefone inválido: use o DDD.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: { text, channel, sourceUrl, phone, force: input.criar_mesmo_assim === "on" },
  };
}

export type ManualResult =
  | {
      ok: true;
      id: string;
      /** Good data: the seller can be invited right away. */
      ready: boolean;
      usage: TokenUsage;
      model: string;
    }
  | {
      ok: false;
      error: string;
      /** A listing of the same car already exists (create anyway with `force`). */
      duplicate?: { id: string; status: string };
      usage: TokenUsage;
    };

export async function createManualListing(
  sql: Sql,
  input: ManualInput & {
    actor: string;
    extract: (input: ExtractInput) => Promise<ExtractResult>;
    now?: Date;
  },
): Promise<ManualResult> {
  const now = input.now ?? new Date();
  if (input.phone && (await isBlocked(sql, "phone", input.phone))) {
    return {
      ok: false,
      error: "Este telefone está na lista de bloqueio (pedido de remoção do vendedor).",
      usage: emptyUsage(),
    };
  }

  let result: ExtractResult;
  try {
    result = await input.extract({ caption: input.text, igUsername: null, bio: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `A leitura do texto falhou: ${publicErrorMessage(message)}`,
      usage: emptyUsage(),
    };
  }
  const normalized = normalizeExtraction(result.output, { caption: input.text, now });
  const n = { ...normalized, contactPhone: input.phone ?? normalized.contactPhone };
  if (!n.isListing || !n.modelId) {
    return {
      ok: false,
      error:
        "Não encontrei um Volvo à venda neste texto. Confira se colou o anúncio inteiro (modelo, ano e preço).",
      usage: result.usage,
    };
  }
  if (
    (await isBlocked(sql, "phone", n.contactPhone)) ||
    (await isBlocked(sql, "ig_username", n.contactIgUsername))
  ) {
    return {
      ok: false,
      error: "O contato deste anúncio está na lista de bloqueio (pedido de remoção do vendedor).",
      usage: result.usage,
    };
  }

  const threshold = await publishThreshold(sql);
  const key = dedupeKey(n);
  return sql.begin(async (tx) => {
    const existing = await findExistingListing(tx, n, key, input.text);
    if (existing?.status === "removed") {
      return {
        ok: false as const,
        error: "O vendedor pediu a remoção deste carro: ele não pode voltar ao site.",
        duplicate: existing,
        usage: result.usage,
      };
    }
    if (existing && !input.force) {
      return {
        ok: false as const,
        error: "Já existe um anúncio deste carro.",
        duplicate: existing,
        usage: result.usage,
      };
    }

    const place = fillLocation({ city: n.city, uf: n.uf }, { phone: n.contactPhone });
    const slug = listingSlug(
      {
        modelName: getModel(n.modelId!)!.name,
        engineName: n.engineId ? getEngine(n.engineId)?.name : null,
        trimName: n.trimId ? getTrim(n.trimId)?.name : null,
        yearModel: n.yearModel,
        city: place.city,
        uf: place.uf,
      },
      shortId(),
    );
    const [listing] = await tx<{ id: string }[]>`
      insert into public.listings (
        slug, status, origin, model_id, engine_id, trim_id, version_text, year_fab, year_model,
        km, price_cents, city, uf, color, transmission, fuel, options, summary_ptbr, seller_type,
        contact_phone_e164, contact_ig_username, confidence, red_flags, first_seen_at,
        last_seen_at, dedupe_key, uf_from_ddd
      ) values (
        ${slug}, 'pending_review', 'admin', ${n.modelId}, ${n.engineId}, ${n.trimId},
        ${n.versionText}, ${n.yearFab}, ${n.yearModel}, ${n.km}, ${n.priceCents},
        ${place.city}, ${place.uf}, ${n.color}, ${n.transmission}, ${n.fuel}, ${n.options},
        ${n.summary || null}, ${n.sellerType}, ${n.contactPhone}, ${n.contactIgUsername},
        ${n.confidence}, ${n.redFlags}, ${now}, ${now}, ${key}, ${place.ufFromDdd}
      ) returning id`;
    const usage = result.usage;
    await tx`
      insert into public.manual_sources (
        listing_id, channel, source_url, text, created_by, extraction_json, extraction_model,
        tokens_in, tokens_out
      ) values (
        ${listing!.id}, ${input.channel}, ${input.sourceUrl}, ${input.text}, ${input.actor},
        ${tx.json({
          prompt_version: EXTRACTION_PROMPT_VERSION,
          extraction: result.output,
          normalized: n,
        } as unknown as postgres.JSONValue)},
        ${result.model},
        ${usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens},
        ${usage.outputTokens}
      )`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes, note)
      values (${input.actor}, 'listing.create_manual', 'listing', ${listing!.id},
        ${tx.json({ status: { from: null, to: "pending_review" } })},
        ${`Anúncio colado (${MANUAL_CHANNEL_LABELS[input.channel]})${
          existing ? "; já havia um anúncio parecido" : ""
        }`})`;
    return {
      ok: true as const,
      id: listing!.id,
      ready: n.confidence >= threshold && hasMinimumFields(n),
      usage,
      model: result.model,
    };
  });
}
