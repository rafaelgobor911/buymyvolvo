"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { requireKeys, serverEnv } from "@/lib/env/server";
import type { FormState } from "@/lib/form-state";
import { clientIp, saltedHash } from "@/lib/leads/request";
import { createRemovalRequest } from "@/lib/removals/create";

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

/** Removal without login: the listing goes down now; an admin confirms within 48h. */
export async function requestRemovalAction(_prev: FormState, form: FormData): Promise<FormState> {
  const slug = str(form, "slug");
  // Honeypot: people never see this field; bots that fill it get a fake success.
  if (str(form, "website")) redirect(`/anuncio/${slug}/remover?enviado=1`);
  if (str(form, "declaro") !== "on") {
    return {
      status: "error",
      message: "Confirme que o anúncio é seu ou que você tem autorização para pedir a remoção.",
    };
  }
  const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
  const result = await createRemovalRequest(db(), {
    slug,
    reason: str(form, "motivo"),
    detail: str(form, "detalhe"),
    contact: str(form, "contato"),
    ipHash: saltedHash(HASH_SALT, clientIp(await headers())),
  });
  if (!result.ok) return { status: "error", message: result.error };
  redirect(`/anuncio/${slug}/remover?enviado=1`);
}
