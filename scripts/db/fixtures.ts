/**
 * ~60 FICTITIOUS listings for development and previews (never production).
 *
 * - No photos and no links to real Instagram posts or profiles.
 * - Phones use DDD 20, which does not exist in Brazil, so no test can ever
 *   reach a real person on WhatsApp.
 * - Prices are invented for demo purposes; they are NOT market data.
 *
 * Several rows exist on purpose to exercise the acceptance searches
 * (e.g. "s60 t5" must not return S60 T4 or V60 T5). Every row uses only
 * models, engines and trims sold in Brazil (owner review, 2026-11-07).
 */
import type { RedFlag } from "@/lib/extraction/schema";
import type { Fuel, Transmission } from "@/lib/taxonomy";

export interface FixtureSeller {
  key: string;
  displayName: string;
  type: "loja" | "particular";
}

export const FIXTURE_SELLERS: FixtureSeller[] = [
  { key: "cwb", displayName: "Loja Demo Curitiba", type: "loja" },
  { key: "sp", displayName: "Loja Demo São Paulo", type: "loja" },
  { key: "poa", displayName: "Loja Demo Porto Alegre", type: "loja" },
];

type Status = "active" | "pending_review" | "sold" | "expired" | "removed";

export interface FixtureListing {
  model: string;
  engine: string | null;
  trim: string | null;
  yearFab: number;
  yearModel: number;
  km: number;
  price: number;
  city: string;
  uf: string;
  sellerType: "loja" | "particular";
  color: string;
  transmission: Transmission;
  fuel: Fuel;
  options: string[];
  daysAgo: number;
  versionText?: string;
  status?: Status;
  seller?: string;
  origin?: "instagram" | "direct";
  /** Alerts the (fictitious) post declares: repasse, ágio, leilão... */
  redFlags?: RedFlag[];
  /**
   * Fictitious source post for listings waiting in moderation: the caption
   * (`{telefone}` becomes the listing's DDD 20 phone) and why it was held.
   */
  post?: FixturePost;
}

export interface FixturePost {
  caption: string;
  confidence: number;
  issues: { code: string; message: string }[];
}

type Row = [
  model: string,
  engine: string | null,
  trim: string | null,
  yearFab: number,
  yearModel: number,
  km: number,
  price: number,
  city: string,
  uf: string,
  sellerType: "loja" | "particular",
  color: string,
  transmission: Transmission,
  fuel: Fuel,
  options: string[],
  daysAgo: number,
  extra?: Partial<
    Pick<FixtureListing, "versionText" | "status" | "seller" | "origin" | "redFlags" | "post">
  >,
];

const A = "automatico";
const M = "manual";

