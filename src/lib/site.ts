import { publicEnv } from "@/lib/env/public";

export const site = {
  name: publicEnv.NEXT_PUBLIC_SITE_NAME,
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  description:
    "Buscador de anúncios de Volvo seminovos e usados no Brasil, reunindo lojas e particulares em um só lugar.",
  locale: "pt-BR",
  /** Mandatory brand disclaimer (compliance rule 6). */
  brandDisclaimer: "Não afiliado à Volvo Car Corporation.",
} as const;
