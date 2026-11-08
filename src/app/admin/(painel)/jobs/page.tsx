import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, formatDateTime, PageTitle } from "@/components/admin/bits";
import { RunJobForm } from "@/components/admin/ops-forms";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin/auth";
import { aiCost30d, jobHistory, type JobRunRow } from "@/lib/admin/ops";
import { db } from "@/lib/db/client";
import { isJobName, JOB_NAMES, JOBS } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage(props: PageProps<"/admin/jobs">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <JobsView searchParams={props.searchParams} />
    </Suspense>
  );
}

const STATUS: Record<JobRunRow["status"], { label: string; className: string }> = {
  succeeded: { label: "ok", className: "border-primary/40 text-primary" },
  failed: { label: "falhou", className: "border-destructive/40 text-destructive" },
  skipped: { label: "nada a fazer", className: "text-muted-foreground" },
  running: { label: "rodando", className: "border-warning/60 text-warning-foreground" },
};

/** The run's numbers, without the alerts (shown on their own line). */
const statsLine = (stats: Record<string, unknown> | null) =>
  Object.entries(stats ?? {})
    .filter(
      ([key, value]) =>
        key !== "alerts" && (typeof value === "number" || typeof value === "string"),
    )
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");

async function JobsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdmin();
  const { job } = await searchParams;
  const filter = typeof job === "string" && isJobName(job) ? job : null;
  const sql = db();
  const [runs, cost] = await Promise.all([jobHistory(sql, { job: filter }), aiCost30d(sql)]);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Jobs">
        <span className="text-sm text-muted-foreground">
          Custo de IA em 30 dias: US$ {cost.toFixed(4).replace(".", ",")}
        </span>
      </PageTitle>

      <section
        aria-labelledby="rodar"
        className="flex flex-col gap-3 rounded-xl border border-border p-4"
      >
        <h2 id="rodar" className="font-semibold">
          Rodar agora
        </h2>
        <RunJobForm
          jobs={JOB_NAMES.map((name) => ({
            value: name,
            label: `${name}: ${JOBS[name].description}`,
          }))}
        />
      </section>

      <nav aria-label="Filtrar por job" className="flex flex-wrap gap-1 text-sm">
        {[null, ...JOB_NAMES].map((name) => (
          <Link
            key={name ?? "todos"}
            href={name ? `/admin/jobs?job=${name}` : "/admin/jobs"}
            aria-current={name === filter ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted",
              name === filter && "bg-secondary text-foreground",
            )}
          >
            {name ?? "Todos"}
          </Link>
        ))}
      </nav>

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {runs.map((r) => {
            const alerts = Array.isArray(r.stats?.alerts) ? (r.stats.alerts as string[]) : [];
            const seconds = r.finishedAt && (r.finishedAt.getTime() - r.startedAt.getTime()) / 1000;
            return (
              <li
                key={r.id}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.jobName}</span>
                  <Badge variant="outline" className={STATUS[r.status].className}>
                    {STATUS[r.status].label}
                  </Badge>
                  {r.dryRun && <Badge variant="outline">ensaio</Badge>}
                  <span className="text-muted-foreground">
                    {formatDateTime(r.startedAt)}
                    {seconds !== null && ` · ${seconds.toFixed(1).replace(".", ",")} s`}
                    {r.aiCostUsd ? ` · US$ ${r.aiCostUsd.toFixed(4).replace(".", ",")}` : ""}
                  </span>
                </div>
                {statsLine(r.stats) && (
                  <p className="text-muted-foreground">{statsLine(r.stats)}</p>
                )}
                {r.error && <p className="text-destructive">{r.error}</p>}
                {alerts.map((a) => (
                  <p key={a} className="text-warning-foreground">
                    {a}
                  </p>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
