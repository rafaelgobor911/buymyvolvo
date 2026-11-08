/**
 * npm run job -- <job...|all> [--dry-run] [--fixtures] [--force] [--only=a,b] [--limit=N] [--max-seconds=N]
 *
 * Runs collection/maintenance jobs locally, with the same code as the cron
 * routes. --fixtures uses the fictitious Instagram (sources ending in .demo /
 * _demo); without it, the real Graph API with IG_LONG_LIVED_TOKEN.
 * In this cloud sandbox Node's fetch needs NODE_USE_ENV_PROXY=1 to reach the API.
 */
import { parseServerEnv } from "@/lib/env/schema";
import { createFixtureWorld } from "@/lib/instagram/fixtures";
import { createJobDeps, isJobName, JOB_NAMES, JOBS, runNamedJob } from "@/lib/jobs";

import { connect, loadLocalEnv } from "./db/lib";

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "true";
}

function usage(): never {
  console.error(
    [
      "Uso: npm run job -- <job...|all> [--dry-run] [--fixtures] [--force] [--only=a,b] [--limit=N] [--max-seconds=N]",
      "",
      ...JOB_NAMES.map((name) => `  ${name.padEnd(28)} ${JOBS[name].description}`),
      `  ${"all".padEnd(28)} coleta (contas e hashtags), processa e faz a manutenção, nessa ordem`,
    ].join("\n"),
  );
  process.exit(2);
}

async function main() {
  loadLocalEnv();
  const names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (names.length === 0) usage();
  const jobs = names.flatMap((n) => (n === "all" ? JOB_NAMES : [n]));
  const unknown = jobs.filter((n) => !isJobName(n));
  if (unknown.length) {
    console.error(`Job desconhecido: ${unknown.join(", ")}\n`);
    usage();
  }

  const env = parseServerEnv(process.env);
  const sql = connect(env.DATABASE_URL);
  const deps = createJobDeps(env, {
    fixtures: flag("fixtures") ? createFixtureWorld() : undefined,
  });
  const options = {
    dryRun: flag("dry-run") === "true",
    force: flag("force") === "true",
    only: flag("only")
      ?.split(",")
      .map((h) => h.trim().replace(/^[@#]/, "").toLowerCase())
      .filter(Boolean),
    limit: flag("limit") ? Number(flag("limit")) : undefined,
    maxSeconds: flag("max-seconds") ? Number(flag("max-seconds")) : undefined,
    log: (message: string) => console.log(`  · ${message}`),
  };

  let failed = false;
  try {
    for (const name of jobs) {
      if (!isJobName(name)) continue;
      console.log(
        `▶ ${name}${options.dryRun ? " (dry-run)" : ""}${deps.mode === "fixtures" ? " (fixtures)" : ""}`,
      );
      const run = await runNamedJob(sql, name, deps, options);
      const icon = run.status === "failed" ? "✖" : run.status === "skipped" ? "–" : "✔";
      console.log(`${icon} ${run.status} em ${run.durationMs} ms`);
      console.log(JSON.stringify(run.stats, null, 2));
      for (const alert of run.alerts) console.log(`⚠ ${alert}`);
      if (run.error) console.error(`Erro: ${run.error}`);
      failed ||= run.status === "failed";
    }
  } finally {
    await sql.end();
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
