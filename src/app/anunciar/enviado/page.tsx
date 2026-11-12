import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Anúncio enviado",
  robots: { index: false, follow: true },
};

export default function SentPage(props: PageProps<"/anunciar/enviado">) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Anúncio enviado</h1>
      <Suspense fallback={null}>
        <SentNotice searchParams={props.searchParams} />
      </Suspense>
      <Link
        href="/"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar ao início
      </Link>
    </div>
  );
}

async function SentNotice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { fotos, falharam } = await searchParams;
  const sent = Number(fotos) || 0;
  const failed = Number(falharam) || 0;
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="flex items-start gap-2 rounded-xl bg-secondary p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span>
          Obrigado! Recebemos o seu anúncio
          {sent > 0 ? ` com ${sent} foto${sent === 1 ? "" : "s"}` : ""}. A nossa equipe vai conferir
          os dados com você pelo WhatsApp e publicar em seguida.
        </span>
      </p>
      {failed > 0 && (
        <p className="text-sm text-muted-foreground">
          {failed} foto{failed === 1 ? " não foi enviada" : "s não foram enviadas"}. Sem problema:
          você pode mandar pelo WhatsApp quando a nossa equipe falar com você.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Quando um comprador se interessar, o {site.name} apresenta você a ele com um código de
        referência.
      </p>
    </div>
  );
}
