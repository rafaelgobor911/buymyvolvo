"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Início" },
  { href: "/admin/moderacao", label: "Moderação" },
  { href: "/admin/anuncios", label: "Anúncios" },
  { href: "/admin/fontes", label: "Fontes" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/reivindicacoes", label: "Reivindicações" },
  { href: "/admin/remocoes", label: "Remoções" },
  { href: "/admin/blocklist", label: "Blocklist" },
  { href: "/admin/vendedores", label: "Vendedores" },
  { href: "/admin/configuracoes", label: "Configurações" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
              active && "bg-secondary text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Same links without the active state (shown while the pathname is not known yet). */
export function AdminNavFallback() {
  return (
    <nav aria-label="Admin" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
