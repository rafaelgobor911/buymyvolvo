/**
 * npm run extract:eval [-- --set=real] [--offline] [--limit=N] [--concurrency=N] [--model=ID]
 *
 * Runs a gold set through pre-filter → Claude → normalization and writes a
 * per-field accuracy and cost report to evals/extraction/reports/.
 * --set=fictitious (default): the 40 fictitious captions.
 * --set=real: real captions from the monitored shops and hashtags (anonymized).
 * --offline evaluates only the pre-filter (no API calls, no cost).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { format, resolveConfig } from "prettier";

import { emptyUsage } from "@/lib/extraction/cost";
import {
  DEFAULT_EXTRACTION_MODEL,
  ExtractionError,
  extractListing,
} from "@/lib/extraction/extract";
import { normalizeExtraction } from "@/lib/extraction/normalize";
import { prefilter } from "@/lib/extraction/prefilter";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/extraction/prompt";

import { EVAL_CASES, type EvalCase } from "../evals/extraction/dataset";
import { REAL_EVAL_CASES } from "../evals/extraction/dataset-real";
import { type CaseResult, renderMarkdown, scoreResults } from "../evals/extraction/score";
import { loadLocalEnv } from "./db/lib";

const ROOT = path.resolve(import.meta.dirname, "..");
const NOW = new Date("2026-11-08T12:00:00-03:00");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=")[1] : "true";
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/** Reports are committed, so they go through the project's Prettier config (npm run check). */
async function writeFormatted(file: string, content: string) {
  const options = (await resolveConfig(file)) ?? {};
  await writeFile(file, await format(content, { ...options, filepath: file }));
}

async function main() {
  loadLocalEnv();
  const offline = arg("offline") === "true";
  const limit = Number(arg("limit") ?? EVAL_CASES.length);
  const concurrency = Number(arg("concurrency") ?? 4);
  const model = arg("model") ?? process.env.ANTHROPIC_MODEL_EXTRACTION ?? DEFAULT_EXTRACTION_MODEL;
  const set = arg("set") ?? "fictitious";
  if (set !== "fictitious" && set !== "real") {
    console.error('--set deve ser "fictitious" ou "real".');
    process.exit(2);
  }
  const all = set === "real" ? REAL_EVAL_CASES : EVAL_CASES;
  const cases = all.slice(0, limit);

  if (!offline && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY não está definida. Configure-a no ambiente (ver README) ou rode com --offline para avaliar só o pré-filtro.",
    );
    process.exit(1);
  }
  const client = offline ? null : new Anthropic();
  let done = 0;

  const runCase = async (c: EvalCase): Promise<CaseResult> => {
    const filter = prefilter(c.caption, { origin: c.origin });
    const base: CaseResult = {
      id: c.id,
      prefilterPass: filter.pass,
      prefilterReason: filter.reason,
      usage: emptyUsage(),
    };
    if (!filter.pass || !client) return base;
    const started = performance.now();
    try {
      const r = await extractListing(
        { caption: c.caption, igUsername: c.igUsername, bio: c.bio },
        { client, model },
      );
      const normalized = normalizeExtraction(r.output, {
        caption: c.caption,
        igUsername: c.igUsername,
        bio: c.bio,
        now: NOW,
      });
      return {
        ...base,
        normalized,
        usage: r.usage,
        model: r.model,
        latencyMs: performance.now() - started,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...base,
        error: message,
        usage: error instanceof ExtractionError ? error.usage : emptyUsage(),
        latencyMs: performance.now() - started,
      };
    } finally {
      done++;
      if (!offline) process.stderr.write(`\r${done}/${cases.length} casos`);
    }
  };

  // Warm the prompt cache with one call before going parallel; otherwise each of
  // the first concurrent calls pays a cache write, which production (sequential) does not.
  const results: CaseResult[] = new Array(cases.length);
  const warm = offline ? -1 : cases.findIndex((c) => prefilter(c.caption).pass);
  if (warm >= 0) results[warm] = await runCase(cases[warm]!);
  const rest = cases.flatMap((c, i) => (i === warm ? [] : [{ c, i }]));
  await pool(rest, offline ? 1 : concurrency, async ({ c, i }) => {
    results[i] = await runCase(c);
  });
  if (!offline) process.stderr.write("\n");

  const report = scoreResults(cases, results, offline ? null : model);
  const date = new Date().toISOString();
  const markdown = renderMarkdown(report, {
    date,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    dataset: set === "real" ? "evals/extraction/dataset-real.ts" : "evals/extraction/dataset.ts",
  });
  console.log(markdown);

  const dir = path.join(ROOT, "evals/extraction/reports");
  await mkdir(dir, { recursive: true });
  const prefix = set === "real" ? "real-" : "";
  const stem = `${prefix}${offline ? "prefilter-latest" : `latest-${model}`}`;
  await writeFormatted(path.join(dir, `${stem}.md`), markdown);
  await writeFormatted(
    path.join(dir, `${stem}.json`),
    JSON.stringify({ date, promptVersion: EXTRACTION_PROMPT_VERSION, report, results }, null, 2),
  );
  console.error(`Relatório salvo em evals/extraction/reports/${stem}.md`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Anthropic.APIError ? `Erro da API (${error.status}): ${error.message}` : error,
  );
  process.exit(1);
});
