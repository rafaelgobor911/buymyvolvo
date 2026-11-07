/**
 * Volvo taxonomy: single source of truth.
 *
 * - Feeds `parseQuery` directly (no DB round-trip).
 * - Generates `supabase/migrations/*_taxonomy_data.sql` (`npm run db:generate`);
 *   every `review` note becomes a `-- REVISAR:` comment there.
 *
 * Years are model years (ano-modelo) for the Brazilian market. `brazil: false`
 * marks what was never sold officially here: search still recognizes it, the
 * filter panel hides it and extraction lowers confidence.
 * Reviewed by the product owner on 2026-11-07; remaining doubts carry `review`.
 */
import type { EngineDef, ModelDef, TrimDef } from "./types";

export const MODELS: ModelDef[] = [
  // --- Classics (RWD); platforms outside the P80…SEA list stay null --------
  {
    id: "240",
    name: "240",
    bodyTypes: ["sedan", "perua"],
    aliases: [],
    generations: [{ id: "240", name: "240", yearStart: 1974, yearEnd: 1993, platform: null }],
  },
  {
    id: "740",
    name: "740",
    bodyTypes: ["sedan", "perua"],
    aliases: [],
    generations: [{ id: "740", name: "740", yearStart: 1984, yearEnd: 1992, platform: null }],
  },
  {
    id: "760",
    name: "760",
    bodyTypes: ["sedan", "perua"],
    aliases: [],
    generations: [{ id: "760", name: "760", yearStart: 1982, yearEnd: 1992, platform: null }],
  },
  {
    id: "940",
    name: "940",
    bodyTypes: ["sedan", "perua"],
    aliases: [],
    generations: [{ id: "940", name: "940", yearStart: 1991, yearEnd: 1998, platform: null }],
  },
  {
    id: "960",
    name: "960",
    bodyTypes: ["sedan", "perua"],
    aliases: [],
    generations: [{ id: "960", name: "960", yearStart: 1991, yearEnd: 1997, platform: null }],
  },
  // --- P80 ------------------------------------------------------------------
  {
    id: "850",
    name: "850",
    bodyTypes: ["sedan", "perua"],
    aliases: [],
    generations: [{ id: "850", name: "850", yearStart: 1993, yearEnd: 1997, platform: "P80" }],
  },
  {
    id: "s70",
    name: "S70",
    bodyTypes: ["sedan"],
    aliases: [],
    generations: [{ id: "s70", name: "S70", yearStart: 1997, yearEnd: 2000, platform: "P80" }],
  },
  {
    id: "c70",
    name: "C70",
    bodyTypes: ["cupe", "conversivel"],
    aliases: [],
    generations: [
      { id: "c70-1", name: "1ª geração", yearStart: 1997, yearEnd: 2005, platform: "P80" },
      { id: "c70-2", name: "2ª geração", yearStart: 2006, yearEnd: 2013, platform: "P1" },
    ],
  },
  // --- S40 / V40 / V50 / C30 -------------------------------------------------
  {
    id: "s40",
    name: "S40",
    bodyTypes: ["sedan"],
    aliases: [],
    generations: [
      // Shared with Mitsubishi (NedCar), outside the platform list.
      { id: "s40-1", name: "1ª geração", yearStart: 1996, yearEnd: 2004, platform: null },
      { id: "s40-2", name: "2ª geração", yearStart: 2004, yearEnd: 2012, platform: "P1" },
    ],
  },
  {
    id: "v40",
    name: "V40",
    bodyTypes: ["perua", "hatch"],
    aliases: [],
    generations: [
      // NedCar platform, outside the platform list.
      { id: "v40-1", name: "1ª geração (perua)", yearStart: 1996, yearEnd: 2004, platform: null },
      { id: "v40-2", name: "2ª geração (hatch)", yearStart: 2013, yearEnd: 2019, platform: "P1" },
    ],
  },
  {
    id: "v40-cc",
    name: "V40 Cross Country",
    bodyTypes: ["hatch"],
    aliases: ["v40 cc", "v40 cross", "v40cc"],
    parentId: "v40",
    generations: [
      { id: "v40-cc", name: "V40 Cross Country", yearStart: 2013, yearEnd: 2019, platform: "P1" },
    ],
  },
  {
    id: "v50",
    name: "V50",
    bodyTypes: ["perua"],
    aliases: [],
    generations: [{ id: "v50", name: "V50", yearStart: 2004, yearEnd: 2012, platform: "P1" }],
  },
  {
    id: "c30",
    name: "C30",
    bodyTypes: ["hatch"],
    aliases: [],
    generations: [{ id: "c30", name: "C30", yearStart: 2007, yearEnd: 2013, platform: "P1" }],
  },
  // --- S60 / V60 -------------------------------------------------------------
  {
    id: "s60",
    name: "S60",
    bodyTypes: ["sedan"],
    aliases: [],
    generations: [
      { id: "s60-1", name: "1ª geração", yearStart: 2001, yearEnd: 2009, platform: "P2" },
      { id: "s60-2", name: "2ª geração", yearStart: 2011, yearEnd: 2018, platform: "P3" },
      { id: "s60-3", name: "3ª geração", yearStart: 2019, yearEnd: 2022, platform: "SPA" },
    ],
  },
  {
    id: "s60-cc",
    name: "S60 Cross Country",
    bodyTypes: ["sedan"],
    aliases: ["s60 cc", "s60 cross"],
    parentId: "s60",
    brazil: false,
    generations: [
      { id: "s60-cc", name: "S60 Cross Country", yearStart: 2016, yearEnd: 2018, platform: "P3" },
    ],
  },
  {
    id: "v60",
    name: "V60",
    bodyTypes: ["perua"],
    aliases: [],
    generations: [
      { id: "v60-1", name: "1ª geração", yearStart: 2011, yearEnd: 2018, platform: "P3" },
      { id: "v60-2", name: "2ª geração", yearStart: 2019, yearEnd: null, platform: "SPA" },
    ],
  },
  {
    id: "v60-cc",
    name: "V60 Cross Country",
    bodyTypes: ["perua"],
    aliases: ["v60 cc", "v60 cross"],
    parentId: "v60",
    brazil: false,
    generations: [
      { id: "v60-cc-1", name: "1ª geração", yearStart: 2015, yearEnd: 2018, platform: "P3" },
      { id: "v60-cc-2", name: "2ª geração", yearStart: 2019, yearEnd: null, platform: "SPA" },
    ],
  },
  // --- V70 / XC70 / S80 ------------------------------------------------------
  {
    id: "v70",
    name: "V70",
    bodyTypes: ["perua"],
    aliases: [],
    generations: [
      { id: "v70-1", name: "1ª geração", yearStart: 1997, yearEnd: 2000, platform: "P80" },
      { id: "v70-2", name: "2ª geração", yearStart: 2001, yearEnd: 2007, platform: "P2" },
      {
        id: "v70-3",
        name: "3ª geração",
        yearStart: 2008,
        yearEnd: 2016,
        platform: "P3",
        brazil: false,
      },
    ],
  },
  {
    id: "xc70",
    name: "XC70",
    bodyTypes: ["perua"],
    aliases: ["v70 xc", "v70xc"],
    generations: [
      { id: "xc70-0", name: "V70 XC", yearStart: 1997, yearEnd: 2000, platform: "P80" },
      {
        id: "xc70-1",
        name: "1ª geração (V70 XC até 2002)",
        yearStart: 2001,
        yearEnd: 2007,
        platform: "P2",
      },
      { id: "xc70-2", name: "2ª geração", yearStart: 2008, yearEnd: 2016, platform: "P3" },
    ],
  },
  {
    id: "s80",
    name: "S80",
    bodyTypes: ["sedan"],
    aliases: [],
    generations: [
      { id: "s80-1", name: "1ª geração", yearStart: 1999, yearEnd: 2006, platform: "P2" },
      { id: "s80-2", name: "2ª geração", yearStart: 2007, yearEnd: 2016, platform: "P3" },
    ],
  },
  // --- 90 series -------------------------------------------------------------
  {
    id: "s90",
    name: "S90",
    bodyTypes: ["sedan"],
    aliases: [],
    generations: [
      { id: "s90-1", name: "1ª geração (ex-960)", yearStart: 1997, yearEnd: 1998, platform: null },
      { id: "s90-2", name: "2ª geração", yearStart: 2017, yearEnd: null, platform: "SPA" },
    ],
  },
  {
    id: "v90",
    name: "V90",
    bodyTypes: ["perua"],
    aliases: [],
    brazil: false,
    generations: [
      { id: "v90-1", name: "1ª geração (ex-960)", yearStart: 1997, yearEnd: 1998, platform: null },
      { id: "v90-2", name: "2ª geração", yearStart: 2017, yearEnd: null, platform: "SPA" },
    ],
  },
  {
    id: "v90-cc",
    name: "V90 Cross Country",
    bodyTypes: ["perua"],
    aliases: ["v90 cc", "v90 cross"],
    parentId: "v90",
    brazil: false,
    generations: [
      { id: "v90-cc", name: "V90 Cross Country", yearStart: 2017, yearEnd: null, platform: "SPA" },
    ],
  },
  // --- SUVs -----------------------------------------------------------------
  {
    id: "xc40",
    name: "XC40",
    bodyTypes: ["suv"],
    aliases: [],
    generations: [{ id: "xc40", name: "XC40", yearStart: 2018, yearEnd: null, platform: "CMA" }],
  },
  {
    // New name of the XC40 Recharge Pure Electric from 2024.
    id: "ex40",
    name: "EX40",
    bodyTypes: ["suv"],
    aliases: ["xc40 pure electric", "xc40 recharge pure electric"],
    renamedFrom: { modelId: "xc40", scope: "electric" },
    generations: [{ id: "ex40", name: "EX40", yearStart: 2024, yearEnd: null, platform: "CMA" }],
  },
  {
    id: "c40",
    name: "C40",
    bodyTypes: ["suv"],
    aliases: ["c40 recharge"],
    generations: [
      { id: "c40", name: "C40 Recharge", yearStart: 2022, yearEnd: 2024, platform: "CMA" },
    ],
  },
  {
    // New name of the C40 Recharge from 2024.
    id: "ec40",
    name: "EC40",
    bodyTypes: ["suv"],
    aliases: [],
    renamedFrom: { modelId: "c40", scope: "all" },
    generations: [{ id: "ec40", name: "EC40", yearStart: 2024, yearEnd: null, platform: "CMA" }],
  },
  {
    id: "xc60",
    name: "XC60",
    bodyTypes: ["suv"],
    aliases: [],
    generations: [
      { id: "xc60-1", name: "1ª geração", yearStart: 2009, yearEnd: 2017, platform: "P3" },
      { id: "xc60-2", name: "2ª geração", yearStart: 2018, yearEnd: null, platform: "SPA" },
    ],
  },
  {
    id: "xc90",
    name: "XC90",
    bodyTypes: ["suv"],
    aliases: [],
    generations: [
      { id: "xc90-1", name: "1ª geração", yearStart: 2003, yearEnd: 2014, platform: "P2" },
      { id: "xc90-2", name: "2ª geração", yearStart: 2015, yearEnd: null, platform: "SPA" },
    ],
  },
  {
    id: "ex30",
    name: "EX30",
    bodyTypes: ["suv"],
    aliases: [],
    generations: [{ id: "ex30", name: "EX30", yearStart: 2024, yearEnd: null, platform: "SEA" }],
  },
  {
    id: "ex90",
    name: "EX90",
    bodyTypes: ["suv"],
    aliases: [],
    generations: [{ id: "ex90", name: "EX90", yearStart: 2025, yearEnd: null, platform: "SPA2" }],
  },
  {
    id: "es90",
    name: "ES90",
    bodyTypes: ["sedan"],
    aliases: [],
    generations: [{ id: "es90", name: "ES90", yearStart: 2026, yearEnd: null, platform: "SPA2" }],
  },
];

