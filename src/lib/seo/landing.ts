/**
 * Indexable landing pages per model, version (engine or trim) and state:
 * /volvo/xc60, /volvo/xc60/t8, /volvo/xc60/inscription, /volvo/xc60/sp,
 * /volvo/xc60/t8/sp. Pure (no I/O): the same rules feed the pages, the
 * sitemap and the internal links.
 *
 * Engine, trim and UF ids never collide, so the second segment can be any of
 * them. Each page is the indexable form of a /busca filter combination
 * (/busca itself stays noindex).
 */
import { type Uf, UFS } from "@/lib/search/places";
import {
  BODY_LABELS,
  type EngineDef,
  FUEL_LABELS,
  getEngine,
  getModel,
  getTrim,
  isEngineCompatible,
  isTrimCompatible,
  MODELS,
  type ModelDef,
  type TrimDef,
  trimVariantsOf,
  variantsOf,
} from "@/lib/taxonomy";

export const LANDING_ROOT = "/volvo";

export interface LandingKey {
  modelId: string;
  engineId?: string;
  trimId?: string;
  uf?: Uf;
}

export interface Landing {
  model: ModelDef;
  engine?: EngineDef;
  trim?: TrimDef;
  uf?: Uf;
  path: string;
  depth: 1 | 2 | 3;
  /** "Volvo XC60 T8" */
  name: string;
  /** "no Rio de Janeiro" (empty without a state). */
  where: string;
  /** Explicit /busca parameters for the same filters (they override the text query). */
  searchParams: Record<string, string>;
}

/** Fewer active listings than this → the page renders but stays out of the index and sitemap. */
export function minListingsToIndex(depth: Landing["depth"]): number {
  return depth === 1 ? 1 : 2;
}

/** "em São Paulo", "no Paraná", "na Bahia". */
export const UF_IN: Record<Uf, string> = {
  AC: "no Acre",
  AL: "em Alagoas",
  AP: "no Amapá",
  AM: "no Amazonas",
  BA: "na Bahia",
  CE: "no Ceará",
  DF: "no Distrito Federal",
  ES: "no Espírito Santo",
  GO: "em Goiás",
  MA: "no Maranhão",
  MT: "em Mato Grosso",
  MS: "em Mato Grosso do Sul",
  MG: "em Minas Gerais",
  PA: "no Pará",
  PB: "na Paraíba",
  PR: "no Paraná",
  PE: "em Pernambuco",
  PI: "no Piauí",
  RJ: "no Rio de Janeiro",
  RN: "no Rio Grande do Norte",
  RS: "no Rio Grande do Sul",
  RO: "em Rondônia",
  RR: "em Roraima",
  SC: "em Santa Catarina",
  SP: "em São Paulo",
  SE: "em Sergipe",
  TO: "no Tocantins",
};

const ufFromSegment = (segment: string): Uf | undefined => {
  const upper = segment.toUpperCase();
  return segment === segment.toLowerCase() && upper in UFS ? (upper as Uf) : undefined;
};

/** A version segment: an engine or trim that fits the model. */
function versionOf(model: ModelDef, id: string): { engine?: EngineDef; trim?: TrimDef } | null {
  const engine = getEngine(id);
  if (engine) return isEngineCompatible(engine.id, model.id) ? { engine } : null;
  const trim = getTrim(id);
  if (trim) return isTrimCompatible(trim.id, model.id) ? { trim } : null;
  return null;
}

export function landingPath(key: LandingKey): string {
  const parts = [key.modelId, key.engineId ?? key.trimId, key.uf?.toLowerCase()].filter(Boolean);
  return `${LANDING_ROOT}/${parts.join("/")}`;
}

