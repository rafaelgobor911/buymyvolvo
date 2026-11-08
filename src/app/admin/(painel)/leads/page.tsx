import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, PageTitle, StatusBadge } from "@/components/admin/bits";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import {
  leadsByDay,
  leadsByListing,
  leadsBySeller,
  REPORT_DAYS,
  reportDays,
} from "@/lib/admin/leads-report";
import type { AdminStatus } from "@/lib/admin/listings";
import { db } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage(props: PageProps<"/admin/leads">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <LeadsView searchParams={props.searchParams} />
    </Suspense>
  );
}

const pct = (rate: number | null) =>
  rate === null ? "—" : `${(rate * 100).toFixed(1).replace(".", ",")}%`;

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

async function LeadsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdmin();
  const { dias } = await searchParams;
  const days = reportDays(dias);
  const sql = db();
  const [byDay, byListing, bySeller] = await Promise.all([
    leadsByDay(sql, days),
    leadsByListing(sql, days),
    leadsBySeller(sql, days),
  ]);
  const totals = byDay.reduce(
    (acc, d) => ({
      leads: acc.leads + d.leads,
      clicks: acc.clicks + d.clicks,
      views: acc.views + d.views,
    }),
    { leads: 0, clicks: 0, views: 0 },
  );
  const maxLeads = Math.max(1, ...byDay.map((d) => d.leads));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Leads">
        <a
          href={`/admin/leads/csv?dias=${days}`}
          className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-xl px-4")}
        >
          <Download aria-hidden />
          Exportar CSV
        </a>
      </PageTitle>

      <nav aria-label="Período" className="flex gap-1 text-sm">
        {REPORT_DAYS.map((d) => (
          <Link
            key={d}
            href={`/admin/leads?dias=${d}`}
            aria-current={d === days ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted",
              d === days && "bg-secondary text-foreground",
            )}
          >
            {d} dias
          </Link>
        ))}
      </nav>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Contatos", totals.leads],
          ["Cliques", totals.clicks],
          ["Visitas aos anúncios", totals.views],
          ["Taxa de contato", pct(totals.views ? totals.leads / totals.views : null)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-3 text-xs text-muted-foreground">
        Contato = clique no botão de um aparelho num anúncio (cliques repetidos em 24 h contam uma
        vez). Visitas não contam robôs. Taxa = contatos ÷ visitas.
      </p>

      <section aria-labelledby="por-anuncio" className="flex flex-col gap-3">
        <h2 id="por-anuncio" className="text-lg font-semibold">
          Por anúncio
        </h2>
        {byListing.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma visita ou contato no período.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Anúncio</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Visitas</th>
                  <th className="px-3 py-2 text-right font-medium">Contatos</th>
                  <th className="px-3 py-2 text-right font-medium">Cliques</th>
                  <th className="px-3 py-2 text-right font-medium">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {byListing.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/anuncios/${r.id}`}
                        className="font-medium hover:text-primary"
                      >
                        Volvo {r.title}
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted-foreground">{r.shortId}</span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status as AdminStatus} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.views}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.leads}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.clicks}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(r.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="por-dia" className="flex flex-col gap-3">
          <h2 id="por-dia" className="text-lg font-semibold">
            Por dia
          </h2>
          <ol className="flex flex-col gap-1 text-sm">
            {byDay.map((d) => (
              <li key={d.day} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
                <span className="text-muted-foreground tabular-nums">{dayLabel(d.day)}</span>
                <span className="h-2 rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-2 rounded-full bg-primary"
                    style={{ width: `${(d.leads / maxLeads) * 100}%` }}
                  />
                </span>
                <span className="tabular-nums">
                  {d.leads} contato(s) · {d.views} visita(s)
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="por-vendedor" className="flex flex-col gap-3">
          <h2 id="por-vendedor" className="text-lg font-semibold">
            Por vendedor
          </h2>
          {bySeller.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contato no período.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {bySeller.map((s) => (
                <li
                  key={s.sellerId ?? "none"}
                  className="flex justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span>
                    {s.name}{" "}
                    <span className="text-muted-foreground">({s.listings} anúncio(s))</span>
                  </span>
                  <span className="tabular-nums">
                    {s.leads} contato(s) · {s.clicks} clique(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
