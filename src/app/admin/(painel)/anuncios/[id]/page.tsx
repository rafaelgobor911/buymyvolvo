import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, formatDateTime, StatusBadge } from "@/components/admin/bits";
import { AuthorizationSection } from "@/components/admin/authorization-section";
import { StatusForm } from "@/components/admin/listing-actions";
import { ListingEditForm } from "@/components/admin/listing-edit-form";
import { ListingPhotosPanel } from "@/components/admin/listing-photos-panel";
import { PostPanel } from "@/components/admin/post-panel";
import { requireAdmin } from "@/lib/admin/auth";
import { formValues, listingFormOptions } from "@/lib/admin/form-options";
import { FIELD_LABELS, type ListingPatch } from "@/lib/admin/listing-form";
import {
  ADMIN_STATUSES,
  type AuditEntry,
  getAdminListing,
  listingHistory,
  STATUS_LABELS,
} from "@/lib/admin/listings";
import { db } from "@/lib/db/client";
import { formatKm, formatPrice } from "@/lib/listings/format";
import { getModel } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Anúncio" };

export default function AdminListingPage(props: PageProps<"/admin/anuncios/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ListingView params={props.params} />
    </Suspense>
  );
}

const ACTIONS: Record<string, string> = {
  "listing.approve": "Aprovou",
  "listing.update": "Editou",
  "listing.status": "Mudou o status",
  "listing.reject": "Rejeitou",
  "listing.reopen": "Voltou para a moderação",
};

const show = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? "vazio"
    : Array.isArray(value)
      ? value.join(", ") || "vazio"
      : String(value);

function changeLines(entry: AuditEntry) {
  return Object.entries(entry.changes).map(([field, c]) => {
    const label =
      FIELD_LABELS[field as keyof ListingPatch] ??
      (field === "status" ? "Status" : field === "slug" ? "Endereço" : field);
    const fmt = (v: unknown) => {
      if (v === null || v === undefined) return "vazio";
      if (field === "status") return STATUS_LABELS[v as keyof typeof STATUS_LABELS] ?? show(v);
      if (field === "priceCents") return formatPrice(Number(v));
      if (field === "km") return formatKm(Number(v));
      return show(v);
    };
    return `${label}: ${fmt(c.from)} → ${fmt(c.to)}`;
  });
}

async function ListingView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const sql = db();
  const listing = await getAdminListing(sql, id);
  if (!listing) notFound();
  const history = await listingHistory(sql, id);
  const isPublic = ["active", "sold", "expired"].includes(listing.status);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/anuncios"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Anúncios
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Volvo {getModel(listing.modelId)?.name ?? listing.modelId} {listing.yearModel ?? ""}
        </h1>
        <StatusBadge status={listing.status} />
        <span className="font-mono text-sm text-muted-foreground">{listing.shortId}</span>
        {isPublic && (
          <a
            href={`/anuncio/${listing.slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver no site <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        {listing.status === "pending_review" && (
          <Link
            href={`/admin/moderacao/${listing.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Moderar
          </Link>
        )}
      </div>
      {listing.reviewNote && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
          Motivo registrado: {listing.reviewNote}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="dados" className="flex flex-col gap-3">
          <h2 id="dados" className="font-semibold">
            Dados
          </h2>
          <ListingEditForm
            key={listing.updatedAt.toISOString()}
            values={formValues(listing)}
            options={listingFormOptions(listing)}
            from="anuncios"
            canApprove={false}
          />
        </section>
        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="status"
            className="flex flex-col gap-3 rounded-xl border border-border p-4"
          >
            <h2 id="status" className="font-semibold">
              Status
            </h2>
            <StatusForm
              key={listing.status}
              id={listing.id}
              status={listing.status}
              statuses={ADMIN_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
            <p className="text-xs text-muted-foreground">
              &quot;Removido&quot; é o pedido do vendedor: o carro não volta nem se for postado de
              novo. &quot;Rejeitado&quot; volta para a moderação numa repostagem.
            </p>
          </section>
          <AuthorizationSection listing={listing} from="anuncios" />
          <ListingPhotosPanel listingId={listing.id} />
          <PostPanel listing={listing} />
          <section aria-labelledby="historico" className="flex flex-col gap-2">
            <h2 id="historico" className="font-semibold">
              Histórico
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {history.map((h, i) => (
                  <li key={i} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.at)} ·{" "}
                      {h.actor.replace(/^admin:/, "").replace(/^system:/, "sistema: ")}
                    </p>
                    <p className="font-medium">{ACTIONS[h.action] ?? h.action}</p>
                    <ul className="text-muted-foreground">
                      {changeLines(h).map((line) => (
                        <li key={line} className="break-words">
                          {line}
                        </li>
                      ))}
                    </ul>
                    {h.note && <p className="text-muted-foreground">Motivo: {h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
