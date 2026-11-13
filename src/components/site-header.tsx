import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex h-11 items-center text-[0.95rem] font-semibold tracking-tight text-foreground"
          aria-label={`${site.name}: página inicial`}
        >
          {site.name}
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/anunciar"
            className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:h-9"
          >
            Anuncie seu Volvo
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
