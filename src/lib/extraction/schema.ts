import { z } from "zod";

import { FUELS } from "@/lib/taxonomy";

export const RED_FLAGS = [
  "abaixo_do_mercado",
  "repasse",
  "pedido_de_sinal",
  "documento_pendente",
  "leilao",
  "sinistro",
  "sem_contato",
] as const;
export type RedFlag = (typeof RED_FLAGS)[number];

export const RED_FLAG_LABELS: Record<RedFlag, string> = {
  abaixo_do_mercado: "Preço anunciado como muito abaixo do mercado/FIPE",
  repasse: "Repasse",
  pedido_de_sinal: "Pede sinal ou reserva antecipada",
  documento_pendente: "Documento, IPVA ou débitos pendentes",
  leilao: "Veículo de leilão",
  sinistro: "Sinistro ou recuperado de financiamento/seguradora",
  sem_contato: "Sem forma de contato no post",
};

/**
 * What the model returns. Values are as published in the post; deterministic
 * normalization (normalize.ts) turns them into database fields and checks them
 * against the taxonomy. `*_text` fields carry the snippet exactly as written so
 * normalization can re-parse numbers like "189k" or "58mil".
 */
export const ExtractionSchema = z.object({
  is_vehicle_for_sale: z
    .boolean()
    .describe("true only if the post offers one specific Volvo car for sale"),
  confidence: z.number().describe("0 to 1: how sure you are about the extracted fields"),
  model: z.string().nullable().describe('Volvo model as written, e.g. "XC60", "V40 Cross Country"'),
  engine: z
    .string()
    .nullable()
    .describe('Engine/powertrain code, e.g. "T5", "T8", "D5", "Twin Motor"'),
  trim: z
    .string()
    .nullable()
    .describe('Trim level, e.g. "Momentum", "R-Design", "Polestar Engineered"'),
  version_text: z
    .string()
    .nullable()
    .describe('Full version as written, e.g. "T5 Momentum 2.0 Drive-E"'),
  year_fab: z.number().int().nullable(),
  year_model: z.number().int().nullable(),
  km: z.number().int().nullable(),
  km_text: z.string().nullable().describe('Mileage snippet as written, e.g. "58mil km"'),
  price: z.number().nullable().describe("Asking price in BRL (reais, not cents)"),
  price_text: z
    .string()
    .nullable()
    .describe('Price snippet as written, e.g. "R$ 189.900,00", "189k"'),
  city: z.string().nullable(),
  uf: z.string().nullable().describe("Brazilian state code, e.g. SP"),
  color: z.string().nullable().describe("Color in Portuguese, lowercase"),
  transmission: z.enum(["manual", "automatico"]).nullable(),
  fuel: z.enum(FUELS).nullable(),
  options: z.array(z.string()).describe("Notable options in short Portuguese phrases"),
  seller_type: z.enum(["loja", "particular", "desconhecido"]),
  phones: z.array(z.string()).describe("Phone/WhatsApp numbers exactly as written in the post"),
  summary_ptbr: z
    .string()
    .describe(
      "2-3 sentences in Brazilian Portuguese, in YOUR OWN WORDS; never copy phrases from the caption; no phone numbers, @handles or prices",
    ),
  red_flags: z.array(z.enum(RED_FLAGS)),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
