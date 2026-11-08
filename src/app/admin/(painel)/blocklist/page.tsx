import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, formatDateTime, PageTitle } from "@/components/admin/bits";
import { AddBlockForm } from "@/components/admin/ops-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/admin/auth";
import { BLOCK_KIND_LABELS, BLOCK_KINDS, listBlocklist } from "@/lib/admin/blocklist";
import { db } from "@/lib/db/client";

import { removeBlockAction } from "../ops-actions";

export const metadata: Metadata = { title: "Blocklist" };

export default function BlocklistPage(props: PageProps<"/admin/blocklist">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <BlocklistView searchParams={props.searchParams} />
    </Suspense>
  );
}

async function BlocklistView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 80) : "";
  const entries = await listBlocklist(db(), query);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Blocklist" />
      <p className="text-sm text-muted-foreground">
        A coleta ignora posts, telefones e @ desta lista. Tirar um item permite que ele volte na
        próxima coleta.
      </p>
      <section
        aria-labelledby="bloquear"
        className="flex flex-col gap-3 rounded-xl border border-border p-4"
      >
        <h2 id="bloquear" className="font-semibold">
          Bloquear
        </h2>
        <AddBlockForm kinds={BLOCK_KINDS.map((k) => ({ value: k, label: BLOCK_KIND_LABELS[k] }))} />
      </section>

      <form action="/admin/blocklist" role="search" className="flex max-w-md gap-2">
        <Input
          name="q"
          defaultValue={query}
          aria-label="Buscar na blocklist"
          placeholder="Buscar valor ou motivo"
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nada na blocklist{query && " com essa busca"}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Motivo</th>
                <th className="px-3 py-2 font-medium">Desde</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2">{BLOCK_KIND_LABELS[e.kind]}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.value}</td>
                  <td className="px-3 py-2">{e.reason}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={removeBlockAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <Button type="submit" variant="ghost" size="sm" className="rounded-lg">
                        Desbloquear
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
