/**
 * Plain-language explanations of Volvo names (model, engine, trim) for buyers
 * who do not know the nomenclature. Generated only from the taxonomy reviewed
 * by the owner, plus the generic meaning of each term (what a plug-in hybrid
 * or a "versão" is). No market data.
 */
import {
  BODY_LABELS,
  type Fuel,
  FUEL_LABELS,
  FUELS,
  generationsFor,
  getEngine,
  getModel,
  getTrim,
} from "@/lib/taxonomy";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const joinPt = (items: string[], last = "e") =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;

const yearsText = (start: number, end: number | null) =>
  end === null ? `desde ${start}` : start === end ? `${start}` : `${start}–${end}`;

/** "V40 Cross Country" under "V40" → "Cross Country"; "Ultimate Dark" → "Dark". */
function variantSuffix(name: string, parentName: string): string {
  return name.startsWith(`${parentName} `) ? name.slice(parentName.length + 1) : name;
}

/** "V40 (inclui Cross Country)", "Ultimate (inclui Dark)"; the plain name without variants. */
export function withVariantsLabel(name: string, variantNames: string[]): string {
  if (!variantNames.length) return name;
  return `${name} (inclui ${joinPt(variantNames.map((v) => variantSuffix(v, name)))})`;
}

/** What each fuel means, in a sentence fragment. */
const FUEL_MEANING: Record<Fuel, string> = {
  gasolina: "motor a gasolina",
  diesel: "motor a diesel",
  hibrido_leve: "híbrido leve (motor a combustão com auxílio elétrico)",
  hibrido_plugin:
    "híbrido plug-in (motor a gasolina e motor elétrico, com bateria que carrega na tomada)",
  eletrico: "100% elétrico",
};

/** The names say it in English: "Single Motor" has one electric motor, "Twin Motor" two. */
const ELECTRIC_MOTORS: Record<string, { short: string; long: string }> = {
  "single-motor": { short: "elétrico, um motor", long: "100% elétrico, com um motor" },
  "twin-motor": { short: "elétrico, dois motores", long: "100% elétrico, com dois motores" },
};

/** Fuels an engine code covers, narrowed to the listing's fuel when it is one of them. */
function engineFuels(engineId: string, fuel?: Fuel | null): Fuel[] {
  const engine = getEngine(engineId);
  if (!engine) return [];
  return fuel && engine.fuels.includes(fuel) ? [fuel] : engine.fuels;
}

/** "Híbrido plug-in (motor a gasolina e motor elétrico, …)" for the listing page. */
export function engineExplanation(engineId: string, fuel?: Fuel | null): string | null {
  const motors = ELECTRIC_MOTORS[engineId];
  if (motors) return capitalize(motors.long);
  const fuels = engineFuels(engineId, fuel);
  if (!fuels.length) return null;
  if (fuels.length === 1) return capitalize(FUEL_MEANING[fuels[0]!]);
  const labels = fuels.map((f) =>
    f === "gasolina" || f === "diesel" ? `a ${f}` : FUEL_LABELS[f].toLowerCase(),
  );
  return `Motor ${joinPt(labels, "ou")}, conforme o modelo e o ano`;
}

/** "híbrido plug-in", "gasolina ou híbrido plug-in": next to an engine link. */
export function engineFuelShort(engineId: string): string | null {
  const motors = ELECTRIC_MOTORS[engineId];
  if (motors) return motors.short;
  const fuels = engineFuels(engineId);
  return fuels.length
    ? joinPt(
        fuels.map((f) => FUEL_LABELS[f].toLowerCase()),
        "ou",
      )
    : null;
}

/** Generic meaning of "versão", the word the site uses for trims. */
export const TRIM_MEANING = "A versão define o pacote de equipamentos e o acabamento";

export function trimExplanation(trimId: string): string | null {
  const trim = getTrim(trimId);
  if (!trim) return null;
  const parent = trim.parentId ? getTrim(trim.parentId) : undefined;
  return parent ? `Variante do ${parent.name}. ${TRIM_MEANING}.` : `${TRIM_MEANING}.`;
}

/** "SUV · 2ª geração, desde 2018", "Hatch · variante do V40". */
export function modelExplanation(modelId: string, yearModel: number | null): string | null {
  const model = getModel(modelId);
  if (!model) return null;
  const parts: string[] = [];
  if (model.bodyTypes.length === 1) parts.push(BODY_LABELS[model.bodyTypes[0]!]);
  if (model.generations.length > 1 && yearModel !== null) {
    const generations = generationsFor(modelId, { min: yearModel, max: yearModel });
    if (generations.length === 1) {
      const g = generations[0]!;
      parts.push(`${g.name}, ${yearsText(g.yearStart, g.yearEnd)}`);
    }
  }
  const parent = model.parentId ? getModel(model.parentId) : undefined;
  if (parent) parts.push(`variante do ${parent.name}`);
  return parts.length ? capitalize(parts.join(" · ")) : null;
}

export interface NamePart {
  /** As written in the listing title: "XC60", "T8", "Ultimate Dark". */
  code: string;
  role: "Modelo" | "Motor" | "Versão";
  text: string;
}

/**
 * The listing title, part by part ("Entenda o nome"). Empty when the title is
 * only the model name: the plate and the facts already say that much.
 */
export function nameParts(listing: {
  modelId: string;
  modelName: string;
  engineId: string | null;
  engineName: string | null;
  trimId: string | null;
  trimName: string | null;
  fuel: Fuel | null;
  yearModel: number | null;
}): NamePart[] {
  const parts: NamePart[] = [];
  const engine =
    listing.engineId && listing.engineName
      ? engineExplanation(listing.engineId, listing.fuel)
      : null;
  const trim = listing.trimId && listing.trimName ? trimExplanation(listing.trimId) : null;
  if (!engine && !trim) return parts;
  const model = modelExplanation(listing.modelId, listing.yearModel);
  if (model) parts.push({ code: listing.modelName, role: "Modelo", text: model });
  if (engine) parts.push({ code: listing.engineName!, role: "Motor", text: engine });
  if (trim) parts.push({ code: listing.trimName!, role: "Versão", text: trim });
  return parts;
}

/** Order of the fuel groups in engine selects: gasoline first, electric last. */
export function fuelGroupOrder(fuels: Fuel[]): number {
  return Math.min(...fuels.map((f) => FUELS.indexOf(f))) * 10 + fuels.length;
}
