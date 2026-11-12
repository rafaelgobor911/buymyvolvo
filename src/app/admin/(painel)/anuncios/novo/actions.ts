"use server";

import Anthropic from "@anthropic-ai/sdk";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { actorOf, requireAdmin } from "@/lib/admin/auth";
import { createManualListing, parseManualForm } from "@/lib/admin/manual";
import { db } from "@/lib/db/client";
import { serverEnv } from "@/lib/env/server";
import { DEFAULT_EXTRACTION_MODEL, extractListing } from "@/lib/extraction/extract";
import type { FormState } from "@/lib/form-state";

export interface ManualFormState extends FormState {
  /** A listing of the same car already exists. */
  duplicate?: { id: string; status: string };
}

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

/** Pasted ad text → extraction → a listing in moderation (Phase 9a). */
export async function createManualListingAction(
  _prev: ManualFormState,
  form: FormData,
): Promise<ManualFormState> {
  const admin = await requireAdmin();
  const parsed = parseManualForm(
    Object.fromEntries(
      ["texto", "origem", "link", "telefone", "criar_mesmo_assim"].map((k) => [k, str(form, k)]),
    ),
  );
  if (!parsed.ok) {
    return { status: "error", message: "Corrija os campos marcados.", errors: parsed.errors };
  }
  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY) {
    return {
      status: "error",
      message: "A leitura automática está indisponível: falta a ANTHROPIC_API_KEY no servidor.",
    };
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.ANTHROPIC_MODEL_EXTRACTION ?? DEFAULT_EXTRACTION_MODEL;
  const result = await createManualListing(db(), {
    ...parsed.input,
    actor: actorOf(admin),
    extract: (input) => extractListing(input, { client, model }),
  });
  if (!result.ok) {
    return { status: "error", message: result.error, duplicate: result.duplicate };
  }
  refresh();
  redirect(`/admin/moderacao/${result.id}?ok=${result.ready ? "criado" : "criado_revisar"}`);
}
