/**
 * Public removal request (no login). The listing goes down at once and the
 * request waits for an admin (48h). Receives `sql` by parameter.
 *
 * Anti-abuse: a hidden honeypot field, and a limit of requests per device
 * per day by a salted hash of the IP (nothing else about the requester is
 * kept besides the optional contact they type).
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

export const REMOVAL_REASONS = [
  "Já vendi o carro",
  "O anúncio é meu e não autorizei a publicação aqui",
  "Os dados estão errados",
  "Outro motivo",
] as const;

export interface RemovalRequestInput {
  slug: string;
  reason: string;
  detail: string;
  contact: string;
  ipHash: string | null;
}

export type RemovalRequestOutcome =
  | { ok: true; requestId: string | null; alreadyRemoved: boolean }
  | { ok: false; code: "invalid" | "not_found" | "rate_limited"; error: string };

export async function createRemovalRequest(
  sql: Sql,
  input: RemovalRequestInput,
): Promise<RemovalRequestOutcome> {
  if (!(REMOVAL_REASONS as readonly string[]).includes(input.reason)) {
    return { ok: false, code: "invalid", error: "Escolha o motivo." };
  }
  const detail = input.detail.trim().replace(/\s+/g, " ").slice(0, 500);
  if (input.reason === "Outro motivo" && !detail) {
    return { ok: false, code: "invalid", error: "Conte em poucas palavras o motivo." };
  }
  const contact = input.contact.trim().slice(0, 120) || null;
  if (!/^[a-z0-9-]{3,200}$/.test(input.slug)) {
    return { ok: false, code: "not_found", error: "Anúncio não encontrado." };
  }

  const [listing] = await sql<{ id: string; status: string }[]>`
    select id, status from public.listings where slug = ${input.slug}`;
  if (!listing || !["active", "sold", "expired", "removed"].includes(listing.status)) {
    return { ok: false, code: "not_found", error: "Anúncio não encontrado." };
  }
  if (listing.status === "removed") return { ok: true, requestId: null, alreadyRemoved: true };

  if (input.ipHash) {
    const [limit] = await sql<{ value: unknown }[]>`
      select value from public.app_settings where key = 'removal_requests_per_day'`;
    const perDay = Number(limit?.value) > 0 ? Number(limit?.value) : 3;
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.removal_requests
      where requester_ip_hash = ${input.ipHash} and created_at > now() - interval '24 hours'`;
    if (n >= perDay) {
      return {
        ok: false,
        code: "rate_limited",
        error: "Muitos pedidos deste aparelho hoje. Tente amanhã ou fale com a gente.",
      };
    }
  }

  const reason = [input.reason, detail].filter(Boolean).join(": ");
  return sql.begin(async (tx) => {
    const [current] = await tx<{ status: string }[]>`
      select status from public.listings where id = ${listing.id} for update`;
    if (current?.status === "removed") return { ok: true, requestId: null, alreadyRemoved: true };
    const [request] = await tx<{ id: string }[]>`
      insert into public.removal_requests (listing_id, requester_contact, reason, requester_ip_hash)
      values (${listing.id}, ${contact}, ${reason}, ${input.ipHash})
      returning id`;
    await tx`
      update public.listings set status = 'removed', removed_at = now() where id = ${listing.id}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes, note)
      values ('public:removal-form', 'listing.status', 'listing', ${listing.id},
        ${tx.json({ status: { from: current!.status, to: "removed" } })}, 'Pedido de remoção sem login')`;
    return { ok: true, requestId: request!.id, alreadyRemoved: false };
  });
}