export const ENGINES: EngineDef[] = [
  {
    id: "t2",
    name: "T2",
    fuels: ["gasolina"],
    platforms: ["P1", "CMA"],
    yearStart: 2015,
    yearEnd: null,
    aliases: [],
    brazil: false,
  },
  {
    id: "t3",
    name: "T3",
    fuels: ["gasolina"],
    platforms: ["P1", "CMA"],
    yearStart: 2013,
    yearEnd: null,
    aliases: [],
    brazil: [{ modelIds: ["v40"], yearStart: 2015, yearEnd: 2017 }],
  },
  {
    // T4 1.6 (S60, P3) and T4 2.0 Drive-E (S60, V60, V40, XC40). No T4 Recharge in Brazil.
    id: "t4",
    name: "T4",
    fuels: ["gasolina"],
    platforms: ["P1", "P3", "SPA", "CMA"],
    yearStart: 2011,
    yearEnd: null,
    aliases: [],
    brazil: [{ modelIds: ["s60", "v60", "v40", "xc40"], yearStart: 2011, yearEnd: null }],
  },
  {
    // Includes T5 Twin Engine/Recharge (plug-in) on the CMA.
    id: "t5",
    name: "T5",
    fuels: ["gasolina", "hibrido_plugin"],
    platforms: ["P80", "P1", "P2", "P3", "SPA", "CMA"],
    yearStart: 1994,
    yearEnd: null,
    aliases: [],
  },
  {
    id: "t5r",
    name: "T-5R",
    fuels: ["gasolina"],
    platforms: ["P80"],
    modelIds: ["850"],
    yearStart: 1995,
    yearEnd: 1996,
    aliases: ["t-5r", "t5-r"],
  },
  {
    // No T6 Recharge (plug-in) in Brazil.
    id: "t6",
    name: "T6",
    fuels: ["gasolina"],
    platforms: ["P2", "P3", "SPA"],
    yearStart: 1999,
    yearEnd: null,
    aliases: [],
  },
  {
    id: "t8",
    name: "T8",
    fuels: ["hibrido_plugin"],
    platforms: ["SPA"],
    yearStart: 2015,
    yearEnd: null,
    aliases: ["t8 recharge", "t8 twin engine"],
  },
  {
    id: "d3",
    name: "D3",
    fuels: ["diesel"],
    platforms: ["P1", "P3", "SPA", "CMA"],
    yearStart: 2010,
    yearEnd: 2021,
    aliases: [],
    brazil: false,
  },
  {
    id: "d4",
    name: "D4",
    fuels: ["diesel"],
    platforms: ["P1", "P3", "SPA", "CMA"],
    yearStart: 2012,
    yearEnd: 2021,
    aliases: [],
    brazil: false,
  },
  {
    id: "d5",
    name: "D5",
    fuels: ["diesel"],
    platforms: ["P2", "P3", "SPA"],
    yearStart: 2001,
    yearEnd: 2021,
    aliases: [],
    brazil: [
      { modelIds: ["xc60"], yearStart: 2015, yearEnd: 2020 },
      { modelIds: ["xc90"], yearStart: 2018, yearEnd: 2020 },
    ],
  },
  {
    id: "b4",
    name: "B4",
    fuels: ["hibrido_leve"],
    platforms: ["CMA", "SPA"],
    yearStart: 2020,
    yearEnd: null,
    aliases: [],
    brazil: false,
  },
  {
    id: "b5",
    name: "B5",
    fuels: ["hibrido_leve"],
    platforms: ["CMA", "SPA"],
    yearStart: 2020,
    yearEnd: null,
    aliases: [],
    brazil: false,
  },
  {
    id: "b6",
    name: "B6",
    fuels: ["hibrido_leve"],
    platforms: ["SPA"],
    yearStart: 2020,
    yearEnd: null,
    aliases: [],
    brazil: false,
  },
  {
    id: "single-motor",
    name: "Single Motor",
    fuels: ["eletrico"],
    platforms: ["CMA", "SEA"],
    yearStart: 2022,
    yearEnd: null,
    aliases: ["single", "single motor extended range", "extended range"],
  },
  {
    // "Recharge" and "Pure Electric" are treated as fuel, not as an engine.
    id: "twin-motor",
    name: "Twin Motor",
    fuels: ["eletrico"],
    platforms: ["CMA", "SEA", "SPA2"],
    yearStart: 2020,
    yearEnd: null,
    aliases: ["twin", "twin motor performance"],
  },
];

