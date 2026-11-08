/** Scores extraction results against the gold dataset and renders the report. */
import { estimateCostUsd, type TokenUsage, addUsage, emptyUsage } from "@/lib/extraction/cost";
import type { NormalizedListing } from "@/lib/extraction/normalize";
import { foldText } from "@/lib/extraction/text";

import type { EvalCase, EvalExpected } from "./dataset";

export interface CaseResult {
  id: string;
  prefilterPass: boolean;
  prefilterReason: string;
  normalized?: NormalizedListing;
  error?: string;
  usage: TokenUsage;
  model?: string;
  latencyMs?: number;
}

export const SCORED_FIELDS = [
  "modelId",
  "engineId",
  "trimId",
  "yearFab",
  "yearModel",
  "km",
  "price",
  "city",
  "uf",
  "transmission",
  "fuel",
  "sellerType",
  "phone",
] as const;
type Field = (typeof SCORED_FIELDS)[number];

function actualValue(n: NormalizedListing | undefined, field: Field): unknown {
  if (!n) return undefined;
  switch (field) {
    case "price":
      return n.priceCents == null ? null : n.priceCents / 100;
    case "phone":
      return n.contactPhone;
    default:
      return n[field];
  }
}

const same = (field: Field, expected: unknown, actual: unknown) =>
  field === "city" && typeof expected === "string" && typeof actual === "string"
    ? foldText(expected) === foldText(actual)
    : expected === actual;

export interface FieldMismatch {
  id: string;
  field: string;
  expected: unknown;
  actual: unknown;
}

export interface EvalReport {
  model: string | null;
  cases: number;
  prefilter: { correct: number; total: number; falseNegatives: string[]; falsePositives: string[] };
  isListing: { correct: number; total: number; misses: string[] };
  fields: Record<Field, { correct: number; total: number }>;
  overallFieldAccuracy: number;
  redFlags: { found: number; expected: number };
  summaryCopied: string[];
  errors: Array<{ id: string; error: string }>;
  mismatches: FieldMismatch[];
  usage: TokenUsage;
  extractedCalls: number;
  costUsd: number | null;
  costPer1000PostsUsd: number | null;
  costPer1000ExtractionsUsd: number | null;
  avgLatencyMs: number | null;
}

export function scoreResults(
  cases: EvalCase[],
  results: CaseResult[],
  model: string | null,
): EvalReport {
  const byId = new Map(results.map((r) => [r.id, r]));
  const fields = Object.fromEntries(
    SCORED_FIELDS.map((f) => [f, { correct: 0, total: 0 }]),
  ) as EvalReport["fields"];
  const report: EvalReport = {
    model,
    cases: cases.length,
    prefilter: { correct: 0, total: 0, falseNegatives: [], falsePositives: [] },
    isListing: { correct: 0, total: 0, misses: [] },
    fields,
    overallFieldAccuracy: 0,
    redFlags: { found: 0, expected: 0 },
    summaryCopied: [],
    errors: [],
    mismatches: [],
    usage: emptyUsage(),
    extractedCalls: 0,
    costUsd: null,
    costPer1000PostsUsd: null,
    costPer1000ExtractionsUsd: null,
    avgLatencyMs: null,
  };
  const latencies: number[] = [];

  for (const c of cases) {
    const r = byId.get(c.id);
    if (!r) continue;
    const exp: EvalExpected = c.expected;

    report.prefilter.total++;
    if (r.prefilterPass === exp.prefilter) report.prefilter.correct++;
    else
      (exp.prefilter ? report.prefilter.falseNegatives : report.prefilter.falsePositives).push(
        c.id,
      );

    if (r.error) report.errors.push({ id: c.id, error: r.error });
    if (r.normalized || r.error) report.extractedCalls++;
    report.usage = addUsage(report.usage, r.usage);
    if (r.latencyMs != null) latencies.push(r.latencyMs);

    const predictedListing = r.prefilterPass && !!r.normalized?.isListing && !!r.normalized.modelId;
    report.isListing.total++;
    if (predictedListing === exp.isListing) report.isListing.correct++;
    else report.isListing.misses.push(c.id);

    if (r.normalized?.issues.some((i) => i.code === "summary_copied"))
      report.summaryCopied.push(c.id);
    if (!exp.isListing) continue;

    for (const field of SCORED_FIELDS) {
      const expected = exp[field];
      if (expected === undefined) continue;
      const actual = actualValue(r.normalized, field);
      fields[field].total++;
      if (same(field, expected, actual)) fields[field].correct++;
      else report.mismatches.push({ id: c.id, field, expected, actual: actual ?? null });
    }
    for (const flag of exp.redFlags ?? []) {
      report.redFlags.expected++;
      if (r.normalized?.redFlags.includes(flag)) report.redFlags.found++;
      else
        report.mismatches.push({
          id: c.id,
          field: `redFlag:${flag}`,
          expected: true,
          actual: false,
        });
    }
  }

  const totals = Object.values(fields).reduce(
    (acc, f) => ({ correct: acc.correct + f.correct, total: acc.total + f.total }),
    { correct: 0, total: 0 },
  );
  report.overallFieldAccuracy = totals.total ? totals.correct / totals.total : 0;
  if (model) {
    const cost = estimateCostUsd(model, report.usage);
    report.costUsd = cost;
    if (cost != null) {
      report.costPer1000PostsUsd = (cost / Math.max(1, report.cases)) * 1000;
      report.costPer1000ExtractionsUsd = (cost / Math.max(1, report.extractedCalls)) * 1000;
    }
  }
  report.avgLatencyMs = latencies.length
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : null;
  return report;
}

