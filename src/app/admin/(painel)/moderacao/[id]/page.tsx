import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, StatusBadge } from "@/components/admin/bits";
import { ModerationShortcuts, RejectForm } from "@/components/admin/listing-actions";
import { ListingEditForm } from "@/components/admin/listing-edit-form";
import { moderationReasons, PostPanel } from "@/components/admin/post-panel";
import { requireAdmin } from "@/lib/admin/auth";
import { formValues, listingFormOptions } from "@/lib/admin/form-options";
import { getAdminListing, moderationQueue, REJECT_REASONS } from "@/lib/admin/listings";
import { readSettings } from "@/lib/admin/settings";
import { db } from "@/lib/db/client";
import { getModel } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Moderação" };

const OK_MESSAGES: Record<string, string> = {
  aprovado: "Anterior aprovado e publicado.",
  rejeitado: "Anterior rejeitado.",
};

export default function ModerationItemPage(props: PageProps<"/admin/moderacao/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ItemView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ItemView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdmin();
  const [{ id }, { ok }] = await Promise.all([params, searchParams]);
  const sql = db();
  const listing = await getAdminListing(sql, id);
  if (!listing) notFound();
  const [queue, settings] = await Promise.all([moderationQueue(sql), readSettings(sql)]);
  const index = queue.findIndex((q) => q.id === id);
  const prev = index > 0 ? queue[index - 1]! : null;
  const next = index >= 0 ? (queue[index + 1] ?? null) : (queue[0] ?? null);
  const inQueue = listing.status === "pending_review";
  const reasons = moderationReasons(listing, Number(settings.publish_confidence_threshold));
  const title = `Volvo ${getModel(listing.modelId)?.name ?? listing.modelId} ${listing.yearModel ?? ""}`;

  return (
    <div className="flex flex-col gap-5">
      <ModerationShortcuts
        prevHref={prev ? `/admin/moderacao/${prev.id}` : null}
        nextHref={next ? `/admin/moderacao/${next.id}` : null}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/moderacao"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Fila ({queue.length})
        </Link>
        <nav aria-label="Navegar na fila" className="flex items-center gap-1 text-sm">
          {prev ? (
            <Link
              href={`/admin/moderacao/${prev.id}`}
              className="inline-flex items-center rounded-lg px-2 py-1 hover:bg-muted"
            >
              <ChevronLeft className="size-4" aria-hidden /> Anterior (K)
            </Link>
          ) : null}
          {index >= 0 && (
            <span className="px-2 text-muted-foreground">
              {index + 1} de {queue.length}
            </span>
          )}
          {next ? (
            <Link
              href={`/admin/moderacao/${next.id}`}
              className="inline-flex items-center rounded-lg px-2 py-1 hover:bg-muted"
            >
              Próximo (J) <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </nav>
      </div>

      {typeof ok === "string" && OK_MESSAGES[ok] && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
        >
          <CheckCircle2 className="size-4 text-primary" aria-hidden />
          {OK_MESSAGES[ok]}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <StatusBadge status={listing.status} />
        <span className="font-mono text-sm text-muted-foreground">{listing.shortId}</span>
      </div>

      {!inQueue && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
          Este anúncio não está mais na fila.{" "}
          <Link
            href={`/admin/anuncios/${listing.id}`}
            className="font-medium text-primary hover:underline"
          >
            Abrir em Anúncios
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          {reasons.length > 0 && (
            <section
              aria-labelledby="motivos"
              className="flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm"
            >
              <h2
                id="motivos"
                className="flex items-center gap-2 font-semibold text-warning-foreground"
              >
                <TriangleAlert className="size-4" aria-hidden />
                Por que está na moderação
              </h2>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}
          <PostPanel listing={listing} />
          {inQueue && (
            <section
              aria-labelledby="rejeitar"
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
            >
              <h2 id="rejeitar" className="font-semibold">
                Rejeitar
              </h2>
              <p className="text-sm text-muted-foreground">
                Some do site. Se o carro for postado de novo, volta para a fila.
              </p>
              <RejectForm id={listing.id} from="moderacao" reasons={REJECT_REASONS} />
            </section>
          )}
        </div>

        <section aria-labelledby="dados" className="flex flex-col gap-3">
          <h2 id="dados" className="font-semibold">
            Dados extraídos
          </h2>
          <ListingEditForm
            key={listing.updatedAt.toISOString()}
            values={formValues(listing)}
            options={listingFormOptions(listing)}
            from="moderacao"
            canApprove={inQueue}
          />
          <p className="text-xs text-muted-foreground">
            Atalhos: A aprova · S salva · R vai para o motivo da rejeição · J próximo · K anterior ·
            Ctrl+Enter aprova de dentro de um campo.
          </p>
        </section>
      </div>
    </div>
  );
}