export const TRIMS: TrimDef[] = [
  {
    // 850 R (1996–97), S60 R and V70 R (2003–07).
    id: "r",
    name: "R",
    yearStart: 1996,
    yearEnd: 2007,
    modelIds: ["850", "s60", "v70"],
    aliases: [],
  },
  {
    id: "r-design",
    name: "R-Design",
    yearStart: 2008,
    yearEnd: 2022,
    aliases: ["r design", "rdesign", "r-desing", "r desing", "rdesing"],
  },
  {
    // S60/V60 Polestar (T6) limited series, 2014–2018: not sold in Brazil.
    id: "polestar",
    name: "Polestar",
    yearStart: 2014,
    yearEnd: 2018,
    modelIds: ["s60", "v60"],
    engineIds: ["t6"],
    aliases: [],
    brazil: false,
  },
  {
    id: "polestar-engineered",
    name: "Polestar Engineered",
    yearStart: 2019,
    yearEnd: 2026,
    modelIds: ["s60", "v60", "xc60"],
    engineIds: ["t8"],
    aliases: ["polestar", "polestar eng"],
    review: "Confirmado na XC60 até 2026. Também houve S60 e V60 Polestar Engineered no Brasil?",
  },
  { id: "inscription", name: "Inscription", yearStart: 2015, yearEnd: 2022, aliases: [] },
  { id: "momentum", name: "Momentum", yearStart: 2015, yearEnd: 2021, aliases: [] },
  { id: "kinetic", name: "Kinetic", yearStart: 2010, yearEnd: 2013, aliases: [] },
  {
    id: "summum",
    name: "Summum",
    yearStart: 2005,
    yearEnd: 2015,
    aliases: [],
    brazil: false,
  },
  { id: "dynamic", name: "Dynamic", yearStart: 2008, yearEnd: 2016, aliases: [] },
  { id: "core", name: "Core", yearStart: 2023, yearEnd: null, aliases: [] },
  { id: "plus", name: "Plus", yearStart: 2023, yearEnd: null, aliases: [] },
  { id: "ultimate", name: "Ultimate", yearStart: 2023, yearEnd: null, aliases: [] },
  {
    id: "ultimate-dark",
    name: "Ultimate Dark",
    yearStart: 2023,
    yearEnd: null,
    modelIds: ["xc60"],
    parentId: "ultimate",
    aliases: [],
    review: "Você citou o Ultimate Dark na XC60. Existe em outros modelos no Brasil?",
  },
  // Every current model has an Ultra version.
  { id: "ultra", name: "Ultra", yearStart: 2024, yearEnd: null, aliases: [] },
  {
    id: "ultra-dark",
    name: "Ultra Dark",
    yearStart: 2024,
    yearEnd: null,
    modelIds: ["xc60"],
    parentId: "ultra",
    aliases: [],
    review: "Você citou o Ultra Dark na XC60. Existe em outros modelos no Brasil?",
  },
];
