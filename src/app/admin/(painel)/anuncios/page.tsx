import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, PageTitle, StatusBadge } from "@/components/admin/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requireAdmin } from "@/lib/admin/auth";
import {
  ADMIN_PAGE_SIZE,
  ADMIN_STATUSES,
  type AdminStatus,
  searchAdminListings,
  STATUS_LABELS,
} from "@/lib/admin/listings";
import { db } from "@/lib/db/client";
import { formatPlace, formatPrice } from "@/lib/listings/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Anúncios" };

export default function AdminListingsPage(props: PageProps<"/admin/anuncios">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ListingsView searchParams={props.searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function ListingsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdmin();
  const params = await searchParams;
  const q = one(params.q)?.slice(0, 80) ?? "";
  const rawStatus = one(params.status);
  const status = ADMIN_STATUSES.includes(rawStatus as AdminStatus)
    ? (rawStatus as AdminStatus)
    : null;
  const page = Math.max(1, Number(one(params.pagina)) || 1);
  const { items, total } = await searchAdminListings(db(), { q, status, page });
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (p > 1) sp.set("pagina", String(p));
    const s = sp.toString();
    return `/admin/anuncios${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Anúncios">
        <Link href="/admin/anuncios/novo" className={cn(buttonVariants(), "h-10 rounded-xl px-4")}>
          Novo anúncio a partir de texto
        </Link>
      </PageTitle>
      <form action="/admin/anuncios" className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="a-q" className="text-sm font-medium">
            Buscar
          </label>
          <Input
            id="a-q"
            name="q"
            defaultValue={q}
            placeholder="Código, modelo, cidade ou telefone"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="a-status" className="text-sm font-medium">
            Status
          </label>
          <NativeSelect id="a-status" name="status" defaultValue={status ?? ""}>
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {ADMIN_STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STATUS_LABELS[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{total} anúncio(s)</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Anúncio</th>
              <th className="px-3 py-2 font-medium">Preço</th>
              <th className="px-3 py-2 font-medium">Local</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{item.shortId}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/anuncios/${item.id}`}
                    className="font-medium hover:text-primary"
                  >
                    Volvo {item.title} {item.yearModel ?? ""}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatPrice(item.priceCents)}</td>
                <td className="px-3 py-2">{formatPlace(item.city, item.uf) || "—"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href(page - 1)} className="text-primary hover:underline">
              Anterior
            </Link>
          )}
          <span className="text-muted-foreground">
            Página {page} de {pages}
          </span>
          {page < pages && (
            <Link href={href(page + 1)} className="text-primary hover:underline">
              Próxima
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
