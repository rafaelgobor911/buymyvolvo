import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, PageTitle } from "@/components/admin/bits";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { moderationQueue } from "@/lib/admin/listings";
import { db } from "@/lib/db/client";
import { RED_FLAG_LABELS, type RedFlag } from "@/lib/extraction/schema";
import { formatPlace, formatPrice, formatRelativeDays } from "@/lib/listings/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderação" };

const OK_MESSAGES: Record<string, string> = {
  aprovado: "Anúncio aprovado e publicado. A fila acabou.",
  rejeitado: "Anúncio rejeitado. A fila acabou.",
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
  const { ok } = await searchParams;
  const queue = await moderationQueue(db());
  const now = new Date();
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title={`Moderação (${queue.length})`}>
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
      {queue.length === 0 ? (
        <p className="text-muted-foreground">Nenhum anúncio esperando moderação.</p>
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
