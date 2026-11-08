import { BadgeCheck, CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ClaimForm } from "@/components/claim-form";
import { listingTitle } from "@/components/listing-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db/client";
import { formatPlace, formatYears } from "@/lib/listings/format";
import { getListingBySlug } from "@/lib/listings/queries";
import { currentSellerUser } from "@/lib/sellers/auth";
import { claimState, getSellerByAuthUser } from "@/lib/sellers/data";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reivindicar anúncio",
  robots: { index: false },
};

export default function ClaimListingPage(props: PageProps<"/anuncio/[slug]/reivindicar">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Reivindicar anúncio</h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <ClaimView params={props.params} />
      </Suspense>
    </div>
  );
}

const BENEFITS = [
  "Selo de vendedor verificado no anúncio.",
  "Painel com os contatos que chegam pelo site, com o código de cada um.",
  "Marcar como vendido e, na próxima etapa, editar dados e enviar suas fotos.",
];

async function ClaimView({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) {
    return (
      <p className="text-muted-foreground">
        Este anúncio não está mais no ar.{" "}
        <Link href="/busca" className="font-medium text-primary hover:underline">
          Buscar outros anúncios
        </Link>
      </p>
    );
  }
  const here = `/anuncio/${listing.slug}/reivindicar`;
  const instagram = listing.instagramUsername ?? listing.sourceUsername;

  const card = (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-medium">
        Volvo {listingTitle(listing)} {formatYears(listing.yearFab, listing.yearModel)}
      </p>
      <p className="text-sm text-muted-foreground">
        {[formatPlace(listing.city, listing.uf), instagram && `@${instagram}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );

  const user = await currentSellerUser();
  if (!user) {
    return (
      <>
        {card}
        <p className="text-muted-foreground">Ao provar que o anúncio é seu, você ganha:</p>
        <ul className="flex flex-col gap-2 text-sm">
          {BENEFITS.map((b) => (
            <li key={b} className="flex gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
        <Link
          href={`/vendedor/entrar?next=${encodeURIComponent(here)}`}
          className={cn(buttonVariants(), "h-11 self-start rounded-xl px-5 text-base")}
        >
          Entrar para reivindicar
        </Link>
        <p className="text-sm text-muted-foreground">
          Só quer tirar o anúncio do ar?{" "}
          <Link
            href={`/anuncio/${listing.slug}/remover`}
            className="font-medium text-primary hover:underline"
          >
            Remover sem cadastro
          </Link>
          .
        </p>
      </>
    );
  }

  const sql = db();
  const seller = await getSellerByAuthUser(sql, user.authUserId);
  const state = await claimState(sql, { listingId: listing.id, sellerId: seller?.id ?? null });

  if (state.kind === "mine") {
    return (
      <>
        {card}
        <p className="flex items-center gap-2 rounded-xl bg-secondary p-4">
          <BadgeCheck className="size-5 text-primary" aria-hidden />
          Este anúncio já é seu.
        </p>
        <Link href="/vendedor" className={cn(buttonVariants(), "h-11 self-start rounded-xl px-5")}>
          Ir para o painel
        </Link>
      </>
    );
  }
  if (state.kind === "other") {
    return (
      <>
        {card}
        <p className="rounded-xl bg-secondary p-4 text-sm">
          Este anúncio já foi reivindicado por outro vendedor. Se ele é seu, mande uma mensagem para{" "}
          <strong>@{site.instagramHandle}</strong> no Instagram.
        </p>
      </>
    );
  }
  if (state.kind === "pending") {
    return (
      <>
        {card}
        <section
          aria-labelledby="codigo"
          className="flex flex-col gap-3 rounded-xl border border-border p-5"
        >
          <h2 id="codigo" className="flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-primary" aria-hidden />
            Falta confirmar que o anúncio é seu
          </h2>
          <p className="text-sm text-muted-foreground">Seu código de confirmação:</p>
          <p className="font-mono text-2xl font-semibold tracking-wider">{state.claim.code}</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>
              Abra o Instagram{instagram ? ` @${instagram}` : " que publicou o anúncio"} e mande o
              código por mensagem (Direct) para <strong>@{site.instagramHandle}</strong>.
            </li>
            <li>
              Sem Instagram? Nossa equipe pode pedir o código pelo WhatsApp que está no anúncio.
            </li>
            <li>
              Assim que conferirmos, o anúncio aparece no seu painel com o selo de verificado.
            </li>
          </ol>
        </section>
        <Link href="/vendedor" className="text-sm font-medium text-primary hover:underline">
          Acompanhar no painel
        </Link>
      </>
    );
  }

  return (
    <>
      {card}
      {state.lastRejected?.decisionNote && (
        <p className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          Seu pedido anterior foi recusado: {state.lastRejected.decisionNote}
        </p>
      )}
      <p className="text-muted-foreground">
        Confirme seus dados e aceite os termos. Depois você recebe um código para mandar pelo
        Instagram do anúncio, e nossa equipe confirma.
      </p>
      <ClaimForm
        slug={listing.slug}
        defaults={{
          name: seller?.displayName ?? user.name ?? "",
          type: seller?.type ?? "particular",
          phone: seller?.phone ?? "",
        }}
      />
    </>
  );
}
