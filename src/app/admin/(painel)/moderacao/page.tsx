import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, PageTitle } from "@/components/admin/bits";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { moderationCounts, moderationQueue } from "@/lib/admin/listings";
import { OUTREACH_LABELS, type OutreachStatus } from "@/lib/authorization/data";
import { db } from "@/lib/db/client";
import { RED_FLAG_LABELS, type RedFlag } from "@/lib/extraction/schema";
import { formatPlace, formatPrice, formatRelativeDays } from "@/lib/listings/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderação" };

const OK_MESSAGES: Record<string, string> = {
  aprovado: "Anúncio aprovado e publicado. A fila acabou.",
  rejeitado: "Anúncio rejeitado. A fila acabou.",
  recusado: "Recusa do vendedor registrada. A fila acabou.",
};

/** Tabs: the steps of the seller authorization (`?etapa=`). */
const STEPS: { param: string; status: OutreachStatus | null; label: string }[] = [
  { param: "", status: null, label: "Todos" },
  { param: "contatar", status: "to_contact", label: "A contatar" },
  { param: "convidados", status: "invited", label: "Convite enviado" },
  { param: "autorizados", status: "authorized", label: "Autorizados" },
];

const OUTREACH_STYLE: Record<OutreachStatus, string> = {
  to_contact: "border-border text-muted-foreground",
  invited: "border-warning/60 text-warning-foreground",
  authorized: "border-primary/40 text-primary",
  declined: "border-destructive/40 text-destructive",
};

export default function ModerationPage(props: PageProps<"/admin/moderacao">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <QueueView searchParams={props.searchParams} />
    </Suspense>
  );
}

async function QueueView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdmin();
  const { ok, etapa } = await searchParams;
  const step = STEPS.find((s) => s.param === (typeof etapa === "string" ? etapa : "")) ?? STEPS[0]!;
  const sql = db();
  const [queue, counts] = await Promise.all([
    moderationQueue(sql, { outreach: step.status }),
    moderationCounts(sql),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const now = new Date();
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title={`Moderação (${total})`}>
        {queue[0] && (
          <Link
            href={`/admin/moderacao/${queue[0].id}`}
            className={cn(buttonVariants(), "h-10 rounded-xl px-4")}
          >
            Começar pelo mais antigo
          </Link>
        )}
      </PageTitle>
      {typeof ok === "string" && OK_MESSAGES[ok] && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
        >
          <CheckCircle2 className="size-4 text-primary" aria-hidden />
          {OK_MESSAGES[ok]}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Nenhum anúncio vai ao ar sem a autorização do vendedor: revise os dados, envie o convite e
        aprove quando ele autorizar.
      </p>
      <nav
        aria-label="Etapas da autorização"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {STEPS.map((s) => {
          const n = s.status ? counts[s.status] : total;
          const current = s === step;
          return (
            <Link
              key={s.param}
              href={s.param ? `/admin/moderacao?etapa=${s.param}` : "/admin/moderacao"}
              aria-current={current ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                current
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label} ({n})
            </Link>
          );
        })}
      </nav>
      {queue.length === 0 ? (
        <p className="text-muted-foreground">
          {step.status ? "Nenhum anúncio nesta etapa." : "Nenhum anúncio esperando moderação."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {queue.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/moderacao/${item.id}`}
                className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">
                    Volvo {item.title} {item.yearModel ?? ""}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {[formatPrice(item.priceCents), formatPlace(item.city, item.uf)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {item.firstIssue && (
                    <span className="text-sm text-warning-foreground">{item.firstIssue}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end">
                  <Badge variant="outline" className={OUTREACH_STYLE[item.outreach]}>
                    {OUTREACH_LABELS[item.outreach]}
                  </Badge>
                  {item.redFlags
                    .filter((f) => f !== "sem_contato")
                    .map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className="border-warning/60 text-warning-foreground"
                      >
                        {RED_FLAG_LABELS[f as RedFlag]?.split(" (")[0] ?? f}
                      </Badge>
                    ))}
                  {item.confidence !== null && (
                    <span>confiança {item.confidence.toFixed(2).replace(".", ",")}</span>
                  )}
                  <span>{formatRelativeDays(item.createdAt, now)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
