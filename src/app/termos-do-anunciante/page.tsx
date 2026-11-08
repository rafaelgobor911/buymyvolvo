import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";

import { SELLER_TERMS, SELLER_TERMS_VERSION } from "@/content/seller-terms";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: SELLER_TERMS.title,
  // Draft: kept out of search engines until reviewed.
  robots: { index: false },
};

const withSite = (text: string) => text.replaceAll("[NOME_DO_SITE]", site.name);

export default function SellerTermsPage() {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{SELLER_TERMS.title}</h1>
        <p className="text-sm text-muted-foreground">Versão {SELLER_TERMS_VERSION}</p>
      </header>
      <p
        role="note"
        className="flex gap-2 rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm text-warning-foreground"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {SELLER_TERMS.draftNotice}
      </p>
      {SELLER_TERMS.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.paragraphs.map((p) => (
            <p key={p} className="text-pretty text-muted-foreground">
              {withSite(p)}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
