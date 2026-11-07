import { MessageCircle, ScanSearch, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const POPULAR_SEARCHES = ["XC60", "XC40", "XC90", "S60", "V40", "EX30", "XC60 T8", "C30 T5"];

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
    title: "Fale com o vendedor",
    text: "Um toque abre o WhatsApp do anunciante com a mensagem pronta. A negociação é direto com ele.",
  },
] as const;

const SAFETY_TIPS = [
  "Nunca pague sinal ou reserva antes de ver o carro pessoalmente.",
  "Desconfie de preço muito abaixo do mercado.",
  "Confira o documento e se o vendedor é o proprietário.",
  "Faça uma vistoria cautelar antes de fechar negócio.",
] as const;

export default function HomePage() {
  return (
    <>
      <section className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
          <div className="flex flex-col gap-4">
            <Badge variant="outline" className="font-normal text-muted-foreground">
              Prévia da Fase 0: a busca chega na Fase 1
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Encontre seu próximo Volvo.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Anúncios de seminovos e usados de lojas e particulares do Brasil inteiro, reunidos em
              um só lugar.
            </p>
          </div>

          <form
            action="/busca"
            method="get"
            role="search"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="q" className="sr-only">
              Buscar anúncios
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="q"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Ex.: xc60 t8 sp até 250 mil"
                className="h-12 rounded-xl pl-11 text-base md:text-base"
              />
            </div>
            <Button type="submit" className="h-12 rounded-xl px-6 text-base">
              Buscar
            </Button>
          </form>

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

      <section aria-labelledby="como-funciona" className="border-b border-border/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
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

      <section aria-labelledby="seguranca">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-6 rounded-2xl bg-muted/60 p-6 sm:p-10">
            <h2
              id="seguranca"
              className="flex items-center gap-3 text-2xl font-semibold tracking-tight"
            >
              <ShieldCheck className="size-6 text-primary" aria-hidden />
              Compre com segurança
            </h2>
            <ul className="grid gap-3 text-muted-foreground sm:grid-cols-2">
              {SAFETY_TIPS.map((tip) => (
                <li key={tip} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
