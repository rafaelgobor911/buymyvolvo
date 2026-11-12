import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { IntermediationTerms } from "@/components/intermediation-terms";
import { PublicListingForm } from "@/components/public-listing-form";
import { Skeleton } from "@/components/ui/skeleton";
import { commissionCents } from "@/lib/authorization/data";
import { formatCommission } from "@/lib/authorization/messages";
import { db } from "@/lib/db/client";
import { photoStorageKind } from "@/lib/photos/storage";
import { site } from "@/lib/site";
import { publicFormOptions } from "@/lib/submissions/form";

export const metadata: Metadata = {
  title: "Anuncie seu Volvo",
  description:
    "Cadastre seu Volvo seminovo ou usado: a nossa equipe atende os interessados e apresenta os compradores a você. Comissão fixa só se vender, sem exclusividade.",
  alternates: { canonical: "/anunciar" },
};

export default function SellPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Anuncie seu Volvo
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">
          O {site.name} divulga o seu carro para quem procura Volvo, atende os interessados e
          apresenta os compradores a você.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[60rem] rounded-xl" />}>
        <SellView />
      </Suspense>
    </div>
  );
}

async function SellView() {
  await connection();
  const commission = formatCommission(await commissionCents(db()));
  if (!commission) {
    return (
      <p role="status" className="rounded-xl bg-secondary p-4">
        O cadastro de anúncios abre em breve. Enquanto isso, fale com a gente pelo Instagram{" "}
        <a
          href={`https://www.instagram.com/${site.instagramHandle}/`}
          className="font-medium text-primary underline-offset-4 hover:underline"
          rel="noopener"
        >
          @{site.instagramHandle}
        </a>
        .
      </p>
    );
  }
  return (
    <>
      <section aria-labelledby="como-funciona" className="flex flex-col gap-3">
        <h2 id="como-funciona" className="text-xl font-semibold">
          Como funciona
        </h2>
        <IntermediationTerms commission={commission} photos="upload" />
        <p className="text-sm text-muted-foreground">
          Depois do envio, a nossa equipe confere os dados com você pelo WhatsApp e publica o
          anúncio. Condições completas nos{" "}
          <Link
            href="/termos-do-anunciante"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Termos do Anunciante
          </Link>
          .
        </p>
      </section>
      <PublicListingForm
        options={publicFormOptions()}
        photosEnabled={photoStorageKind() !== null}
      />
    </>
  );
}