function buildLanding(key: LandingKey): Landing | null {
  const model = getModel(key.modelId);
  if (!model) return null;
  const version = key.engineId ?? key.trimId;
  const found = version ? versionOf(model, version) : {};
  if (!found) return null;
  const { engine, trim } = found;
  const searchParams: Record<string, string> = { modelo: model.id };
  if (engine) searchParams.motor = engine.id;
  if (trim) searchParams.versao = trim.id;
  if (key.uf) searchParams.uf = key.uf;
  return {
    model,
    engine,
    trim,
    uf: key.uf,
    path: landingPath({ modelId: model.id, engineId: engine?.id, trimId: trim?.id, uf: key.uf }),
    depth: (1 + (version ? 1 : 0) + (key.uf ? 1 : 0)) as Landing["depth"],
    name: ["Volvo", model.name, engine?.name, trim?.name].filter(Boolean).join(" "),
    where: key.uf ? UF_IN[key.uf] : "",
    searchParams,
  };
}

export type LandingResolution =
  { kind: "page"; landing: Landing } | { kind: "redirect"; path: string } | { kind: "not_found" };

/**
 * Resolves the segments after /volvo. Uppercase or encoded variants of a valid
 * page redirect to the canonical lowercase path; anything else is a 404.
 */
export function resolveLanding(segments: string[]): LandingResolution {
  if (segments.length < 1 || segments.length > 3) return { kind: "not_found" };
  let decoded: string[];
  try {
    decoded = segments.map((s) => decodeURIComponent(s).trim());
  } catch {
    return { kind: "not_found" };
  }
  const lower = decoded.map((s) => s.toLowerCase());
  const [modelId, second, third] = lower;
  let key: LandingKey | null = null;
  if (lower.length === 1) key = { modelId: modelId! };
  else if (lower.length === 2) {
    const uf = ufFromSegment(second!);
    key = uf ? { modelId: modelId!, uf } : { modelId: modelId!, engineId: second };
  } else {
    const uf = ufFromSegment(third!);
    key = uf ? { modelId: modelId!, engineId: second, uf } : null;
  }
  if (!key) return { kind: "not_found" };
  // engineId doubles as "version id" here; buildLanding tells engines from trims.
  const landing = buildLanding(key);
  if (!landing) return { kind: "not_found" };
  if (
    decoded.join("/") !== lower.join("/") ||
    landing.path !== `${LANDING_ROOT}/${lower.join("/")}`
  )
    return { kind: "redirect", path: landing.path };
  return { kind: "page", landing };
}

// ---------------------------------------------------------------------------
// Counts per landing (sitemap, internal links)
// ---------------------------------------------------------------------------

export interface FacetRow {
  modelId: string;
  engineId: string | null;
  trimId: string | null;
  uf: string | null;
  count: number;
}

export interface LandingCount extends LandingKey {
  path: string;
  depth: Landing["depth"];
  count: number;
}

/**
 * Active-listing counts for every landing the rows reach. A variant also
 * counts for its parent (V40 Cross Country → V40, Ultimate Dark → Ultimate),
 * as in the search.
 */
export function landingCounts(rows: FacetRow[]): Map<string, LandingCount> {
  const out = new Map<string, LandingCount>();
  const add = (key: LandingKey, count: number) => {
    const landing = buildLanding(key);
    if (!landing) return;
    const current = out.get(landing.path);
    if (current) current.count += count;
    else
      out.set(landing.path, {
        modelId: landing.model.id,
        engineId: landing.engine?.id,
        trimId: landing.trim?.id,
        uf: landing.uf,
        path: landing.path,
        depth: landing.depth,
        count,
      });
  };
  for (const row of rows) {
    const model = getModel(row.modelId);
    if (!model) continue;
    const models = [model.id, ...(model.parentId ? [model.parentId] : [])];
    const trim = row.trimId ? getTrim(row.trimId) : undefined;
    const versions: Array<Pick<LandingKey, "engineId" | "trimId">> = [
      ...(row.engineId ? [{ engineId: row.engineId }] : []),
      ...(trim ? [{ trimId: trim.id }] : []),
      ...(trim?.parentId ? [{ trimId: trim.parentId }] : []),
    ];
    const uf = row.uf ? ufFromSegment(row.uf.toLowerCase()) : undefined;
    for (const modelId of models) {
      add({ modelId }, row.count);
      if (uf) add({ modelId, uf }, row.count);
      for (const v of versions) {
        add({ ...v, modelId }, row.count);
        if (uf) add({ ...v, modelId, uf }, row.count);
      }
    }
  }
  return out;
}

