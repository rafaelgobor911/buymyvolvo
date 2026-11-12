"use server";

import { redirect } from "next/navigation";

import { acceptInvite, declineInvite } from "@/lib/authorization/data";
import { db } from "@/lib/db/client";
import { requireKeys, serverEnv } from "@/lib/env/server";
import type { FormState } from "@/lib/form-state";

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

const CODE = /^[a-z0-9]{2,12}\.[A-Za-z0-9_-]{22}$/;

/** The seller authorizes on the invite page (no login; the link is the credential). */
export async function acceptInviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const code = str(form, "codigo");
  if (!CODE.test(code)) return { status: "error", message: "Link inválido." };
  const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
  const result = await acceptInvite(db(), {
    key: HASH_SALT,
    code,
    now: new Date(),
    form: {
      name: str(form, "nome"),
      type: str(form, "tipo"),
      phone: str(form, "whatsapp"),
      email: str(form, "email"),
      terms: str(form, "termos") === "on",
      alsoIds: form.getAll("outros").filter((v): v is string => typeof v === "string"),
    },
  });
  if (!result.ok) {
    const { form: formError, ...errors } = result.errors;
    return {
      status: "error",
      message: formError ?? "Corrija os campos marcados.",
      errors,
    };
  }
  redirect(`/autorizar/${code}?ok=autorizado`);
}

export async function declineInviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const code = str(form, "codigo");
  if (!CODE.test(code)) return { status: "error", message: "Link inválido." };
  const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
  const result = await declineInvite(db(), {
    key: HASH_SALT,
    code,
    reason: str(form, "motivo"),
    now: new Date(),
  });
  if (!result.ok) return { status: "error", message: result.error };
  redirect(`/autorizar/${code}?ok=recusado`);
}