// prettier-ignore
const ROWS: Row[] = [
  // S60 / V60 (the "s60 t5" acceptance case)
  ["s60", "t5", "momentum", 2018, 2019, 48_000, 165_000, "São Paulo", "SP", "loja", "prata", A, "gasolina", ["teto solar", "piloto automático adaptativo"], 2],
  ["s60", "t5", "r-design", 2019, 2020, 35_000, 185_000, "Campinas", "SP", "particular", "preto", A, "gasolina", ["som Harman Kardon", "câmera de ré"], 5],
  ["s60", "t5", "dynamic", 2015, 2016, 72_000, 95_000, "Curitiba", "PR", "loja", "branco", A, "gasolina", ["bancos em couro"], 8, { seller: "cwb" }],
  ["s60", "t4", null, 2013, 2014, 88_000, 72_000, "Belo Horizonte", "MG", "particular", "cinza", A, "gasolina", [], 12, { versionText: "T4 1.6" }],
  ["s60", "t8", "polestar-engineered", 2020, 2021, 22_000, 270_000, "São Paulo", "SP", "loja", "branco", A, "hibrido_plugin", ["freios Brembo", "suspensão Öhlins", "som Bowers & Wilkins"], 3, { seller: "sp" }],
  ["s60", "t5", "r-design", 2012, 2013, 98_000, 82_000, "Porto Alegre", "RS", "particular", "azul", A, "gasolina", ["teto solar"], 20],
  ["s60", "t6", "r-design", 2014, 2015, 81_000, 99_000, "Florianópolis", "SC", "particular", "azul", A, "gasolina", ["tração integral", "rodas aro 19"], 6],
  ["s60", null, "r", 2004, 2005, 140_000, 58_000, "São Paulo", "SP", "particular", "prata", A, "gasolina", ["tração integral"], 15, { versionText: "R 2.5T AWD", redFlags: ["leilao"] }],
  ["s60", "t5", "momentum", 2018, 2019, 61_000, 159_000, "Curitiba", "PR", "loja", "preto", A, "gasolina", [], 5],
  ["v60", "t5", "momentum", 2016, 2017, 64_000, 115_000, "São Paulo", "SP", "loja", "cinza", A, "gasolina", [], 4],
  ["xc60", "t5", "momentum", 2016, 2017, 70_000, 125_000, "Joinville", "SC", "particular", "verde", A, "gasolina", [], 9],
  // XC60
  ["xc60", "t8", "polestar-engineered", 2019, 2020, 38_000, 280_000, "São Paulo", "SP", "loja", "cinza", A, "hibrido_plugin", ["suspensão Öhlins", "som Bowers & Wilkins"], 1],
  ["xc60", "t8", "polestar-engineered", 2021, 2022, 18_000, 340_000, "Curitiba", "PR", "loja", "branco", A, "hibrido_plugin", ["suspensão Öhlins", "teto solar panorâmico"], 2, { seller: "cwb" }],
  ["xc60", "t8", "inscription", 2018, 2019, 56_000, 235_000, "São Paulo", "SP", "particular", "preto", A, "hibrido_plugin", ["bancos com ventilação", "head-up display"], 7],
  ["xc60", "t8", "r-design", 2020, 2021, 41_000, 249_000, "Santos", "SP", "loja", "azul", A, "hibrido_plugin", ["teto solar panorâmico"], 10],
  ["xc60", "t5", "momentum", 2018, 2019, 52_000, 195_000, "Ribeirão Preto", "SP", "loja", "prata", A, "gasolina", [], 11],
  ["xc60", "t5", "dynamic", 2013, 2014, 102_000, 85_000, "Goiânia", "GO", "particular", "preto", A, "gasolina", [], 14, { redFlags: ["repasse"] }],
  ["xc60", "d5", "inscription", 2016, 2017, 110_000, 125_000, "Uberlândia", "MG", "particular", "prata", A, "diesel", ["tração integral"], 25],
  ["xc60", "t6", "r-design", 2015, 2016, 84_000, 120_000, "Brasília", "DF", "loja", "branco", A, "gasolina", [], 5],
  ["xc60", "t8", "ultimate-dark", 2022, 2023, 25_000, 305_000, "Porto Alegre", "RS", "loja", "preto", A, "hibrido_plugin", ["som Bowers & Wilkins"], 0, { seller: "poa" }],
  // XC40 / EX40 / C40 / EC40
  ["xc40", "twin-motor", null, 2021, 2022, 28_000, 189_000, "São Paulo", "SP", "particular", "azul", A, "eletrico", ["bomba de calor"], 3, { versionText: "Recharge Pure Electric P8" }],
  ["ex40", "single-motor", "plus", 2024, 2025, 9_000, 219_000, "Curitiba", "PR", "loja", "branco", A, "eletrico", [], 4, { seller: "cwb", origin: "direct" }],
  ["ex40", "single-motor", "core", 2024, 2024, 15_000, 199_900, "Campinas", "SP", "loja", "cinza", A, "eletrico", [], 6],
  ["xc40", "t5", "r-design", 2018, 2019, 52_000, 145_000, "Rio de Janeiro", "RJ", "particular", "vermelho", A, "gasolina", [], 8],
  ["xc40", "t5", "ultimate", 2022, 2023, 20_000, 210_000, "Belo Horizonte", "MG", "loja", "preto", A, "hibrido_plugin", [], 12, { versionText: "Recharge T5 Plug-in" }],
  ["xc40", "t4", "momentum", 2019, 2020, 46_000, 135_000, "Londrina", "PR", "particular", "branco", A, "gasolina", [], 16, { redFlags: ["agio"] }],
  ["xc40", "t5", "inscription", 2021, 2022, 33_000, 189_000, "Maringá", "PR", "loja", "cinza", A, "hibrido_plugin", [], 9, { versionText: "Recharge T5 Plug-in" }],
  ["c40", "twin-motor", null, 2022, 2023, 21_000, 205_000, "São Paulo", "SP", "particular", "verde", A, "eletrico", [], 5, { versionText: "Recharge Twin" }],
  ["ec40", "twin-motor", "ultimate", 2024, 2025, 6_000, 265_000, "Florianópolis", "SC", "loja", "azul", A, "eletrico", [], 2],
  // V40 and V40 Cross Country
  ["v40", "t4", "r-design", 2015, 2016, 68_000, 92_000, "São Paulo", "SP", "particular", "branco", A, "gasolina", [], 7],
  ["v40", "t5", "r-design", 2017, 2018, 42_000, 118_000, "Sorocaba", "SP", "loja", "preto", A, "gasolina", [], 3],
  ["v40", "t4", "momentum", 2014, 2015, 80_000, 79_000, "Niterói", "RJ", "particular", "prata", A, "gasolina", [], 18],
  ["v40-cc", "t4", null, 2016, 2017, 61_000, 99_000, "Belo Horizonte", "MG", "particular", "marrom", A, "gasolina", [], 10],
  ["v40-cc", "t5", "r-design", 2018, 2019, 39_000, 129_000, "São Paulo", "SP", "loja", "azul", A, "gasolina", ["tração integral"], 4],
  ["v40", "t4", "r-design", 2013, 2014, 95_000, 74_000, "Curitiba", "PR", "particular", "vermelho", A, "gasolina", [], 22, { redFlags: ["repasse"] }],
  // XC90 (the "xc90 t8 2020 a 2022 até 60 mil km" case)
  ["xc90", "t8", "inscription", 2019, 2020, 45_000, 330_000, "São Paulo", "SP", "loja", "preto", A, "hibrido_plugin", ["7 lugares", "som Bowers & Wilkins", "suspensão a ar"], 2, { seller: "sp" }],
  ["xc90", "t8", "r-design", 2020, 2021, 38_000, 365_000, "Curitiba", "PR", "loja", "cinza", A, "hibrido_plugin", ["7 lugares", "suspensão a ar"], 4],
  ["xc90", "t8", "inscription", 2021, 2022, 70_000, 355_000, "Porto Alegre", "RS", "particular", "branco", A, "hibrido_plugin", ["7 lugares"], 6],
  ["xc90", "t8", "momentum", 2018, 2019, 52_000, 285_000, "Campinas", "SP", "particular", "prata", A, "hibrido_plugin", [], 9],
  ["xc90", "t6", "momentum", 2016, 2017, 78_000, 215_000, "Recife", "PE", "loja", "azul", A, "gasolina", ["7 lugares"], 13],
  ["xc90", "d5", "inscription", 2018, 2019, 95_000, 265_000, "Goiânia", "GO", "particular", "preto", A, "diesel", ["7 lugares"], 30],
  ["xc90", "t8", "plus", 2023, 2024, 15_000, 420_000, "São Paulo", "SP", "loja", "branco", A, "hibrido_plugin", ["7 lugares"], 1],
  // Classics and older models
  ["850", "t5r", null, 1995, 1995, 180_000, 89_900, "São Paulo", "SP", "particular", "amarelo", A, "gasolina", ["bancos em couro e Alcantara"], 17],
  ["850", null, "r", 1997, 1997, 165_000, 95_000, "Porto Alegre", "RS", "particular", "preto", M, "gasolina", [], 21, { versionText: "R 2.3 turbo" }],
  ["c30", "t5", null, 2009, 2010, 92_000, 55_000, "Curitiba", "PR", "particular", "laranja", M, "gasolina", [], 8],
  ["c30", "t5", "r-design", 2011, 2012, 85_000, 62_000, "Florianópolis", "SC", "particular", "branco", A, "gasolina", [], 11],
  ["c70", "t5", null, 2008, 2009, 98_000, 69_000, "Rio de Janeiro", "RJ", "particular", "prata", A, "gasolina", ["capota rígida retrátil"], 19],
  ["s40", "t5", null, 2008, 2009, 110_000, 42_000, "Salvador", "BA", "particular", "preto", A, "gasolina", [], 23],
  ["v50", "t5", null, 2007, 2008, 120_000, 45_000, "Caxias do Sul", "RS", "particular", "azul", A, "gasolina", [], 26],
  ["s80", "t6", null, 2008, 2009, 125_000, 52_000, "Ribeirão Preto", "SP", "particular", "preto", A, "gasolina", ["tração integral"], 28, { redFlags: ["repasse", "documento_pendente"] }],
  ["xc70", "t6", null, 2011, 2012, 140_000, 68_000, "Blumenau", "SC", "particular", "marrom", A, "gasolina", ["tração integral"], 24],
  ["v70", "t5", null, 2003, 2004, 190_000, 32_000, "São Paulo", "SP", "particular", "prata", A, "gasolina", [], 29],
  ["s90", "t8", "inscription", 2018, 2019, 48_000, 260_000, "Brasília", "DF", "loja", "azul", A, "hibrido_plugin", [], 5],
  ["s80", "t5", null, 2013, 2014, 88_000, 72_000, "Campinas", "SP", "particular", "marrom", A, "gasolina", [], 14],
  ["940", null, null, 1995, 1996, 210_000, 38_000, "Belo Horizonte", "MG", "particular", "verde", A, "gasolina", [], 27, { versionText: "2.3 turbo" }],
  ["240", null, null, 1992, 1992, 250_000, 45_000, "Curitiba", "PR", "particular", "vermelho", M, "gasolina", [], 31, { versionText: "GL perua" }],
  // Electric
  ["ex30", "single-motor", "plus", 2024, 2025, 8_000, 199_000, "São Paulo", "SP", "loja", "azul", A, "eletrico", [], 1],
  ["ex30", "twin-motor", "ultra", 2024, 2025, 5_000, 239_000, "Curitiba", "PR", "particular", "cinza", A, "eletrico", [], 3, { versionText: "Twin Motor Performance" }],
  ["ex90", "twin-motor", "ultra", 2025, 2025, 3_000, 650_000, "São Paulo", "SP", "loja", "preto", A, "eletrico", ["7 lugares"], 2],
  // Not publicly searchable: must never show up in results
  ["xc60", "t8", "polestar-engineered", 2020, 2021, 30_000, 295_000, "São Paulo", "SP", "loja", "branco", A, "hibrido_plugin", [], 1, { status: "pending_review", post: {
    caption: "XC60 T8 Polestar Engineered 2020/2021 🔥 Apenas 30 mil km, revisões na concessionária, teto panorâmico e som Bowers & Wilkins. R$ 295.000. Aceitamos troca e financiamos. Loja em São Paulo/SP. WhatsApp {telefone}",
    confidence: 0.7,
    issues: [{ code: "summary_copied", message: "O resumo repete trechos da legenda." }],
  } }],
  ["s60", "t5", "r-design", 2019, 2020, 39_000, 175_000, "Campinas", "SP", "particular", "branco", A, "gasolina", [], 4, { status: "removed" }],
  ["v40", "t4", "r-design", 2016, 2017, 58_000, 99_000, "São Paulo", "SP", "particular", "cinza", A, "gasolina", [], 12, { status: "sold" }],
  ["xc90", "t8", "inscription", 2020, 2020, 50_000, 320_000, "São Paulo", "SP", "particular", "preto", A, "hibrido_plugin", [], 45, { status: "expired" }],
  ["xc40", "twin-motor", null, 2021, 2021, 40_000, 175_000, "Porto Alegre", "RS", "particular", "branco", A, "eletrico", [], 2, { status: "pending_review", post: {
    caption: "Vendo meu XC40 Recharge Twin 2021, branco, 40 mil km, bateria na garantia e carregador de parede junto. 175 mil. Porto Alegre. {telefone}",
    confidence: 0.8,
    issues: [],
  } }],
  ["xc60", "t5", "dynamic", 2013, 2014, 102_000, 70_000, "Goiânia", "GO", "particular", "prata", A, "gasolina", [], 0, { status: "pending_review", redFlags: ["repasse", "pedido_de_sinal"], post: {
    caption: "REPASSE ⚠️ XC60 T5 Dynamic 2014 prata, 102.000 km, precisa de pneus. 70k pra vender logo. Somente pix de sinal pra reservar. Goiânia {telefone}",
    confidence: 0.45,
    issues: [{ code: "repasse_com_sinal", message: "Repasse ou ágio com pedido de sinal: padrão comum de golpe, revisar antes de publicar." }],
  } }],
];

export const FIXTURE_LISTINGS: FixtureListing[] = ROWS.map((row) => {
  const [
    model,
    engine,
    trim,
    yearFab,
    yearModel,
    km,
    price,
    city,
    uf,
    sellerType,
    color,
    transmission,
    fuel,
    options,
    daysAgo,
    extra,
  ] = row;
  return {
    model,
    engine,
    trim,
    yearFab,
    yearModel,
    km,
    price,
    city,
    uf,
    sellerType,
    color,
    transmission,
    fuel,
    options,
    daysAgo,
    ...extra,
  };
});
