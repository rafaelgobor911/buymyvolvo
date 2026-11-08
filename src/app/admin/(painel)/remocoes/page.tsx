import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, formatDateTime, PageTitle } from "@/components/admin/bits";
import { RemovalDecision } from "@/components/admin/ops-forms";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin/auth";
import { listRemovalRequests } from "@/lib/admin/blocklist";
import { db } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Remoções" };

export default function RemovalsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <RemovalsView />
    </Suspense>
  );
}

const STATUS = {
  pending: {
    label: "Pendente",
    className: "border-warning/60 bg-warning-soft text-warning-foreground",
  },
  confirmed: { label: "Confirmado", className: "border-primary/40 text-primary" },
  rejected: { label: "Recusado", className: "text-muted-foreground" },
} as const;

async function RemovalsView() {
  await connection();
  await requireAdmin();
  const requests = await listRemovalRequests(db());
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Pedidos de remoção" />
      <p className="text-sm text-muted-foreground">
        O anúncio sai do ar assim que o pedido chega. Confirme em até 48 h: a confirmação põe o
        telefone, o @ e os posts do anúncio na blocklist, para não voltarem na coleta. Recusar
        devolve o anúncio ao ar.
      </p>
      {requests.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {requests.map((r) => {
            const hours = r.hoursOpen;
            return (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/anuncios/${r.listingId}`}
                    className="font-medium hover:text-primary"
                  >
                    Volvo {r.listingTitle}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.listingShortId}
                  </span>
                  <Badge variant="outline" className={STATUS[r.status].className}>
                    {STATUS[r.status].label}
                  </Badge>
                  <span
                    className={cn(
                      "text-muted-foreground",
                      r.status === "pending" && hours >= 36 && "font-medium text-destructive",
                    )}
                  >
                    {formatDateTime(r.createdAt)}
                    {r.status === "pending" && ` · há ${hours} h`}
                  </span>
                </div>
                {r.reason && <p>&quot;{r.reason}&quot;</p>}
                {r.requesterContact && (
                  <p className="text-muted-foreground">
                    Contato de quem pediu: {r.requesterContact}
                  </p>
                )}
                {r.status === "pending" ? (
                  <RemovalDecision id={r.id} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {r.processedAt && formatDateTime(r.processedAt)} ·{" "}
                    {r.processedBy?.replace(/^admin:/, "")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
