"use server";

import { headers } from "next/headers";

import { db } from "@/lib/db/client";
import { requireKeys, serverEnv } from "@/lib/env/server";
import type { FormState } from "@/lib/form-state";
import { clientIp, saltedHash } from "@/lib/leads/request";
import { createPublicListing } from "@/lib/submissions/create";
import { parsePublicListingForm } from "@/lib/submissions/form";
import { photoUploadToken } from "@/lib/submissions/photo-token";

export interface PublicFormState extends FormState {
  /** Sent: the browser uploads the photos with this token, then shows the thank-you page. */
  sent?: { listingId: string; token: string } | null;
}

const FIELDS = [
  "modelo",
  "motor",
  "versao",
  "versao_texto",
  "ano_fab",
  "ano_modelo",
  "km",
  "preco",
  "cidade",
  "uf",
  "cor",
  "cambio",
  "combustivel",
  "itens",
  "descricao",
  "tipo",
  "nome",
  "whatsapp",
  "email",
  "cpf",
  "cnpj",
  "termos",
] as const;

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

/** "Anuncie no Buy My Volvo": the listing enters moderation already authorized. */
export async function submitListingAction(
  _prev: PublicFormState,
  form: FormData,
): Promise<PublicFormState> {
  // Honeypot: people never see this field; bots that fill it get a fake success.
  if (str(form, "website")) return { status: "saved", sent: null };
  const parsed = parsePublicListingForm(Object.fromEntries(FIELDS.map((k) => [k, str(form, k)])));
  if (!parsed.ok) {
    return { status: "error", message: "Corrija os campos marcados.", errors: parsed.errors };
  }
  const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
  const result = await createPublicListing(db(), {
    listing: parsed.listing,
    ipHash: saltedHash(HASH_SALT, clientIp(await headers())),
  });
  if (!result.ok) return { status: "error", message: result.error };
  return {
    status: "saved",
    sent: { listingId: result.listingId, token: photoUploadToken(HASH_SALT, result.listingId) },
  };
}
