/**
 * Operational settings (app_settings) editable in the admin, with validation.
 * Receives `sql` by parameter; changes go to audit_log.
 */
import type postgres from "postgres";

import { DEFAULT_MESSAGE_TEMPLATE, unknownPlaceholders } from "@/lib/leads/message";

type Sql = postgres.Sql;

interface SettingDef {
  key: string;
  label: string;
  help: string;
  kind: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  fallback: string | number;
}

export const SETTINGS: SettingDef[] = [
  {
    key: "whatsapp_message_template",
    label: "Mensagem do WhatsApp",
    help: "Usada no botão do anúncio. Variáveis: {modelo}, {versao}, {ano}, {site}, {url} (link curto do anúncio) e {ref} (código do contato, obrigatório).",
    kind: "text",
    fallback: DEFAULT_MESSAGE_TEMPLATE,
  },
  {
    key: "publish_confidence_threshold",
    label: "Confiança mínima para publicar sem moderação",
    help: "Entre 0,5 e 1. Abaixo disso, o anúncio vai para a fila de moderação.",
    kind: "number",
    min: 0.5,
    max: 1,
    step: 0.01,
    fallback: 0.85,
  },
  {
    key: "lead_dedupe_hours",
    label: "Cliques repetidos contam como um contato por (horas)",
    help: "Mesmo aparelho no mesmo anúncio dentro desse intervalo reaproveita o código. 0 desliga.",
    kind: "number",
    min: 0,
    max: 168,
    integer: true,
    fallback: 24,
  },
  {
    key: "hashtag_stale_after_days",
    label: 'Aviso "pode não estar mais disponível" (dias)',
    help: "Para anúncios que vieram só de hashtag, contados desde a publicação.",
    kind: "number",
    min: 1,
    max: 90,
    integer: true,
    fallback: 14,
  },
  {
    key: "hashtag_expire_after_days",
    label: "Expiração de anúncios de hashtag (dias)",
    help: "Precisa ser maior ou igual ao prazo do aviso.",
    kind: "number",
    min: 1,
    max: 180,
    integer: true,
    fallback: 30,
  },
  {
    key: "hashtag_budget_max",
    label: "Hashtags únicas por 7 dias",
    help: "O limite da Meta é 30; a folga cobre consultas manuais.",
    kind: "number",
    min: 1,
    max: 30,
    integer: true,
    fallback: 25,
  },
  {
    key: "business_discovery_pages",
    label: "Páginas lidas por loja a cada coleta",
    help: "Cada página tem até 25 posts.",
    kind: "number",
    min: 1,
    max: 10,
    integer: true,
    fallback: 2,
  },
  {
    key: "token_alert_days",
    label: "Avisar quando o token do Instagram vencer em (dias)",
    help: "O aviso aparece no início do admin.",
    kind: "number",
    min: 1,
    max: 60,
    integer: true,
    fallback: 10,
  },
];

export type SettingValues = Record<string, string | number>;

export async function readSettings(sql: Sql): Promise<SettingValues> {
  const rows = await sql<{ key: string; value: unknown }[]>`
    select key, value from public.app_settings where key = any(${SETTINGS.map((s) => s.key)})`;
  const values: SettingValues = {};
  for (const def of SETTINGS) {
    const raw = rows.find((r) => r.key === def.key)?.value;
    values[def.key] =
      def.kind === "text"
        ? typeof raw === "string"
          ? raw
          : String(def.fallback)
        : Number.isFinite(Number(raw))
          ? Number(raw)
          : def.fallback;
  }
  return values;
}

export type SettingsParse =
  { ok: true; values: SettingValues } | { ok: false; errors: Record<string, string> };

export function parseSettingsForm(input: Record<string, string | undefined>): SettingsParse {
  const values: SettingValues = {};
  const errors: Record<string, string> = {};
  for (const def of SETTINGS) {
    const raw = (input[def.key] ?? "").trim();
    if (def.kind === "text") {
      const template = raw.replace(/\s+/g, " ");
      const unknown = unknownPlaceholders(template);
      if (!template) errors[def.key] = "A mensagem não pode ficar vazia.";
      else if (template.length > 500) errors[def.key] = "Use no máximo 500 caracteres.";
      else if (!/\{ref\}/i.test(template))
        errors[def.key] = "Inclua {ref}: é o código que registra o contato.";
      else if (unknown.length) errors[def.key] = `Variável desconhecida: {${unknown[0]}}.`;
      values[def.key] = template;
      continue;
    }
    const n = Number(raw.replace(",", "."));
    if (!raw || !Number.isFinite(n)) errors[def.key] = "Informe um número.";
    else if (def.integer && !Number.isInteger(n)) errors[def.key] = "Use um número inteiro.";
    else if (n < def.min! || n > def.max!) {
      errors[def.key] =
        `Entre ${String(def.min).replace(".", ",")} e ${String(def.max).replace(".", ",")}.`;
    }
    values[def.key] = n;
  }
  if (
    !errors.hashtag_expire_after_days &&
    Number(values.hashtag_expire_after_days) < Number(values.hashtag_stale_after_days)
  ) {
    errors.hashtag_expire_after_days = "A expiração não pode vir antes do aviso.";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

/** Saves what changed; each changed key gets its own audit entry. */
export async function saveSettings(sql: Sql, values: SettingValues, actor: string) {
  const current = await readSettings(sql);
  const changed = SETTINGS.filter(
    (d) => values[d.key] !== undefined && values[d.key] !== current[d.key],
  );
  if (changed.length === 0) return 0;
  await sql.begin(async (tx) => {
    for (const def of changed) {
      const value = values[def.key]!;
      await tx`
        insert into public.app_settings (key, value, description, updated_by)
        values (${def.key}, ${tx.json(value)}, ${def.label}, ${actor})
        on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by`;
      await tx`
        insert into public.audit_log (actor, action, entity, entity_id, changes)
        values (${actor}, 'settings.update', 'app_settings', ${def.key},
          ${tx.json({ value: { from: current[def.key]!, to: value } })})`;
    }
  });
  return changed.length;
}
