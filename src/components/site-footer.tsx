import Link from "next/link";

import { CookiePreferencesButton } from "@/components/analytics/analytics";
import { MADE_BY_SWEDEN_URL } from "@/content/checklists";
import { analyticsEnabled } from "@/lib/analytics/config";
import { site } from "@/lib/site";

const LINKS = [
  { href: "/volvo", label: "Modelos" },
  { href: "/anunciar", label: "Anuncie seu Volvo" },
  { href: "/termos", label: "Termos de Uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos-do-anunciante", label: "Termos do Anunciante" },
] as const;

const linkClass =
  "rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 text-sm text-muted-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={MADE_BY_SWEDEN_URL} target="_blank" rel="noopener" className={linkClass}>
                Comunidade Made by Sweden
              </a>
            </li>
            {analyticsEnabled && (
              <li>
                <CookiePreferencesButton className={linkClass} />
              </li>
            )}
          </ul>
        </nav>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {site.name} intermedeia a venda de Volvo seminovos de lojas e particulares. Não recebe
            pagamento pelos carros.
          </p>
          <p>{site.brandDisclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
