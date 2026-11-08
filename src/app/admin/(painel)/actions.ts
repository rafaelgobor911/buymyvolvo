"use server";

/**
 * Admin Server Actions. Each one re-checks the admin session (never trusts
 * the page that rendered the form), validates the input on the server and
 * records the change in audit_log through the data layer.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { actorOf, requireAdmin } from "@/lib/admin/auth";
import type { FormState } from "@/lib/admin/form-state";
import { formDataToInput, parseListingForm } from "@/lib/admin/listing-form";
import {
  ADMIN_STATUSES,
  type AdminStatus,
  getAdminListing,
  nextInQueue,
  saveListing,
  setListingStatus,
} from "@/lib/admin/listings";
import { parseSettingsForm, saveSettings, SETTINGS } from "@/lib/admin/settings";
import { db } from "@/lib/db/client";

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

/** After a decision in the moderation queue, open the next listing. */
async function goToNext(id: string, ok: string): Promise<never> {
  const next = await nextInQueue(db(), id);
  redirect(next ? `/admin/moderacao/${next}?ok=${ok}` : `/admin/moderacao?ok=${ok}`);
}

export async function saveListingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const approve = str(form, "intent") === "approve";
  const sql = db();
  const current = await getAdminListing(sql, id);
  if (!current) return { status: "error", message: "Anúncio não encontrado." };

  const parsed = parseListingForm(formDataToInput(form), { phone: current.phone });
  if (!parsed.ok) {
    return { status: "error", message: "Corrija os campos marcados.", errors: parsed.errors };
  }
  const result = await saveListing(sql, {
    id,
    patch: parsed.patch,
    actor: actorOf(admin),
    adminEmail: admin.email,
    approve,
  });
  if (!result.ok) return { status: "error", message: result.error, warnings: parsed.warnings };
  if (approve && str(form, "from") === "moderacao") await goToNext(id, "aprovado");
  refresh();
  return {
    status: "saved",
    message: approve ? "Publicado." : result.changed ? "Alterações salvas." : "Nada mudou.",
    warnings: parsed.warnings,
  };
}

export async function rejectListingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const note = [str(form, "motivo").trim(), str(form, "detalhe").trim()].filter(Boolean).join(": ");
  const result = await setListingStatus(db(), {
    id,
    status: "rejected",
    actor: actorOf(admin),
    note,
  });
  if (!result.ok) return { status: "error", message: result.error };
  if (str(form, "from") === "moderacao") await goToNext(id, "rejeitado");
  refresh();
  return { status: "saved", message: "Anúncio rejeitado." };
}

export async function setStatusAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const status = str(form, "status") as AdminStatus;
  if (!ADMIN_STATUSES.includes(status)) return { status: "error", message: "Status inválido." };
  const result = await setListingStatus(db(), {
    id: str(form, "id"),
    status,
    actor: actorOf(admin),
    note: str(form, "detalhe"),
    block: str(form, "bloquear") === "on",
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: result.changed ? "Status alterado." : "Nada mudou." };
}

export async function saveSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const input = Object.fromEntries(SETTINGS.map((s) => [s.key, str(form, s.key)]));
  const parsed = parseSettingsForm(input);
  if (!parsed.ok) {
    return { status: "error", message: "Corrija os campos marcados.", errors: parsed.errors };
  }
  const changed = await saveSettings(db(), parsed.values, actorOf(admin));
  refresh();
  return {
    status: "saved",
    message: changed ? `${changed} configuração(ões) salva(s).` : "Nada mudou.",
  };
}
