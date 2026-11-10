import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, formatDateTime, PageTitle } from "@/components/admin/bits";
import { AddSourcesForm, SourceLocationForm } from "@/components/admin/ops-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { hashtagBudget, listSources, type SourceRow } from "@/lib/admin/sources";
import { db } from "@/lib/db/client";

import { toggleSourceAction } from "../ops-actions";

export const metadata: Metadata = { title: "Fontes" };

export default function SourcesPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <SourcesView />
    </Suspense>
  );
}

const interval = (minutes: number) =>
  minutes % 1440 === 0
    ? minutes === 1440
      ? "1 vez por dia"
      : `a cada ${minutes / 1440} dias`
    : minutes % 60 === 0
      ? `a cada ${minutes / 60} h`
      : `a cada ${minutes} min`;

function SourceTable({
  rows,
  withLocation = false,
}: {
  rows: SourceRow[];
  withLocation?: boolean;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhuma cadastrada.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className={`w-full text-sm ${withLocation ? "min-w-[62rem]" : "min-w-[44rem]"}`}>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Fonte</th>
            <th className="px-3 py-2 font-medium">Leitura</th>
            <th className="px-3 py-2 font-medium">Última</th>
            <th className="px-3 py-2 font-medium">Posts</th>
            <th className="px-3 py-2 font-medium">No ar</th>
            {withLocation && <th className="px-3 py-2 font-medium">Local padrão</th>}
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-border align-top">
              <td className="px-3 py-2">
                <span className="font-medium">
                  {s.type === "ig_hashtag" ? "#" : "@"}
                  {s.handle}
                </span>
                {!s.active && (
                  <Badge variant="outline" className="ml-2">
                    pausada
                  </Badge>
                )}
                {s.igName && <p className="text-xs text-muted-foreground">{s.igName}</p>}
                {s.lastError && (
                  <p className="text-xs text-destructive">
                    {s.consecutiveFailures > 1 && `${s.consecutiveFailures} falhas seguidas: `}
                    {s.lastError}
                  </p>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{interval(s.pollIntervalMinutes)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {s.lastPolledAt ? formatDateTime(s.lastPolledAt) : "nunca"}
              </td>
              <td className="px-3 py-2 tabular-nums">{s.posts}</td>
              <td className="px-3 py-2 tabular-nums">{s.listings}</td>
              {withLocation && (
                <td className="px-3 py-2">
                  <SourceLocationForm
                    id={s.id}
                    handle={s.handle}
                    city={s.defaultCity}
                    uf={s.defaultUf}
                  />
                </td>
              )}
              <td className="px-3 py-2 text-right">
                <form action={toggleSourceAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="ativar" value={s.active ? "0" : "1"} />
                  <Button type="submit" variant="outline" size="sm" className="rounded-lg">
                    {s.active ? "Pausar" : "Retomar"}
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function SourcesView() {
  await connection();
  await requireAdmin();
  const sql = db();
  const [sources, budget] = await Promise.all([listSources(sql), hashtagBudget(sql)]);
  const accounts = sources.filter((s) => s.type === "ig_business_account");
  const hashtags = sources.filter((s) => s.type === "ig_hashtag");
  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Fontes" />
      <section aria-labelledby="contas" className="flex flex-col gap-3">
        <h2 id="contas" className="text-lg font-semibold">
          Contas de lojas ({accounts.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Local padrão: vale para os posts da loja que não dizem onde o carro está (e preenche os
          anúncios dela que estão sem local). Sem ele, o site usa só o estado do DDD do telefone.
        </p>
        <SourceTable rows={accounts} withLocation />
      </section>
      <section aria-labelledby="hashtags" className="flex flex-col gap-3">
        <h2 id="hashtags" className="text-lg font-semibold">
          Hashtags ({hashtags.length})
        </h2>
        <SourceTable rows={hashtags} />
      </section>
      <section aria-labelledby="orcamento" className="flex flex-col gap-3">
        <h2 id="orcamento" className="text-lg font-semibold">
          Orçamento de hashtags: {budget.used} de {budget.max} nos últimos 7 dias
        </h2>
        <p className="text-sm text-muted-foreground">
          A Meta permite 30 hashtags únicas por 7 dias (janela móvel). Cada vaga libera 7 dias
          depois da primeira consulta.
        </p>
        {budget.entries.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-sm">
            {budget.entries.map((e) => (
              <li key={e.hashtag} className="rounded-lg border border-border px-2 py-1">
                #{e.hashtag}{" "}
                <span className="text-muted-foreground">libera em {formatDateTime(e.freesAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section
        aria-labelledby="adicionar"
        className="flex flex-col gap-3 rounded-xl border border-border p-4"
      >
        <h2 id="adicionar" className="text-lg font-semibold">
          Adicionar
        </h2>
        <AddSourcesForm budgetLeft={Math.max(0, budget.max - budget.used)} />
      </section>
    </div>
  );
}
