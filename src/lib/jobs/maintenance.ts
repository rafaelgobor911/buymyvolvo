/** Daily jobs: token health and expiry of hashtag-only listings. */
import { inspectToken, REQUIRED_SCOPES } from "@/lib/instagram/api";

import type { JobDeps } from "./deps";
import { type JobContext, type JobResult, numberSetting } from "./runner";

const DAY = 86_400_000;
const dateBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * debug_token with the app token: validity, expiry, data access expiry and
 * permissions. Alerts `token_alert_days` before expiry; an invalid token
 * fails the run so the cron monitor sees it.
 */
export async function tokenHealth(ctx: JobContext, deps: JobDeps): Promise<JobResult> {
  const info = await inspectToken(deps.graph(), deps.token());
  const alertDays = await numberSetting(ctx.sql, "token_alert_days", 10);
  const daysLeft = (d: Date | null) =>
    d ? Math.floor((d.getTime() - ctx.now.getTime()) / DAY) : null;
  const missingScopes = REQUIRED_SCOPES.filter((s) => !info.scopes.includes(s));
  const stats = {
    valid: info.valid,
    type: info.type,
    expiresAt: info.expiresAt?.toISOString() ?? null,
    daysLeft: daysLeft(info.expiresAt),
    dataAccessExpiresAt: info.dataAccessExpiresAt?.toISOString() ?? null,
    dataAccessDaysLeft: daysLeft(info.dataAccessExpiresAt),
    scopes: info.scopes,
    missingScopes,
  };
  if (!info.valid) {
    throw new Error(
      `Token do Instagram inválido${info.error ? `: ${info.error}` : ""}. Gere um novo no Graph API Explorer (docs/meta-setup.md).`,
    );
  }

  const alerts: string[] = [];
  const appId = deps.appId();
  if (appId && info.appId && info.appId !== appId) {
    alerts.push("O token é de outro app da Meta (META_APP_ID não confere).");
  }
  if (missingScopes.length) alerts.push(`Faltam permissões no token: ${missingScopes.join(", ")}.`);
  if (info.expiresAt && stats.daysLeft! <= alertDays) {
    alerts.push(
      `O token do Instagram vence em ${stats.daysLeft} dia(s), em ${dateBR(info.expiresAt)}. Renove pelo Graph API Explorer.`,
    );
  }
  if (info.dataAccessExpiresAt && stats.dataAccessDaysLeft! <= alertDays) {
    alerts.push(
      `O acesso a dados do token termina em ${dateBR(info.dataAccessExpiresAt)}: reautorize o app no Graph API Explorer.`,
    );
  }
  return { stats, alerts };
}

/**
 * Hashtag posts cannot be re-read (recent_media covers 24h), so a listing
 * backed only by hashtag posts expires `hashtag_expire_after_days` after it
 * was posted. Listings with a Business Discovery source follow that source's
 * lifecycle instead.
 */
export async function expireListings(ctx: JobContext): Promise<JobResult> {
  const days = await numberSetting(ctx.sql, "hashtag_expire_after_days", 30);
  const expired = await ctx.write(
    (tx) => tx`
      update public.listings l set status = 'expired', expires_at = ${ctx.now}
      where l.status in ('active', 'pending_review') and l.origin = 'instagram'
        and l.first_seen_at < ${ctx.now}::timestamptz - make_interval(days => ${days})
        and exists (select 1 from public.listing_sources ls where ls.listing_id = l.id)
        and not exists (
          select 1 from public.listing_sources ls
          join public.raw_posts rp on rp.id = ls.raw_post_id
          join public.sources s on s.id = rp.source_id
          where ls.listing_id = l.id and s.type <> 'ig_hashtag')
      returning l.id`,
  );
  return { stats: { expired: expired.length, afterDays: days } };
}
