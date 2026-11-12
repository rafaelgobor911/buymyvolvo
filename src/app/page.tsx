import { ArrowRight, MessageCircle, ScanSearch, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { JsonLd } from "@/components/json-ld";
import { ListingGrid } from "@/components/listing-card";
import { SafetyTips } from "@/components/safety-tips";
import { SearchBox } from "@/components/search/search-box";
import { Skeleton } from "@/components/ui/skeleton";
import { POPULAR_SEARCHES } from "@/content/popular";
import { formatInteger } from "@/lib/listings/format";
import { getRecentListings } from "@/lib/listings/queries";
import { websiteJsonLd } from "@/lib/seo/json-ld";
import { LANDING_ROOT } from "@/lib/seo/landing";
import { activeLandingCounts } from "@/lib/seo/queries";
import { absoluteUrl, site } from "@/lib/site";
import { getModel } from "@/lib/taxonomy";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const STEPS = [
  {
    icon: ScanSearch,
    title: "Busque do seu jeito",
    text: "Escreva como você fala: “s60 t5”, “xc40 elétrico até 200 mil”, “v40 r-design sp”.",
  },
  {
    icon: SlidersHorizontal,
    title: "Compare com calma",
    text: "Modelo, versão, ano, km, preço e cidade organizados lado a lado, de lojas e particulares.",
  },
  {
    icon: MessageCircle,
    title: "Fale com a gente",
    text: "Um toque abre o nosso WhatsApp com a mensagem pronta. Confirmamos os detalhes e fazemos a ponte com o vendedor.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={websiteJsonLd({
          name: site.name,
          url: absoluteUrl("/"),
          instagram: site.instagramHandle,
        })}
      />
      <section className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
          <div className="flex max-w-3xl flex-col gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Encontre seu próximo Volvo.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Anúncios de seminovos e usados de lojas e particulares do Brasil inteiro, reunidos em
              um só lugar.
            </p>
          </div>

          <SearchBox className="max-w-3xl" />

          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Buscas populares</p>
            <ul className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((term) => (
                <li key={term}>
                  <Link
                    href={{ pathname: "/busca", query: { q: term.toLowerCase() } }}
                    className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm text-foreground transition-colors outline-none hover:border-primary/40 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {term}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="recentes" className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 id="recentes" className="text-2xl font-semibold tracking-tight">
              Anúncios recentes
            </h2>
            <Link
              href="/busca"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Ver todos <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <Suspense fallback={<RecentSkeleton />}>
            <RecentListings />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="por-modelo" className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 id="por-modelo" className="text-2xl font-semibold tracking-tight">
              Explore por modelo
            </h2>
            <Link
              href={LANDING_ROOT}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Todos os modelos <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="h-24 rounded-2xl" />}>
            <ModelLinks />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="como-funciona" className="border-b border-border/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 id="como-funciona" className="text-2xl font-semibold tracking-tight">
            Como funciona
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex flex-col gap-3">
                <span className="flex items-center gap-3 text-sm font-medium text-primary">
                  <Icon className="size-5" aria-hidden />
                  Passo {index + 1}
                </span>
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <SafetyTips />
      </div>
    </>
  );
}

async function RecentListings() {
  await connection();
  const listings = await getRecentListings(6);
  if (listings.length === 0) {
    return <p className="text-muted-foreground">Nenhum anúncio publicado ainda.</p>;
  }
  return <ListingGrid listings={listings} now={new Date()} />;
}

/** Models with active listings, most listings first (internal links to the landing pages). */
async function ModelLinks() {
  await connection();
  const models = (await activeLandingCounts())
    .filter((c) => c.depth === 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  if (models.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {models.map((c) => (
        <li key={c.path}>
          <Link
            href={c.path}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:border-primary/40 hover:bg-accent"
          >
            <span className="font-medium">{getModel(c.modelId)?.name ?? c.modelId}</span>
            <span className="text-muted-foreground">{formatInteger(c.count)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Carregando anúncios"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  );
}
