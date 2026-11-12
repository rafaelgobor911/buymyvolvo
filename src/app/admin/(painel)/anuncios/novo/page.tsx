import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, PageTitle } from "@/components/admin/bits";
import { ManualListingForm } from "@/components/admin/manual-listing-form";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Novo anúncio" };

export default function NewListingPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <NewListingView />
    </Suspense>
  );
}

async function NewListingView() {
  await connection();
  await requireAdmin();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href="/admin/anuncios"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Anúncios
      </Link>
      <PageTitle title="Novo anúncio a partir de texto" />
      <p className="text-muted-foreground">
        Para anúncios que você recebeu do vendedor ou copiou de outro site. Cole o texto e a mesma
        leitura automática dos posts do Instagram preenche os dados.
      </p>
      <ManualListingForm />
    </div>
  );
}
