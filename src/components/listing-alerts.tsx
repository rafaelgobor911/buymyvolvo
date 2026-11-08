import { TriangleAlert } from "lucide-react";

import type { PublicAlert } from "@/lib/listings/queries";
import { cn } from "@/lib/utils";

/**
 * What the listing's own post declares, told to the buyer. Repasse and ágio get
 * a box with precautions; the other alerts are short, factual lines ("o anúncio
 * menciona: leilão"). Wording states what the post says, never a judgment.
 */
const SALE_TYPES = {
  repasse: {
    title: "Anúncio de repasse",
    text: "O próprio anúncio se descreve como repasse. Em geral, repasse é a venda do carro no estado, sem garantia e com preço abaixo do mercado: pode ser um bom negócio, mas pede cuidado redobrado.",
    tips: [
      "Faça uma vistoria cautelar e leve o carro a um mecânico de confiança antes de fechar.",
      "Consulte débitos, multas e restrições, e se o carro já foi de leilão ou teve sinistro.",
      "Confirme que quem vende é o dono ou tem procuração.",
      "Não pague sinal nem reserva antes de ver o carro e o documento.",
    ],
  },
  agio: {
    title: "Venda de ágio",
    text: "O anúncio propõe que o comprador assuma o financiamento do vendedor. Enquanto o banco não aprovar a transferência, o carro e a dívida continuam no nome de quem vende.",
    tips: [
      "Faça a transferência do financiamento diretamente com o banco.",
      "Não pague o ágio antes de o banco aprovar a transferência.",
      "Confira com o banco o saldo devedor e se há parcelas em atraso.",
    ],
  },
} as const;

const MENTIONS: Partial<Record<PublicAlert, string>> = {
  pedido_de_sinal: "pede sinal ou reserva antecipada",
  leilao: "veículo de leilão",
  sinistro: "sinistro ou recuperação de seguradora/financeira",
  documento_pendente: "documento, IPVA ou débitos pendentes",
  abaixo_do_mercado: "preço abaixo da tabela FIPE ou do mercado",
};

export function ListingAlerts({
  alerts,
  className,
}: {
  alerts: PublicAlert[];
  className?: string;
}) {
  const saleTypes = (["repasse", "agio"] as const).filter((t) => alerts.includes(t));
  const mentions = alerts.flatMap((a) => (MENTIONS[a] ? [MENTIONS[a]!] : []));
  if (saleTypes.length === 0 && mentions.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {saleTypes.map((type) => {
        const t = SALE_TYPES[type];
        return (
          <section
            key={type}
            aria-labelledby={`alerta-${type}`}
            className="flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm"
          >
            <h2
              id={`alerta-${type}`}
              className="flex items-center gap-2 font-semibold text-warning-foreground"
            >
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              {t.title}
            </h2>
            <p className="text-pretty text-foreground/90">{t.text}</p>
            <ul className="flex flex-col gap-1.5 text-foreground/90">
              {t.tips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {mentions.length > 0 && (
        <p
          role="note"
          className="flex gap-2 rounded-xl border border-warning/40 px-4 py-3 text-sm text-foreground/90"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            O anúncio menciona: <strong className="font-medium">{mentions.join("; ")}</strong>.
          </span>
        </p>
      )}
    </div>
  );
}
