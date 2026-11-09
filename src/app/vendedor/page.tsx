import { CircleCheck, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { formatDateTime } from "@/components/admin/bits";
import { MarkSoldForm } from "@/components/seller/mark-sold-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SELLER_TERMS_VERSION } from "@/content/seller-terms";
import { planName, PLANS } from "@/lib/billing/plans";
import { db } from "@/lib/db/client";
import { formatPrice } from "@/lib/listings/format";
import { requireSellerUser } from "@/lib/sellers/auth";
import {
  getSellerByAuthUser,
  sellerClaims,
  sellerListingLeads,
  sellerListings,
  type SellerListing,
} from "@/lib/sellers/data";
import { site } from "@/lib/site";

import { signOutSeller } from "./auth-actions";

export const metadata: Metadata = { title: "Painel do vendedor", robots: { index: false } };

export default function SellerPanelPage(props: PageProps<"/vendedor">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <PanelView searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const STATUS: Record<string, string> = {
  active: "No ar",
  sold: "Vendido",
  expired: "Expirado",
  removed: "Removido",
  pending_review: "Em revisão",
  rejected: "Fora do ar",
};
const CHANNEL = { whatsapp: "WhatsApp", instagram: "Instagram" } as const;
const OUTCOME = { unknown: "", sold_via_site: "comprou", not_sold: "não comprou" } as const;
const CLAIM = {
  pending: "Aguardando o código",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
} as const;

async function PanelView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSellerUser("/vendedor");
  const { vendido } = await searchParams;
  const sql = db();
  const seller = await getSellerByAuthUser(sql, user.authUserId);
  const [listings, claims] = seller
    ? await Promise.all([sellerListings(sql, seller.id), sellerClaims(sql, seller.id)])
    : [[], []];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {seller?.displayName ?? "Painel do vendedor"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user.email}
            {seller?.verifiedVia && " · vendedor verificado"}
          </p>
        </div>
        <form action={signOutSeller}>
          <Button type="submit" variant="ghost" size="sm" className="rounded-lg">
            <LogOut aria-hidden />
            Sair
          </Button>
        </form>
      </div>

      {vendido === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-secondary p-4 text-sm">
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
          Anúncio marcado como vendido. Parabéns pela venda!
        </p>
      )}

      <section aria-labelledby="anuncios" className="flex flex-col gap-3">
        <h2 id="anuncios" className="text-lg font-semibold">
          Seus anúncios
        </h2>
        {listings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum anúncio confirmado ainda. Encontre o seu na{" "}
            <Link href="/busca" className="font-medium text-primary hover:underline">
              busca
            </Link>{" "}
            e use &quot;Este anúncio é seu? Reivindicar&quot; na página dele.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {listings.map((l) => (
              <li key={l.id}>
                <ListingPanel sellerId={seller!.id} listing={l} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {claims.length > 0 && (
        <section aria-labelledby="reivindicacoes" className="flex flex-col gap-3">
          <h2 id="reivindicacoes" className="text-lg font-semibold">
            Reivindicações
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/anuncio/${c.listingSlug}`}
                    className="font-medium hover:text-primary"
                  >
                    Volvo {c.listingTitle}
                  </Link>
                  <Badge variant="outline">{CLAIM[c.status]}</Badge>
                </div>
                {c.status === "pending" && (
                  <p className="text-muted-foreground">
                    Mande o código <strong className="font-mono">{c.code}</strong> pelo Direct do
                    Instagram do anúncio para @{site.instagramHandle}.
                  </p>
                )}
                {c.status === "rejected" && c.decisionNote && (
                  <p className="text-muted-foreground">Motivo: {c.decisionNote}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {seller && (
        <section aria-labelledby="plano" className="flex flex-col gap-3">
          <h2 id="plano" className="text-lg font-semibold">
            Seu plano: {planName(seller.plan)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm"
                aria-current={plan.id === seller.plan ? "true" : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{plan.name}</span>
                  {plan.id === seller.plan ? (
                    <Badge variant="outline">Atual</Badge>
                  ) : (
                    !plan.available && <Badge variant="outline">Em breve</Badge>
                  )}
                </div>
                <span className="text-muted-foreground">{plan.price}</span>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        {seller?.termsVersionAccepted
          ? `Você aceitou os Termos do Anunciante (versão ${seller.termsVersionAccepted}).`
          : "Você ainda não aceitou os Termos do Anunciante."}{" "}
        {seller?.termsVersionAccepted && seller.termsVersionAccepted !== SELLER_TERMS_VERSION
          ? "Há uma versão nova para aceitar na próxima reivindicação. "
          : ""}
        <Link href="/termos-do-anunciante" className="font-medium text-primary hover:underline">
          Ler os termos
        </Link>
      </p>
    </>
  );
}

async function ListingPanel({ sellerId, listing }: { sellerId: string; listing: SellerListing }) {
  const leads = await sellerListingLeads(db(), { sellerId, listingId: listing.id });
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <Link href={`/anuncio/${listing.slug}`} className="font-medium hover:text-primary">
            Volvo {listing.title}
          </Link>
          <span className="text-sm text-muted-foreground">
            {formatPrice(listing.priceCents)} · código {listing.shortId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{STATUS[listing.status] ?? listing.status}</Badge>
          <Link
            href={`/vendedor/anuncios/${listing.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Editar dados e fotos
          </Link>
        </div>
      </div>
      <dl className="flex gap-6 text-sm">
        <div>
          <dt className="text-muted-foreground">Visitas (30 dias)</dt>
          <dd className="text-lg font-semibold tabular-nums">{listing.views30d}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contatos</dt>
          <dd className="text-lg font-semibold tabular-nums">{listing.leads}</dd>
        </div>
      </dl>
      {leads.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Ver contatos</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Cada mensagem que chega pelo site termina com o código do contato. Não mostramos dados
            de quem clicou.
          </p>
          <table className="mt-2 w-full text-left">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Data</th>
                <th className="py-1 font-medium">Canal</th>
                <th className="py-1 font-medium">Código</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody>
              {leads.map((ld) => (
                <tr key={ld.refCode} className="border-t border-border">
                  <td className="py-1">{formatDateTime(ld.createdAt)}</td>
                  <td className="py-1">{CHANNEL[ld.channel]}</td>
                  <td className="py-1 font-mono">{ld.refCode}</td>
                  <td className="py-1 text-muted-foreground">{OUTCOME[ld.outcome]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {listing.status === "active" && (
        <MarkSoldForm listingId={listing.id} refs={leads.map((ld) => ld.refCode)} />
      )}
      {listing.status === "sold" && listing.soldViaSite !== null && (
        <p className="text-sm text-muted-foreground">
          {listing.soldViaSite
            ? "Vendido para alguém que chegou pelo site."
            : "Vendido por outro caminho."}
        </p>
      )}
    </article>
  );
}
