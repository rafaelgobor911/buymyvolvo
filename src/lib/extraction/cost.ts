/**
 * Token prices for cost estimates, USD per million tokens.
 * Input/output: Anthropic model table (cached 2026-10-06; Haiku 5.5 prices
 * apply to prompts up to 100K tokens). Cache write/read use the standard
 * 1.25× / 0.1× multipliers of the input price — confirm on the pricing page.
 */
export const PRICING_USD_PER_MTOK: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export const emptyUsage = (): TokenUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
});

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  };
}

/** Estimated cost in USD, or null when the model has no known price. */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const p = PRICING_USD_PER_MTOK[model];
  if (!p) return null;
  return (
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheWriteTokens * p.cacheWrite +
      usage.cacheReadTokens * p.cacheRead) /
    1_000_000
  );
}
