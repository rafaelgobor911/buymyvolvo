import Link from "next/link";

import { SearchBox } from "@/components/search/search-box";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="text-muted-foreground">
        O anúncio pode ter sido vendido ou removido pelo vendedor. Que tal buscar outro?
      </p>
      <SearchBox size="md" />
      <Link
        href="/"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
