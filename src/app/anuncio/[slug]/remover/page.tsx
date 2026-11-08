import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { listingTitle } from "@/components/listing-card";
import { RemovalForm } from "@/components/removal-form";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPlace, formatYears } from "@/lib/listings/format";
import { getListingBySlug } from "@/lib/listings/queries";
import { REMOVAL_REASONS } from "@/lib/removals/create";

export const metadata: Metadata = {
  title: "Remover anúncio",
  robots: { index: false },
};

export default function RemoveListingPage(props: PageProps<"/anuncio/[slug]/remover">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Remover anúncio</h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <RemoveView params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function RemoveView({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [{ slug }, { enviado }] = await Promise.all([params, searchParams]);

  if (enviado === "1") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="flex items-start gap-2 rounded-xl bg-secondary p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            Pronto: o anúncio saiu do ar. Nossa equipe confirma o pedido em até 48 horas; depois
            disso o post entra numa lista de bloqueio e não volta a ser importado.
          </span>
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir para o início
        </Link>
      </div>
    );
  }

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

  return (
    <>
      <p className="text-muted-foreground">
        Se este anúncio foi publicado por você, ele pode ser removido sem cadastro. O anúncio sai do
        ar na hora e o pedido é confirmado pela nossa equipe em até 48 horas. Depois disso, o post
        entra numa lista de bloqueio e não volta a ser importado.
      </p>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-medium">
          Volvo {listingTitle(listing)} {formatYears(listing.yearFab, listing.yearModel)}
        </p>
        <p className="text-sm text-muted-foreground">{formatPlace(listing.city, listing.uf)}</p>
      </div>
      <RemovalForm slug={listing.slug} reasons={REMOVAL_REASONS} />
      <p className="text-sm text-muted-foreground">
        Prefere ficar com o anúncio e cuidar dele aqui?{" "}
        <Link
          href={`/anuncio/${listing.slug}/reivindicar`}
          className="font-medium text-primary hover:underline"
        >
          Reivindique o anúncio
        </Link>
        .
      </p>
      <Link
        href={`/anuncio/${listing.slug}`}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar ao anúncio
      </Link>
    </>
  );
}
