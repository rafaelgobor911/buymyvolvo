import { describe, expect, it } from "vitest";

import {
  aliasKey,
  ENGINES,
  FUELS,
  isEngineCompatible,
  isTrimCompatible,
  MODELS,
  modelsForSelect,
  PLATFORMS,
  TRIMS,
  variantsOf,
} from "./index";

describe("taxonomy integrity", () => {
  const ids = [...MODELS, ...ENGINES, ...TRIMS].map((x) => x.id);

  it("uses unique, slug-safe ids", () => {
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    expect(new Set(ENGINES.map((e) => e.id)).size).toBe(ENGINES.length);
    expect(new Set(TRIMS.map((t) => t.id)).size).toBe(TRIMS.length);
  });

  it("has coherent year ranges", () => {
    for (const item of [...ENGINES, ...TRIMS, ...MODELS.flatMap((m) => m.generations)]) {
      if (item.yearEnd !== null) expect(item.yearEnd).toBeGreaterThanOrEqual(item.yearStart);
      expect(item.yearStart).toBeGreaterThanOrEqual(1970);
    }
  });

  it("references only existing models, engines, fuels and platforms", () => {
    const modelIds = new Set(MODELS.map((m) => m.id));
    const engineIds = new Set(ENGINES.map((e) => e.id));
    for (const m of MODELS) {
      if (m.parentId) expect(modelIds).toContain(m.parentId);
      if (m.renamedFrom) expect(modelIds).toContain(m.renamedFrom.modelId);
      for (const g of m.generations) if (g.platform) expect(PLATFORMS).toContain(g.platform);
    }
    for (const e of ENGINES) {
      for (const f of e.fuels) expect(FUELS).toContain(f);
      for (const id of e.modelIds ?? []) expect(modelIds).toContain(id);
    }
    for (const t of TRIMS) {
      for (const id of t.modelIds ?? []) expect(modelIds).toContain(id);
      for (const id of t.engineIds ?? []) expect(engineIds).toContain(id);
    }
  });

  it("does not let a model alias collide with an engine or trim alias", () => {
    const owner = new Map<string, string>();
    const register = (kind: string, id: string, aliases: string[], name: string) => {
      for (const key of [aliasKey(name), aliasKey(id), ...aliases.map(aliasKey)]) {
        const previous = owner.get(key);
        if (previous && !previous.startsWith(kind)) {
          throw new Error(`alias "${key}" used by ${previous} and ${kind}:${id}`);
        }
        owner.set(key, `${kind}:${id}`);
      }
    };
    for (const m of MODELS) register("model", m.id, m.aliases, m.name);
    for (const e of ENGINES) register("engine", e.id, e.aliases, e.name);
    for (const t of TRIMS) register("trim", t.id, t.aliases, t.name);
  });
});

describe("variants", () => {
  it("lists the V40 Cross Country as a V40 variant", () => {
    expect(variantsOf("v40").map((m) => m.id)).toEqual(["v40-cc"]);
  });

  it("orders variants right after their parent in selects", () => {
    const order = modelsForSelect().map((x) => x.model.id);
    expect(order.indexOf("v40-cc")).toBe(order.indexOf("v40") + 1);
  });
});

describe("compatibility", () => {
  it("knows T8 is SPA-only", () => {
    expect(isEngineCompatible("t8", "xc60")).toBe(true);
    expect(isEngineCompatible("t8", "xc60", { max: 2017 })).toBe(false);
    expect(isEngineCompatible("t8", "v40")).toBe(false);
  });

  it("restricts T-5R to the 850", () => {
    expect(isEngineCompatible("t5r", "850")).toBe(true);
    expect(isEngineCompatible("t5r", "s70")).toBe(false);
  });

  it("separates Polestar from Polestar Engineered", () => {
    expect(isTrimCompatible("polestar", "xc60")).toBe(false);
    expect(isTrimCompatible("polestar-engineered", "xc60")).toBe(true);
    expect(isTrimCompatible("polestar", "s60", {}, ["t8"])).toBe(false);
    expect(isTrimCompatible("polestar-engineered", "s60", {}, ["t8"])).toBe(true);
  });

  it("accepts parent-model trims on variants", () => {
    expect(isTrimCompatible("r-design", "v40-cc")).toBe(true);
  });
});
