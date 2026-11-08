"use server";

import { refresh } from "next/cache";

import { SELLER_TERMS_VERSION } from "@/content/seller-terms";
import { db } from "@/lib/db/client";
import type { FormState } from "@/lib/form-state";
import { requireSellerUser, sellerActor } from "@/lib/sellers/auth";
import { acceptTerms, createClaim, saveSellerProfile } from "@/lib/sellers/data";

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

/** Profile + terms acceptance + a pending claim with a code to send from the listing's Instagram. */
export async function claimListingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const slug = str(form, "slug");
  const user = await requireSellerUser(`/anuncio/${slug}/reivindicar`);
  if (str(form, "termos") !== "on") {
    return { status: "error", message: "Aceite os Termos do Anunciante para continuar." };
  }
  const sql = db();
  const [listing] = await sql<{ id: string }[]>`
    select id from public.listings where slug = ${slug} and status in ('active', 'sold', 'expired')`;
  if (!listing) return { status: "error", message: "Este anúncio não está disponível." };

  const profile = await saveSellerProfile(sql, {
    authUserId: user.authUserId,
    email: user.email,
    displayName: str(form, "nome"),
    type: str(form, "tipo"),
    phone: str(form, "telefone"),
  });
  if (!profile.ok) {
    return { status: "error", message: "Corrija os campos marcados.", errors: profile.errors };
  }
  await acceptTerms(sql, {
    sellerId: profile.sellerId,
    terms: "seller_terms",
    version: SELLER_TERMS_VERSION,
  });
  const claim = await createClaim(sql, {
    sellerId: profile.sellerId,
    listingId: listing.id,
    evidence: str(form, "prova"),
    actor: sellerActor(profile.sellerId),
  });
  if (!claim.ok) return { status: "error", message: claim.error };
  refresh();
  return { status: "saved", message: `Pedido registrado. Seu código: ${claim.code}` };
}
