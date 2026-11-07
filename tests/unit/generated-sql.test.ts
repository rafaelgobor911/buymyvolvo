import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ENGINES, MODELS, TRIMS } from "@/lib/taxonomy";

import {
  generateSeedSql,
  generateTaxonomySql,
  SEED_FILE,
  TAXONOMY_MIGRATION,
} from "../../scripts/db/sql-gen";

const root = path.resolve(import.meta.dirname, "../..");

describe("generated SQL", () => {
  it("taxonomy migration is in sync with src/lib/taxonomy/data.ts (run npm run db:generate)", () => {
    expect(readFileSync(path.join(root, TAXONOMY_MIGRATION), "utf8")).toBe(generateTaxonomySql());
  });

  it("seed.sql is in sync with scripts/db/fixtures.ts (run npm run db:generate)", () => {
    expect(readFileSync(path.join(root, SEED_FILE), "utf8")).toBe(generateSeedSql());
  });

  it("turns every review note into a -- REVISAR comment", () => {
    const notes = [
      ...MODELS.flatMap((m) => [m.review, ...m.generations.map((g) => g.review)]),
      ...ENGINES.map((e) => e.review),
      ...TRIMS.map((t) => t.review),
    ].filter(Boolean);
    expect(generateTaxonomySql().match(/-- REVISAR: /g)?.length ?? 0).toBe(notes.length);
  });

  it("uses DDD 20 (non-existent) for every fixture phone", () => {
    const phones = generateSeedSql().match(/'\+55\d+'/g) ?? [];
    expect(phones.length).toBeGreaterThan(50);
    expect(phones.every((p) => p.startsWith("'+5520"))).toBe(true);
  });
});
