import { CheckCircle2, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthorizeForm, DeclineInviteForm } from "@/components/authorize-form";
import { Skeleton } from "@/components/ui/skeleton";
import { type InviteListing, loadInvite } from "@/lib/authorization/data";
import { formatCommission } from "@/lib/authorization/messages";
import { db } from "@/lib/db/client";
import { requireKeys, serverEnv } from "@/lib/env/server";
import { formatKm, formatPlace, formatPrice, formatYears } from "@/lib/listings/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Autorizar anúncio",
  robots: { index: false, follow: false },
};

export default function AuthorizePage(props: PageProps<"/autorizar/[codigo]">) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <AuthorizeView params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const title = (l: InviteListing) =>
  [l.modelName, l.engineName, l.trimName].filter(Boolean).join(" ") ||
  `${l.modelName} ${l.versionText ?? ""}`.trim();

const listingLabel = (l: InviteListing) =>
  [
    `Volvo ${title(l)} ${formatYears(l.yearFab, l.yearModel)}`.trim(),
    l.priceCents ? formatPrice(l.priceCents) : null,
    formatPlace(l.city, l.uf),
  ]
    .filter(Boolean)
    .join(" · ");

function Notice({ tone, children }: { tone: "ok" | "info"; children: React.ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : CircleAlert;
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl bg-secondary p-4">
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${tone === "ok" ? "text-primary" : "text-muted-foreground"}`}
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}

async function AuthorizeView({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [{ codigo }, { ok }] = await Promise.all([params, searchParams]);
  const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
  const view = await loadInvite(db(), HASH_SALT, codigo, new Date());

  if (view.kind !== "open") {
    const heading =
      view.kind === "authorized"
        ? "Anúncio autorizado"
        : view.kind === "declined"
          ? "Tudo certo"
          : "Link indisponível";
    const text =
      view.kind === "authorized"
        ? ok === "autorizado"
          ? `Obrigado! Vamos revisar e publicar o anúncio em breve. Quando um comprador se interessar, o ${site.name} fala com você pelo WhatsApp informado, com o código de referência do contato.`
          : "Este anúncio já foi autorizado. Obrigado!"
        : view.kind === "declined"
          ? "O anúncio não será divulgado. Se mudar de ideia, é só nos chamar."
          : view.kind === "expired"
            ? `Este link venceu. Peça um novo a quem enviou, pelo WhatsApp ou pelo Instagram do ${site.name}.`
            : view.kind === "unavailable"
              ? "Este anúncio não está mais disponível para autorização."
              : "Este link não é válido. Confira se ele foi copiado inteiro.";
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
        <Notice tone={view.kind === "authorized" ? "ok" : "info"}>{text}</Notice>
        <Link
          href="/"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Conhecer o {site.name}
        </Link>
      </>
    );
  }

  const { listing } = view;
  const commission = formatCommission(view.commissionCents)!;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Autorize a divulgação do seu Volvo
        </h1>
        <p className="text-muted-foreground">
          O {site.name} reúne anúncios de Volvo seminovos e leva compradores interessados até o
          vendedor. Para divulgar o seu anúncio, precisamos da sua autorização.
        </p>
      </div>

      <section
        aria-labelledby="seu-anuncio"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2 id="seu-anuncio" className="sr-only">
          Seu anúncio
        </h2>
        <p className="text-lg font-medium">
          Volvo {title(listing)} {formatYears(listing.yearFab, listing.yearModel)}
        </p>
        <p className="text-sm text-muted-foreground">
          {[
            formatPrice(listing.priceCents),
            formatKm(listing.km),
            formatPlace(listing.city, listing.uf),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {listing.summary && <p className="mt-2 text-sm text-pretty">{listing.summary}</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          Algum dado errado? Avise pela mesma conversa em que recebeu este link: corrigimos antes de
          publicar.
        </p>
      </section>

      <section aria-labelledby="como-funciona" className="flex flex-col gap-3">
        <h2 id="como-funciona" className="text-xl font-semibold">
          Como funciona
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-pretty">
          <li>
            <strong>Comissão fixa de {commission}</strong>, paga por você só se vender o carro para
            um comprador apresentado pelo {site.name}. Vendeu para outra pessoa? Não paga nada.
          </li>
          <li>
            <strong>Sem exclusividade:</strong> continue anunciando e vendendo por onde quiser.
          </li>
          <li>
            O anúncio aparece sem o seu nome, telefone ou marca. Os interessados falam com o{" "}
            {site.name}, que os apresenta a você com um código de referência (por exemplo,
            VX-7K3P9).
          </li>
          <li>
            Usamos as fotos do seu post, recortadas para tirar marcas, contatos e placas. Se tiverem
            marca d&apos;água, podemos pedir as originais.
          </li>
          <li>Seus dados e os dos compradores servem só para esta negociação, nada além disso.</li>
          <li>Você pode tirar o anúncio do ar quando quiser.</li>
        </ul>
      </section>

      <section aria-labelledby="autorizar" className="flex flex-col gap-4">
        <h2 id="autorizar" className="text-xl font-semibold">
          Autorizar
        </h2>
        <AuthorizeForm
          code={codigo}
          sellerType={view.sellerType}
          others={view.others.map((o) => ({ id: o.id, label: listingLabel(o) }))}
        />
        <DeclineInviteForm code={codigo} />
        <p className="text-xs text-muted-foreground">
          Este link vale até{" "}
          {view.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
        </p>
      </section>
    </>
  );
}
