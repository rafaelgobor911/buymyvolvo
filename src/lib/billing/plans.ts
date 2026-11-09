/**
 * Seller plans: structure only. No real charge in this version and no prices
 * here (business decision, "[a definir]"). A payment provider (Mercado Pago,
 * Asaas or Stripe) plugs in later through BillingProvider.
 */
export const PLAN_IDS = ["free", "destaque", "loja_pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  features: string[];
  available: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuito",
    price: "Grátis",
    features: [
      "Selo de vendedor verificado",
      "Até 15 fotos e descrição própria",
      "Painel com os contatos que chegam pelo site",
    ],
    available: true,
  },
  {
    id: "destaque",
    name: "Destaque",
    price: "[a definir]",
    features: ["Tudo do Gratuito", "Mais visibilidade nas buscas (benefícios a definir)"],
    available: false,
  },
  {
    id: "loja_pro",
    name: "Loja Pro",
    price: "[a definir]",
    features: ["Tudo do Destaque", "Para lojas com vários anúncios (benefícios a definir)"],
    available: false,
  },
];

export const planName = (id: string | null | undefined) =>
  PLANS.find((p) => p.id === id)?.name ?? "Gratuito";

/** What a payment provider must offer. Nothing implements real charges yet. */
export interface BillingProvider {
  readonly name: string;
  startCheckout(input: { sellerId: string; plan: PlanId }): Promise<{ checkoutUrl: string }>;
  cancel(input: { sellerId: string }): Promise<void>;
}

export class BillingUnavailableError extends Error {
  constructor() {
    super("A contratação de planos ainda não está disponível.");
  }
}

/** Placeholder until a provider is chosen: every call says plans are not for sale yet. */
export const noBilling: BillingProvider = {
  name: "none",
  startCheckout: async () => {
    throw new BillingUnavailableError();
  },
  cancel: async () => {
    throw new BillingUnavailableError();
  },
};
