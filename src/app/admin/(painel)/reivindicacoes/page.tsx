import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, formatDateTime, PageTitle } from "@/components/admin/bits";
import { ClaimDecision } from "@/components/admin/ops-forms";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin/auth";
import { listClaims } from "@/lib/admin/claims";
import { db } from "@/lib/db/client";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Reivindicações" };

export default function ClaimsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ClaimsView />
    </Suspense>
  );
}

const STATUS = {
  pending: {
    label: "Pendente",
    className: "border-warning/60 bg-warning-soft text-warning-foreground",
  },
  approved: { label: "Aprovada", className: "border-primary/40 text-primary" },
  rejected: { label: "Recusada", className: "text-muted-foreground" },
  cancelled: { label: "Cancelada", className: "text-muted-foreground" },
} as const;

async function ClaimsView() {
  await connection();
  await requireAdmin();
  const claims = await listClaims(db());
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Reivindicações" />
      <p className="text-sm text-muted-foreground">
        Aprove quando o código chegar pelo Direct de @{site.instagramHandle} vindo do Instagram do
        anúncio, ou quando o WhatsApp do anúncio confirmar o código. Aprovar dá ao vendedor o selo,
        o painel e os contatos do anúncio.
      </p>
      {claims.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma reivindicação.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {claims.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-semibold">{c.code}</span>
                <Badge variant="outline" className={STATUS[c.status].className}>
                  {STATUS[c.status].label}
                </Badge>
                <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
              </div>
              <p>
                <Link
                  href={`/admin/anuncios/${c.listingId}`}
                  className="font-medium hover:text-primary"
                >
                  Volvo {c.listingTitle}
                </Link>
                <span className="text-muted-foreground">
                  {" · "}contato do anúncio:{" "}
                  {[c.listingInstagram && `@${c.listingInstagram}`, c.listingPhone]
                    .filter(Boolean)
                    .join(" · ") || "nenhum"}
                </span>
              </p>
              <p>
                Vendedor: <strong className="font-medium">{c.sellerName}</strong>{" "}
                <span className="text-muted-foreground">
                  ({c.sellerType}) · {[c.sellerEmail, c.sellerPhone].filter(Boolean).join(" · ")}
                </span>
              </p>
              {c.evidence && <p className="text-muted-foreground">Prova informada: {c.evidence}</p>}
              {c.status === "pending" ? (
                <ClaimDecision id={c.id} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {c.decidedAt && formatDateTime(c.decidedAt)} ·{" "}
                  {c.decidedBy?.replace(/^admin:/, "")}
                  {c.decisionNote && ` · ${c.decisionNote}`}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
