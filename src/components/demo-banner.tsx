import { publicEnv } from "@/lib/env/public";

export function DemoBanner() {
  if (!publicEnv.NEXT_PUBLIC_DEMO_MODE) return null;
  return (
    <div className="border-b border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="mx-auto w-full max-w-6xl px-4 py-2 text-sm sm:px-6">
        <strong className="font-medium">Prévia com anúncios fictícios.</strong> Nenhum carro, preço
        ou vendedor desta versão é real.
      </p>
    </div>
  );
}
