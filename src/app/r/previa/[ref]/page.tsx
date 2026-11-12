import { ArrowLeft, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db/client";
import { leadPreview } from "@/lib/leads/record";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Prévia do contato",
  robots: { index: false, follow: false },
};

/**
 * Demo listings (DDD 20) have no real WhatsApp: the click lands here and shows
 * the message the seller would receive. Real listings never reach this page.
 */
export default function LeadPreviewPage(props: PageProps<"/r/previa/[ref]">) {
  return (
    <Suspense fallback={<PreviewSkeleton />}>
      <PreviewView params={props.params} />
    </Suspense>
  );
}

async function PreviewView({ params }: { params: Promise<{ ref: string }> }) {
  await connection();
  const { ref } = await params;
  const preview = await leadPreview(db(), decodeURIComponent(ref), {
    name: site.name,
    url: site.url,
  });
  if (!preview) notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Prévia do contato</h1>
        <p className="text-pretty text-muted-foreground">
          Este contato é de demonstração ({preview.title}). Com um anúncio real, o clique abre o
          WhatsApp do {site.name} com esta mensagem já escrita:
        </p>
      </div>

      <figure className="flex flex-col gap-2">
        <blockquote className="flex gap-3 rounded-2xl rounded-tl-sm border border-border bg-card p-4 text-pretty">
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>{preview.message}</p>
        </blockquote>
        <figcaption className="text-sm text-muted-foreground">
          Código do contato:{" "}
          <strong className="font-medium text-foreground">{preview.refCode}</strong>
          {preview.clickCount > 1 && ` · ${preview.clickCount} cliques deste aparelho`}
        </figcaption>
      </figure>

      <p className="text-sm text-pretty text-muted-foreground">
        O código identifica o anúncio e o contato na conversa com a nossa equipe. Não guardamos
        nenhum dado seu neste clique.
      </p>

      <Link
        href={`/anuncio/${preview.slug}`}
        className={cn(buttonVariants({ variant: "outline" }), "h-11 self-start rounded-xl px-4")}
      >
        <ArrowLeft aria-hidden />
        Voltar ao anúncio
      </Link>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10 sm:px-6"
      aria-busy="true"
    >
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  );
}
