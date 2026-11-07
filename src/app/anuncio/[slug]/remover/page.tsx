import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Remover anúncio",
  robots: { index: false },
};

export default function RemoveListingPage(props: PageProps<"/anuncio/[slug]/remover">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Remover anúncio</h1>
      <p className="text-muted-foreground">
        Se este anúncio foi publicado por você, ele pode ser removido sem cadastro. O anúncio sai do
        ar na hora e o pedido é confirmado pela nossa equipe em até 48 horas. Depois disso, o post
        entra numa lista de bloqueio e não volta a ser importado.
      </p>
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        O formulário de remoção é implementado na Fase 6.
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