export const isIndexable = (c: { depth: Landing["depth"]; count: number }) =>
  c.count >= minListingsToIndex(c.depth);

// ---------------------------------------------------------------------------
// Short descriptive text, generated from the taxonomy (reviewed by the owner)
// ---------------------------------------------------------------------------

const joinPt = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

const yearsText = (start: number, end: number | null) =>
  end === null ? `desde ${start}` : start === end ? `${start}` : `${start}–${end}`;

export interface RelatedLink {
  path: string;
  label: string;
}

/**
 * Facts about the model/version for the page intro: only what the taxonomy
 * says (Brazilian model years, body, fuel). No market data.
 */
export function landingIntro(landing: Landing): { paragraphs: string[]; related: RelatedLink[] } {
  const { model, engine, trim } = landing;
  const paragraphs: string[] = [];
  const related: RelatedLink[] = [];
  const body = joinPt(model.bodyTypes.map((b) => BODY_LABELS[b]));
  if (model.brazil === false) {
    paragraphs.push(`O ${model.name} (${body}) não foi vendido oficialmente no Brasil.`);
  } else {
    const gens = model.generations.filter((g) => g.brazil !== false);
    const start = Math.min(...gens.map((g) => g.yearStart));
    const end = gens.some((g) => g.yearEnd === null)
      ? null
      : Math.max(...gens.map((g) => g.yearEnd ?? 0));
    const sold =
      end === null
        ? `é vendido no Brasil desde o ano-modelo ${start}`
        : `foi vendido no Brasil nos anos-modelo de ${start} a ${end}`;
    let text = `O ${model.name} (${body}) ${sold}.`;
    if (gens.length > 1) {
      text += ` Gerações: ${joinPt(gens.map((g) => `${g.name} (${yearsText(g.yearStart, g.yearEnd)})`))}.`;
    }
    paragraphs.push(text);
  }

  const parent = model.parentId ? getModel(model.parentId) : undefined;
  if (parent) {
    paragraphs.push(`É uma variante do ${parent.name}.`);
    related.push({ path: landingPath({ modelId: parent.id }), label: `Todos os ${parent.name}` });
  }
  const variants = variantsOf(model.id);
  if (variants.length) {
    paragraphs.push(`Esta página inclui também o ${joinPt(variants.map((v) => v.name))}.`);
  }
  if (model.renamedFrom) {
    const from = getModel(model.renamedFrom.modelId);
    if (from) {
      const start = Math.min(...model.generations.map((g) => g.yearStart));
      const electric = model.renamedFrom.scope === "electric" ? " elétrico" : "";
      paragraphs.push(
        `O ${model.name} é o novo nome do ${from.name}${electric} a partir de ${start}.`,
      );
      related.push({ path: landingPath({ modelId: from.id }), label: `Ver ${from.name}` });
    }
  }
  for (const renamed of MODELS.filter((m) => m.renamedFrom?.modelId === model.id)) {
    const start = Math.min(...renamed.generations.map((g) => g.yearStart));
    const electric = renamed.renamedFrom?.scope === "electric" ? " elétrico" : "";
    paragraphs.push(
      `A partir de ${start}, o ${model.name}${electric} passou a se chamar ${renamed.name}.`,
    );
    related.push({ path: landingPath({ modelId: renamed.id }), label: `Ver ${renamed.name}` });
  }

  if (engine) {
    const fuels = joinPt(engine.fuels.map((f) => FUEL_LABELS[f].toLowerCase()));
    paragraphs.push(`${engine.name}: motorização ${fuels}.`);
  }
  if (trim) {
    const trimVariants = trimVariantsOf(trim.id);
    paragraphs.push(
      `Versão ${trim.name}${trimVariants.length ? `, incluindo ${joinPt(trimVariants.map((t) => t.name))}` : ""}.`,
    );
  }
  if (engine || trim || landing.uf) {
    related.unshift({ path: landingPath({ modelId: model.id }), label: `Todos os ${model.name}` });
  }
  return { paragraphs, related };
}
