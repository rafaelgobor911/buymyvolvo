import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

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

  it("marks doubtful taxonomy entries for review", () => {
    expect(generateTaxonomySql()).toContain("-- REVISAR:");
  });

  it("uses DDD 20 (non-existent) for every fixture phone", () => {
    const phones = generateSeedSql().match(/'\+55\d+'/g) ?? [];
    expect(phones.length).toBeGreaterThan(50);
    expect(phones.every((p) => p.startsWith("'+5520"))).toBe(true);
  });
});
