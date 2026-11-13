export const FUELS = ["gasolina", "diesel", "hibrido_leve", "hibrido_plugin", "eletrico"] as const;
export type Fuel = (typeof FUELS)[number];

export const PLATFORMS = ["P80", "P1", "P2", "P3", "SPA", "SPA2", "CMA", "SEA"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TRANSMISSIONS = ["manual", "automatico"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const SELLER_TYPES = ["loja", "particular", "desconhecido"] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

export type BodyType = "sedan" | "perua" | "hatch" | "suv" | "cupe" | "conversivel";

export interface Generation {
  id: string;
  name: string;
  /** Model years (ano-modelo), inclusive. `null` = still in production. */
  yearStart: number;
  yearEnd: number | null;
  platform: Platform | null;
  /** `false` = never sold officially in Brazil (still recognized by search). */
  brazil?: false;
  review?: string;
}

export interface ModelDef {
  id: string;
  name: string;
  bodyTypes: BodyType[];
  /** Extra spellings. The normalized name (e.g. "xc60") is always an alias. */
  aliases: string[];
  generations: Generation[];
  /**
   * Variant of another model (e.g. V40 Cross Country → V40). Searching the
   * parent also returns the variant; searching the variant returns only it.
   */
  parentId?: string;
  /** Renamed model (EX40 ← XC40 Recharge Pure Electric). See parse-query. */
  renamedFrom?: { modelId: string; scope: "all" | "electric" };
  /** `false` = never sold officially in Brazil (still recognized by search). */
  brazil?: false;
  review?: string;
}

/** Where and when an engine was offered in Brazil. */
export interface BrazilOffer {
  modelIds: string[];
  yearStart: number;
  yearEnd: number | null;
}

export interface EngineDef {
  id: string;
  name: string;
  fuels: Fuel[];
  platforms: Platform[];
  /** Restricts the engine to specific models (e.g. T-5R only on the 850). */
  modelIds?: string[];
  yearStart: number;
  yearEnd: number | null;
  aliases: string[];
  /**
   * Brazilian market: `false` = never sold here; a list = only these
   * models/years (variants count as their parent model); absent = no restriction.
   */
  brazil?: false | BrazilOffer[];
  review?: string;
}

export interface TrimDef {
  id: string;
  name: string;
  yearStart: number;
  yearEnd: number | null;
  modelIds?: string[];
  engineIds?: string[];
  aliases: string[];
  /**
   * Variant of another trim (Ultimate Dark → Ultimate). Searching the parent
   * also returns the variant; searching the variant returns only it.
   */
  parentId?: string;
  /** `false` = never sold officially in Brazil (still recognized by search). */
  brazil?: false;
  review?: string;
}

export const FUEL_LABELS: Record<Fuel, string> = {
  gasolina: "Gasolina",
  diesel: "Diesel",
  hibrido_leve: "Híbrido leve",
  hibrido_plugin: "Híbrido plug-in",
  eletrico: "Elétrico",
};

/** Body types in running text ("SUV", "sedã"). */
export const BODY_LABELS: Record<BodyType, string> = {
  sedan: "sedã",
  perua: "perua",
  hatch: "hatch",
  suv: "SUV",
  cupe: "cupê",
  conversivel: "conversível",
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  manual: "Manual",
  automatico: "Automático",
};

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  loja: "Loja",
  particular: "Particular",
  desconhecido: "Não informado",
};
