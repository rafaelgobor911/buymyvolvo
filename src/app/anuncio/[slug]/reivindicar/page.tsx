import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Reivindicar anúncio",
  robots: { index: false },
};

export default function ClaimListingPage(props: PageProps<"/anuncio/[slug]/reivindicar">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Reivindicar anúncio</h1>
      <p className="text-muted-foreground">
        Ao provar que o anúncio é seu, você ganha o anúncio completo, com suas fotos, painel de
        contatos recebidos e o selo de vendedor verificado. A comprovação poderá ser feita com login
        do Instagram (contas profissionais) ou pela nossa equipe.
      </p>
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        A reivindicação e o painel do vendedor são implementados na Fase 6.
      </p>
      <Suspense>
        <BackLink params={props.params} />
      </Suspense>
    </div>
  );
}

async function BackLink({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Link
      href={`/anuncio/${slug}`}
      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      Voltar ao anúncio
    </Link>
  );
}
