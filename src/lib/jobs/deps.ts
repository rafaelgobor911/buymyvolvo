/**
 * What jobs need from the outside world, created lazily so a job only demands
 * the credentials it uses (a token-health run needs no Anthropic key, a
 * process run needs no Instagram token).
 */
import Anthropic from "@anthropic-ai/sdk";

import { requireKeys, type ServerEnv } from "@/lib/env/schema";
import { DEFAULT_EXTRACTION_MODEL, extractListing } from "@/lib/extraction/extract";
import type { PipelineDeps } from "@/lib/extraction/pipeline";
import { type FixtureWorld, fixtureTransport } from "@/lib/instagram/fixtures";
import { fetchTransport, GraphClient } from "@/lib/instagram/graph";

export interface JobOptions {
  dryRun?: boolean;
  /** Ignore poll intervals and run every active source. */
  force?: boolean;
  /** Only these handles (usernames or hashtags). */
  only?: string[];
  /** Max raw_posts per process-posts run. */
  limit?: number;
  now?: Date;
  log?: (message: string) => void;
}

export interface JobDeps {
  /** "fixtures" only touches sources whose handle ends in .demo / _demo. */
  mode: "live" | "fixtures";
  graph(): GraphClient;
  igUserId(): string;
  token(): string;
  appId(): string | null;
  extract(): PipelineDeps["extract"];
}

export function createJobDeps(
  env: ServerEnv,
  options: { fixtures?: FixtureWorld; extract?: PipelineDeps["extract"] } = {},
): JobDeps {
  let graph: GraphClient | undefined;
  let extract: PipelineDeps["extract"] | undefined = options.extract;
  const world = options.fixtures;

  const instagram = () => requireKeys(env, ["IG_LONG_LIVED_TOKEN", "IG_BUSINESS_USER_ID"]);

  return {
    mode: world ? "fixtures" : "live",
    graph() {
      if (graph) return graph;
      graph = world
        ? new GraphClient({
            token: "fixture-token",
            appId: "fx_app",
            appSecret: "fixture-secret",
            transport: fixtureTransport(world),
            sleep: async () => {},
          })
        : new GraphClient({
            token: instagram().IG_LONG_LIVED_TOKEN,
            appId: env.META_APP_ID,
            appSecret: env.META_APP_SECRET,
            transport: fetchTransport(env.META_GRAPH_VERSION),
          });
      return graph;
    },
    igUserId: () => (world ? world.igUserId : instagram().IG_BUSINESS_USER_ID),
    token: () => (world ? "fixture-token" : instagram().IG_LONG_LIVED_TOKEN),
    appId: () => (world ? "fx_app" : (env.META_APP_ID ?? null)),
    extract() {
      if (extract) return extract;
      const { ANTHROPIC_API_KEY } = requireKeys(env, ["ANTHROPIC_API_KEY"]);
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const model = env.ANTHROPIC_MODEL_EXTRACTION ?? DEFAULT_EXTRACTION_MODEL;
      extract = (input) => extractListing(input, { client, model });
      return extract;
    },
  };
}
