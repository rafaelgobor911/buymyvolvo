"use server";

/**
 * Admin Server Actions for operations (sources, jobs, removals, blocklist).
 * Each one re-checks the admin session and records the change in audit_log.
 */
import { refresh } from "next/cache";

import { actorOf, requireAdmin } from "@/lib/admin/auth";
import { addBlock, confirmRemoval, rejectRemoval, removeBlock } from "@/lib/admin/blocklist";
import { approveClaim, rejectClaim } from "@/lib/admin/claims";
import { setSellerPlan } from "@/lib/admin/ops";
import type { FormState } from "@/lib/admin/form-state";
import { addSources, setSourceActive, type SourceType } from "@/lib/admin/sources";
import { db } from "@/lib/db/client";
import { serverEnv } from "@/lib/env/server";
import { createJobDeps, isJobName, runNamedJob } from "@/lib/jobs";

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

export async function addSourcesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const type: SourceType =
    str(form, "tipo") === "ig_hashtag" ? "ig_hashtag" : "ig_business_account";
  const text = str(form, "fontes");
  if (!text.trim()) return { status: "error", message: "Informe pelo menos uma conta ou hashtag." };
  const result = await addSources(db(), { type, text, actor: actorOf(admin) });
  refresh();
  const prefix = type === "ig_hashtag" ? "#" : "@";
  const list = (items: string[]) => items.map((h) => `${prefix}${h}`).join(", ");
  const parts = [
    result.added.length && `Adicionadas: ${list(result.added)}.`,
    result.existing.length && `Já existiam: ${list(result.existing)}.`,
    result.invalid.length && `Inválidas: ${result.invalid.join(", ")}.`,
  ].filter(Boolean);
  return {
    status: result.added.length ? "saved" : "error",
    message: parts.join(" "),
    warnings:
      type === "ig_hashtag" && result.added.length
        ? ["Cada hashtag nova gasta uma das vagas do limite de 30 por 7 dias na primeira leitura."]
        : undefined,
  };
}

export async function toggleSourceAction(form: FormData) {
  const admin = await requireAdmin();
  await setSourceActive(db(), {
    id: str(form, "id"),
    active: str(form, "ativar") === "1",
    actor: actorOf(admin),
  });
  refresh();
}

/** Runs a job now (or rehearses it) within a short time budget. */
export async function runJobAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const job = str(form, "job");
  if (!isJobName(job)) return { status: "error", message: "Job desconhecido." };
  const dryRun = str(form, "ensaio") === "on";
  const sql = db();
  let run;
  try {
    run = await runNamedJob(sql, job, createJobDeps(serverEnv()), { dryRun, maxSeconds: 45 });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
  await sql`
    insert into public.audit_log (actor, action, entity, entity_id, changes)
    values (${actorOf(admin)}, 'job.run', 'job', ${job},
      ${sql.json({ dryRun: { from: null, to: dryRun }, status: { from: null, to: run.status } })})`;
  refresh();
  const label = {
    succeeded: "concluído",
    failed: "falhou",
    skipped: "nada a fazer",
    running: "em andamento",
  }[run.status];
  return {
    status: run.status === "failed" ? "error" : "saved",
    message: `${job}${dryRun ? " (ensaio)" : ""}: ${label} em ${(run.durationMs / 1000).toFixed(1).replace(".", ",")} s.`,
    warnings: run.alerts,
  };
}

export async function removalAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const result =
    str(form, "decisao") === "confirmar"
      ? await confirmRemoval(db(), { id, actor: actorOf(admin) })
      : await rejectRemoval(db(), { id, actor: actorOf(admin), note: str(form, "motivo") });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return {
    status: "saved",
    message:
      str(form, "decisao") === "confirmar"
        ? `Remoção confirmada. ${result.blocked} item(ns) na blocklist.`
        : "Pedido recusado.",
  };
}

export async function addBlockAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const result = await addBlock(db(), {
    kind: str(form, "tipo"),
    value: str(form, "valor"),
    reason: str(form, "motivo"),
    actor: actorOf(admin),
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: result.added ? "Bloqueado." : "Já estava na blocklist." };
}

export async function removeBlockAction(form: FormData) {
  const admin = await requireAdmin();
  await removeBlock(db(), { id: str(form, "id"), actor: actorOf(admin) });
  refresh();
}

export async function claimDecisionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const approve = str(form, "decisao") === "aprovar";
  const result = approve
    ? await approveClaim(db(), { id, actor: actorOf(admin) })
    : await rejectClaim(db(), { id, actor: actorOf(admin), note: str(form, "motivo") });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return {
    status: "saved",
    message: approve ? "Reivindicação aprovada." : "Reivindicação recusada.",
  };
}

export async function setSellerPlanAction(form: FormData) {
  const admin = await requireAdmin();
  await setSellerPlan(db(), {
    sellerId: str(form, "id"),
    plan: str(form, "plano"),
    actor: actorOf(admin),
  });
  refresh();
}
