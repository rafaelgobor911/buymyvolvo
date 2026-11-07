import { ENGINES, MODELS, TRIMS } from "./data";
import type { EngineDef, Fuel, Generation, ModelDef, Platform, TrimDef } from "./types";

export * from "./types";
export { ENGINES, MODELS, TRIMS };

const modelById = new Map(MODELS.map((m) => [m.id, m]));
const engineById = new Map(ENGINES.map((e) => [e.id, e]));
const trimById = new Map(TRIMS.map((t) => [t.id, t]));

export const getModel = (id: string): ModelDef | undefined => modelById.get(id);
export const getEngine = (id: string): EngineDef | undefined => engineById.get(id);
export const getTrim = (id: string): TrimDef | undefined => trimById.get(id);

/** Lowercase, strip accents, hyphens and spaces: "R-Design" → "rdesign". */
export function aliasKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s\-_.']/g, "");
}

export function modelYearRange(model: ModelDef): { start: number; end: number | null } {
  const start = Math.min(...model.generations.map((g) => g.yearStart));
  const end = model.generations.some((g) => g.yearEnd === null)
    ? null
    : Math.max(...model.generations.map((g) => g.yearEnd ?? 0));
  return { start, end };
}

const overlaps = (aStart: number, aEnd: number | null, bStart: number, bEnd: number | null) =>
  aStart <= (bEnd ?? Number.POSITIVE_INFINITY) && bStart <= (aEnd ?? Number.POSITIVE_INFINITY);

export interface YearWindow {
  min?: number;
  max?: number;
}

/** Generations of a model that overlap the given year window. */
export function generationsFor(modelId: string, years: YearWindow = {}): Generation[] {
  const model = modelById.get(modelId);
  if (!model) return [];
  return model.generations.filter((g) =>
    overlaps(g.yearStart, g.yearEnd, years.min ?? 0, years.max ?? null),
  );
}

/** Children (variants) of a model, e.g. V40 → V40 Cross Country. */
export function variantsOf(modelId: string): ModelDef[] {
  return MODELS.filter((m) => m.parentId === modelId);
}

export function isEngineCompatible(engineId: string, modelId: string, years: YearWindow = {}) {
  const engine = engineById.get(engineId);
  if (!engine) return false;
  if (engine.modelIds && !engine.modelIds.includes(modelId)) return false;
  return generationsFor(modelId, years).some(
    (g) =>
      g.platform !== null &&
      engine.platforms.includes(g.platform as Platform) &&
      overlaps(engine.yearStart, engine.yearEnd, g.yearStart, g.yearEnd),
  );
}

export function isTrimCompatible(
  trimId: string,
  modelId: string,
  years: YearWindow = {},
  engineIds: string[] = [],
) {
  const trim = trimById.get(trimId);
  if (!trim) return false;
  const baseModelId = modelById.get(modelId)?.parentId ?? modelId;
  if (trim.modelIds && !trim.modelIds.includes(modelId) && !trim.modelIds.includes(baseModelId)) {
    return false;
  }
  if (
    trim.engineIds &&
    engineIds.length > 0 &&
    !engineIds.some((e) => trim.engineIds!.includes(e))
  ) {
    return false;
  }
  return generationsFor(modelId, years).some((g) =>
    overlaps(trim.yearStart, trim.yearEnd, g.yearStart, g.yearEnd),
  );
}

/** Fuel implied by an engine when it has exactly one possible fuel (T8 → plug-in). */
export function impliedFuel(engineId: string): Fuel | undefined {
  const engine = engineById.get(engineId);
  return engine && engine.fuels.length === 1 ? engine.fuels[0] : undefined;
}

/** Models for select inputs: base models first, variants right after their parent. */
export function modelsForSelect(): Array<{ model: ModelDef; isVariant: boolean }> {
  const result: Array<{ model: ModelDef; isVariant: boolean }> = [];
  for (const model of MODELS) {
    if (model.parentId) continue;
    result.push({ model, isVariant: false });
    for (const variant of variantsOf(model.id)) result.push({ model: variant, isVariant: true });
  }
  return result;
}
