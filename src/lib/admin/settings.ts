/**
 * Operational settings (app_settings) editable in the admin, with validation.
 * Receives `sql` by parameter; changes go to audit_log.
 */
import type postgres from "postgres";

import {
  DEFAULT_INVITE_TEMPLATE,
  inviteTemplateProblem,
  MAX_BMV_NUMBERS,
  parseBmvNumbers,
} from "@/lib/authorization/messages";
import { DEFAULT_MESSAGE_TEMPLATE, unknownPlaceholders } from "@/lib/leads/message";

type Sql = postgres.Sql;

export type SettingKind = "message" | "invite" | "phones" | "number";
export type SettingGroup = "intermediation" | "operation";

export const SETTING_GROUPS: Record<SettingGroup, string> = {
  intermediation: "Intermediação",
  operation: "Publicação e coleta",
};

interface SettingDef {
  key: string;
  label: string;
  help: string;
  kind: SettingKind;
  group: SettingGroup;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  fallback: string | number;
}

export const SETTINGS: SettingDef[] = [
  {
    key: "bmv_whatsapp_numbers",
    label: "WhatsApp do Buy My Volvo",
    help: "Recebe os contatos dos compradores. Um número (os dois sócios usam o mesmo WhatsApp Business em aparelhos conectados) ou vários, separados por vírgula: os contatos se revezam entre eles.",
    kind: "phones",
    group: "intermediation",
    fallback: "",
  },
  {
    key: "seller_commission_brl",
    label: "Comissão fixa do vendedor (R$)",
    help: "Paga pelo vendedor só quando vende para um comprador apresentado pelo site. Aparece na página de autorização e fica registrada no aceite. 0 = ainda não definida: os convites ficam bloqueados.",
    kind: "number",
    group: "intermediation",
    min: 0,
    max: 100_000,
    integer: true,
    fallback: 0,
  },
  {
    key: "authorization_invite_template",
    label: "Mensagem do convite ao vendedor",
    help: "Enviada pelo WhatsApp ou pelo Direct para pedir a autorização. Variáveis: {modelo}, {versao}, {ano}, {site} e {link} (endereço da autorização, obrigatório).",
    kind: "invite",
    group: "intermediation",
    fallback: DEFAULT_INVITE_TEMPLATE,
  },
  {
    key: "whatsapp_message_template",
    label: "Mensagem do comprador no WhatsApp",
    help: "Preenchida quando o comprador clica no botão do anúncio. Variáveis: {modelo}, {versao}, {ano}, {site}, {url} (link curto do anúncio) e {ref} (código do contato, obrigatório).",
    kind: "message",
    group: "intermediation",
    fallback: DEFAULT_MESSAGE_TEMPLATE,
  },
  {
    key: "publish_confidence_threshold",
    group: "operation",
    label: "Confiança mínima da extração",
    help: 'Entre 0,5 e 1. Abaixo disso, a moderação mostra o anúncio como "revisar os dados" antes de convidar o vendedor.',
    kind: "number",
    min: 0.5,
    max: 1,
    step: 0.01,
    fallback: 0.85,
  },
  {
    key: "lead_dedupe_hours",
    group: "intermediation",
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
    group: "operation",
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
    group: "operation",
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
    group: "operation",
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
    group: "operation",
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
    group: "operation",
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
      def.kind !== "number"
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

export function parseSettingsForm(
  input: Record<string, string | undefined>,
  current: Partial<SettingValues> = {},
): SettingsParse {
  const values: SettingValues = {};
  const errors: Record<string, string> = {};
  for (const def of SETTINGS) {
    const raw = (input[def.key] ?? "").trim();
    if (def.kind === "message") {
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
    if (def.kind === "invite") {
      const template = raw.replace(/\s+/g, " ");
      const problem = inviteTemplateProblem(template);
      if (problem) errors[def.key] = problem;
      values[def.key] = template;
      continue;
    }
    if (def.kind === "phones") {
      // A saved value is kept as is (the seed's fictitious number included).
      if (raw === String(current[def.key] ?? "").trim()) {
        values[def.key] = raw;
        continue;
      }
      const { numbers, invalid } = parseBmvNumbers(raw);
      if (invalid.length) errors[def.key] = `Número inválido: ${invalid[0]}. Use o DDD.`;
      else if (numbers.length > MAX_BMV_NUMBERS)
        errors[def.key] = `Use no máximo ${MAX_BMV_NUMBERS} números.`;
      values[def.key] = invalid.length ? raw : numbers.join(", ");
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
