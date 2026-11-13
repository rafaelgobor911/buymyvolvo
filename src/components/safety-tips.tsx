import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export const SAFETY_TIPS = [
  "Nunca pague sinal ou reserva antes de ver o carro pessoalmente.",
  "Desconfie de preço muito abaixo do mercado.",
  "Confira o documento e se o vendedor é o proprietário.",
  "Faça uma vistoria cautelar antes de fechar negócio.",
] as const;

export function SafetyTips({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <section
      aria-labelledby="seguranca"
      className={cn(
        "flex flex-col gap-5 rounded-2xl bg-muted p-6",
        !compact && "sm:p-10",
        className,
      )}
    >
      <h2
        id="seguranca"
        className={cn(
          "flex items-center gap-3 font-semibold tracking-tight",
          compact ? "text-lg" : "text-2xl",
        )}
      >
        <ShieldCheck className="size-6 text-primary" aria-hidden />
        Compre com segurança
      </h2>
      <ul className={cn("grid gap-3 text-muted-foreground", !compact && "sm:grid-cols-2")}>
        {SAFETY_TIPS.map((tip) => (
          <li key={tip} className="flex gap-3">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