const pct = (n: number, d: number) =>
  d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}% (${n}/${d})`;
const usd = (n: number | null) => (n == null ? "n/a" : `US$ ${n.toFixed(4)}`);

const FIELD_LABELS: Record<Field, string> = {
  modelId: "Modelo",
  engineId: "Motor",
  trimId: "Versão",
  yearFab: "Ano fabricação",
  yearModel: "Ano modelo",
  km: "Km",
  price: "Preço",
  city: "Cidade",
  uf: "UF",
  transmission: "Câmbio",
  fuel: "Combustível",
  sellerType: "Tipo de vendedor",
  phone: "Telefone",
};

export function renderMarkdown(
  report: EvalReport,
  meta: { date: string; promptVersion: string },
): string {
  const lines = [
    `# Avaliação da extração`,
    "",
    `- Data: ${meta.date}`,
    `- Modelo: ${report.model ?? "(somente pré-filtro, sem chamadas à API)"}`,
    `- Versão do prompt: ${meta.promptVersion}`,
    `- Casos: ${report.cases} (conjunto em \`evals/extraction/dataset.ts\`)`,
    "",
    "## Resumo",
    "",
    `| Métrica | Resultado |`,
    `| --- | --- |`,
    `| Pré-filtro correto | ${pct(report.prefilter.correct, report.prefilter.total)} |`,
  ];
  if (report.model) {
    lines.push(
      `| "É anúncio de Volvo?" correto | ${pct(report.isListing.correct, report.isListing.total)} |`,
      `| Campos corretos (geral) | ${(report.overallFieldAccuracy * 100).toFixed(1)}% |`,
      `| Sinais de alerta encontrados | ${pct(report.redFlags.found, report.redFlags.expected)} |`,
      `| Resumos que copiam a legenda | ${report.summaryCopied.length} |`,
      `| Erros de extração | ${report.errors.length} |`,
      `| Custo desta rodada | ${usd(report.costUsd)} |`,
      `| Custo por 1.000 posts (com pré-filtro) | ${usd(report.costPer1000PostsUsd)} |`,
      `| Custo por 1.000 extrações | ${usd(report.costPer1000ExtractionsUsd)} |`,
      `| Latência média por extração | ${report.avgLatencyMs == null ? "n/a" : `${Math.round(report.avgLatencyMs)} ms`} |`,
      "",
      "## Acurácia por campo",
      "",
      "| Campo | Acurácia |",
      "| --- | --- |",
      ...SCORED_FIELDS.map(
        (f) => `| ${FIELD_LABELS[f]} | ${pct(report.fields[f].correct, report.fields[f].total)} |`,
      ),
      "",
      "## Tokens",
      "",
      `Entrada ${report.usage.inputTokens} · saída ${report.usage.outputTokens} · gravação em cache ${report.usage.cacheWriteTokens} · leitura de cache ${report.usage.cacheReadTokens}. Custos de cache estimados com os multiplicadores padrão (ver \`src/lib/extraction/cost.ts\`).`,
    );
  }
  lines.push(
    "",
    "## Pré-filtro",
    "",
    `- Deveriam passar e foram barrados: ${report.prefilter.falseNegatives.join(", ") || "nenhum"}`,
    `- Deveriam ser barrados e passaram: ${report.prefilter.falsePositives.join(", ") || "nenhum"}`,
  );
  if (report.model) {
    lines.push(
      "",
      "## Divergências",
      "",
      report.mismatches.length === 0 ? "Nenhuma." : "| Caso | Campo | Esperado | Obtido |",
      ...(report.mismatches.length ? ["| --- | --- | --- | --- |"] : []),
      ...report.mismatches.map(
        (m) =>
          `| ${m.id} | ${m.field} | ${JSON.stringify(m.expected)} | ${JSON.stringify(m.actual)} |`,
      ),
      ...(report.isListing.misses.length
        ? ["", `Classificação errada (é/não é anúncio): ${report.isListing.misses.join(", ")}`]
        : []),
      ...(report.errors.length
        ? ["", "Erros:", ...report.errors.map((e) => `- ${e.id}: ${e.error}`)]
        : []),
    );
  }
  return lines.join("\n") + "\n";
}
