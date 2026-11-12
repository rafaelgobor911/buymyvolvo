import "server-only";

import { formatDateTime } from "@/components/admin/bits";
import type { AdminListing } from "@/lib/admin/listings";
import { readSettings } from "@/lib/admin/settings";
import { commissionCents, getOutreach, invitePath } from "@/lib/authorization/data";
import { inviteExpired, inviteExpiresAt } from "@/lib/authorization/invite";
import {
  DEFAULT_INVITE_TEMPLATE,
  formatCommission,
  renderInvite,
} from "@/lib/authorization/messages";
import { db } from "@/lib/db/client";
import { requireKeys, serverEnv } from "@/lib/env/server";
import { formatCnpj, formatCpf } from "@/lib/identity/document";
import { instagramUrl, isFictitiousPhone, whatsappUrl } from "@/lib/leads/contact";
import { site } from "@/lib/site";
import { getEngine, getModel, getTrim } from "@/lib/taxonomy";

import { AuthorizationPanel } from "./authorization-panel";

/** The seller authorization panel of a listing (moderation and Anúncios). */
export async function AuthorizationSection({
  listing,
  from,
}: {
  listing: AdminListing;
  from: "moderacao" | "anuncios";
}) {
  const sql = db();
  const [outreach, settings, commission] = await Promise.all([
    getOutreach(sql, listing.id),
    readSettings(sql),
    commissionCents(sql),
  ]);

  let invite: React.ComponentProps<typeof AuthorizationPanel>["invite"] = null;
  if (outreach.status === "invited" && outreach.invitedAt) {
    const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
    const url = `${site.url}${invitePath(HASH_SALT, {
      listingId: listing.id,
      shortId: listing.shortId,
      invitedAt: outreach.invitedAt,
    })}`;
    const template = String(settings.authorization_invite_template || DEFAULT_INVITE_TEMPLATE);
    const version = [
      listing.engineId ? getEngine(listing.engineId)?.name : null,
      listing.trimId ? getTrim(listing.trimId)?.name : null,
    ]
      .filter(Boolean)
      .join(" ");
    const message = renderInvite(template, {
      modelo: getModel(listing.modelId)?.name ?? listing.modelId,
      versao: version || null,
      ano: listing.yearModel,
      site: site.name,
      link: url,
    });
    const now = new Date();
    invite = {
      url,
      message,
      invitedAt: formatDateTime(outreach.invitedAt),
      expiresAt: formatDateTime(inviteExpiresAt(outreach.invitedAt)),
      expired: inviteExpired(outreach.invitedAt, now),
      whatsappHref:
        listing.phone && !isFictitiousPhone(listing.phone)
          ? whatsappUrl(listing.phone, message)
          : null,
      instagramHref: instagramUrl({ username: listing.igUsername ?? listing.post?.username }),
    };
  }

  return (
    <AuthorizationPanel
      listingId={listing.id}
      from={from}
      status={outreach.status}
      inModeration={listing.status === "pending_review"}
      commission={formatCommission(commission)}
      invite={invite}
      authorized={
        outreach.status === "authorized" && outreach.respondedAt
          ? {
              at: formatDateTime(outreach.respondedAt),
              seller: outreach.seller
                ? {
                    name: outreach.seller.name,
                    type: outreach.seller.type,
                    phone: outreach.seller.phone,
                    email: outreach.seller.email,
                    cpf: outreach.seller.cpf ? formatCpf(outreach.seller.cpf) : null,
                    cnpj: outreach.seller.cnpj ? formatCnpj(outreach.seller.cnpj) : null,
                  }
                : null,
              commission: formatCommission(outreach.commissionCents),
            }
          : null
      }
      declined={
        outreach.status === "declined" && outreach.respondedAt
          ? { at: formatDateTime(outreach.respondedAt), reason: outreach.declineReason }
          : null
      }
    />
  );
}
