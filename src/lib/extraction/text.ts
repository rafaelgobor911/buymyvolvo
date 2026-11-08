/** Small text utilities shared by normalization and deduplication. */

export const foldText = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const words = (text: string) => foldText(text).match(/[a-z0-9]+/g) ?? [];

function trigrams(text: string): Set<string> {
  const padded = `  ${foldText(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

/** Jaccard similarity of character trigrams, 0..1 (same idea as pg_trgm). */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** True when `candidate` repeats any run of `n` consecutive words from `source`. */
export function sharesWordRun(candidate: string, source: string, n = 8): boolean {
  const src = words(source);
  if (src.length < n) return false;
  const runs = new Set<string>();
  for (let i = 0; i + n <= src.length; i++) runs.add(src.slice(i, i + n).join(" "));
  const cand = words(candidate);
  for (let i = 0; i + n <= cand.length; i++)
    if (runs.has(cand.slice(i, i + n).join(" "))) return true;
  return false;
}
