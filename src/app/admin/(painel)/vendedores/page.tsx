import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, formatDateTime, PageTitle } from "@/components/admin/bits";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requireAdmin } from "@/lib/admin/auth";
import { listSellers } from "@/lib/admin/ops";
import { PLANS } from "@/lib/billing/plans";
import { db } from "@/lib/db/client";
import { SELLER_TYPE_LABELS, type SellerType } from "@/lib/taxonomy";

import { setSellerPlanAction } from "../ops-actions";

export const metadata: Metadata = { title: "Vendedores" };

export default function SellersPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <SellersView />
    </Suspense>
  );
}

const VERIFIED: Record<string, string> = {
  instagram_login: "Login com Instagram",
  whatsapp_code: "Código no WhatsApp",
  manual: "Verificação manual",
};

async function SellersView() {
  await connection();
  await requireAdmin();
  const sellers = await listSellers(db());
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Vendedores" />
      <p className="text-sm text-muted-foreground">
        Vendedores que reivindicaram anúncios. Enquanto não há cobrança, o plano é definido aqui à
        mão.
      </p>
      {sellers.length === 0 ? (
        <p className="text-muted-foreground">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Vendedor</th>
                <th className="px-3 py-2 font-medium">Verificação</th>
                <th className="px-3 py-2 font-medium">Plano</th>
                <th className="px-3 py-2 text-right font-medium">No ar</th>
                <th className="px-3 py-2 text-right font-medium">Contatos (30 dias)</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="font-medium">{s.displayName}</span>
                    <p className="text-xs text-muted-foreground">
                      {SELLER_TYPE_LABELS[s.type as SellerType] ?? s.type} · desde{" "}
                      {formatDateTime(s.createdAt).slice(0, 10)}
                    </p>
                  </td>
                  <td className="px-3 py-2">{(s.verifiedVia && VERIFIED[s.verifiedVia]) ?? "—"}</td>
                  <td className="px-3 py-2">
                    <form action={setSellerPlanAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={s.id} />
                      <NativeSelect
                        name="plano"
                        defaultValue={s.plan ?? "free"}
                        aria-label={`Plano de ${s.displayName}`}
                        size="sm"
                      >
                        {PLANS.map((p) => (
                          <NativeSelectOption key={p.id} value={p.id}>
                            {p.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Button type="submit" variant="ghost" size="sm" className="rounded-lg">
                        Salvar
                      </Button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.activeListings}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.leads30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
