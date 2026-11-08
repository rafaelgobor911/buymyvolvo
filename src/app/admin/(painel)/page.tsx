import { CircleAlert, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AdminSkeleton, PageTitle } from "@/components/admin/bits";
import { requireAdmin } from "@/lib/admin/auth";
import { loadDashboard } from "@/lib/admin/dashboard";
import { db } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

export default function AdminHome() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <HomeView />
    </Suspense>
  );
}

async function HomeView() {
  await requireAdmin();
  const d = await loadDashboard(db());
  const tiles = [
    { label: "Em moderação", value: d.pending, href: "/admin/moderacao" },
    { label: "Anúncios no ar", value: d.active, href: "/admin/anuncios?status=active" },
    { label: "Novos em 24h", value: d.newToday, href: "/admin/anuncios" },
    { label: "Contatos em 7 dias", value: d.leads7d, detail: `${d.clicks7d} cliques` },
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Início" />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <dt className="text-sm text-muted-foreground">{t.label}</dt>
              <dd className="text-3xl font-semibold tabular-nums">{t.value}</dd>
              {t.detail && <dd className="text-xs text-muted-foreground">{t.detail}</dd>}
            </>
          );
          return t.href ? (
            <Link
              key={t.label}
              href={t.href}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 hover:border-primary/40"
            >
              {body}
            </Link>
          ) : (
            <div
              key={t.label}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
            >
              {body}
            </div>
          );
        })}
      </dl>

      <section aria-labelledby="alertas" className="flex flex-col gap-3">
        <h2 id="alertas" className="text-lg font-semibold">
          Alertas
        </h2>
        {d.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada pedindo atenção agora.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.alerts.map((a) => {
              const Icon = a.tone === "error" ? CircleAlert : TriangleAlert;
              const content = (
                <>
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      a.tone === "error" ? "text-destructive" : "text-warning",
                    )}
                    aria-hidden
                  />
                  <span>{a.text}</span>
                </>
              );
              return (
                <li key={a.text}>
                  {a.href ? (
                    <Link
                      href={a.href}
                      className="flex gap-2 rounded-xl border border-border px-4 py-3 text-sm hover:border-primary/40"
                    >
                      {content}
                    </Link>
                  ) : (
                    <p className="flex gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                      {content}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
