/**
 * One structured-output call to Claude per post.
 * - Structured outputs (output_config.format) guarantee the JSON shape; Zod
 *   validates again and one retry covers an invalid or truncated answer.
 * - Claude Haiku 5.5 rejects sampling parameters (temperature), so determinism
 *   comes from thinking disabled + low effort instead.
 * - The system prompt is cached (cache_control) since it is identical on every call.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { emptyUsage, type TokenUsage, addUsage } from "./cost";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompt";
import { type Extraction, ExtractionSchema } from "./schema";

export const DEFAULT_EXTRACTION_MODEL = "claude-haiku-5-5";

export interface ExtractInput {
  caption: string;
  igUsername?: string | null;
  bio?: string | null;
  postedAt?: string | null;
}

export interface ExtractResult {
  output: Extraction;
  model: string;
  usage: TokenUsage;
  attempts: number;
}

export class ExtractionError extends Error {
  constructor(
    readonly code: "refusal" | "invalid_output",
    message: string,
    readonly usage: TokenUsage,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** The part of the SDK client this module uses (lets tests pass a stub). */
export type MessagesClient = Pick<Anthropic, "messages">;

export function buildUserMessage(input: ExtractInput): string {
  const lines = [
    "Instagram post to analyze.",
    `Author: ${input.igUsername ? `@${input.igUsername.replace(/^@/, "")}` : "unknown"}`,
  ];
  if (input.postedAt) lines.push(`Posted at: ${input.postedAt}`);
  if (input.bio) lines.push(`Author profile bio: """${input.bio.slice(0, 500)}"""`);
  lines.push(`Caption: """${input.caption.slice(0, 4000)}"""`);
  return lines.join("\n");
}

const usageOf = (u: Anthropic.Usage): TokenUsage => ({
  inputTokens: u.input_tokens,
  outputTokens: u.output_tokens,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  cacheReadTokens: u.cache_read_input_tokens ?? 0,
});

export async function extractListing(
  input: ExtractInput,
  options: { client: MessagesClient; model?: string; maxAttempts?: number },
): Promise<ExtractResult> {
  const model = options.model ?? DEFAULT_EXTRACTION_MODEL;
  const maxAttempts = options.maxAttempts ?? 2;
  let usage = emptyUsage();
  let lastProblem = "no answer";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await options.client.messages.parse({
      model,
      max_tokens: 2048,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: zodOutputFormat(ExtractionSchema) },
      system: [
        { type: "text", text: EXTRACTION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });
    usage = addUsage(usage, usageOf(response.usage));

    if (response.stop_reason === "refusal") {
      throw new ExtractionError("refusal", "The model declined to process this post.", usage);
    }
    if (response.stop_reason === "max_tokens") {
      lastProblem = "answer truncated (max_tokens)";
      continue;
    }
    const checked = ExtractionSchema.safeParse(response.parsed_output);
    if (checked.success) return { output: checked.data, model, usage, attempts: attempt };
    lastProblem = checked.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  throw new ExtractionError("invalid_output", `Invalid extraction output: ${lastProblem}`, usage);
}
