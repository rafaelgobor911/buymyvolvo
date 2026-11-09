import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatInteger } from "@/lib/listings/format";
import { landingPath } from "@/lib/seo/landing";
import { activeLandingCounts } from "@/lib/seo/queries";
import { modelsForSelect } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Volvo à venda por modelo",
  description:
    "Volvo seminovos e usados à venda no Brasil, organizados por modelo: XC60, XC40, XC90, S60, V40, EX30 e outros. Anúncios de lojas e particulares.",
  alternates: { canonical: "/volvo" },
};

export default function ModelsIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Volvo à venda por modelo
        </h1>
        <p className="text-lg text-muted-foreground">
          Escolha o modelo para ver os anúncios ativos, a faixa de preços pedidos e o que checar
          antes de comprar.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <ModelList />
      </Suspense>
    </div>
  );
}

async function ModelList() {
  await connection();
  const counts = new Map(
    (await activeLandingCounts()).filter((c) => c.depth === 1).map((c) => [c.modelId, c.count]),
  );
  const models = modelsForSelect();
  const withListings = models.filter(({ model }) => counts.has(model.id));
  const without = models.filter(({ model }) => !counts.has(model.id));
  const item = (id: string, name: string, isVariant: boolean) => (
    <li key={id}>
      <Link
        href={landingPath({ modelId: id })}
        className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary/40 hover:bg-accent"
      >
        <span className={isVariant ? "text-muted-foreground" : "font-medium"}>{name}</span>
        {counts.has(id) && (
          <span className="text-sm text-muted-foreground">
            {formatInteger(counts.get(id)!)} {counts.get(id) === 1 ? "anúncio" : "anúncios"}
          </span>
        )}
      </Link>
    </li>
  );
  return (
    <div className="flex flex-col gap-10">
      {withListings.length > 0 && (
        <section aria-labelledby="com-anuncios" className="flex flex-col gap-4">
          <h2 id="com-anuncios" className="text-xl font-semibold tracking-tight">
            Com anúncios agora
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withListings.map(({ model, isVariant }) => item(model.id, model.name, isVariant))}
          </ul>
        </section>
      )}
      {without.length > 0 && (
        <section aria-labelledby="outros" className="flex flex-col gap-4">
          <h2 id="outros" className="text-xl font-semibold tracking-tight">
            Outros modelos vendidos no Brasil
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {without.map(({ model, isVariant }) => item(model.id, model.name, isVariant))}
          </ul>
        </section>
      )}
    </div>
  );
}
