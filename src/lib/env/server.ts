import "server-only";

import { parseServerEnv, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;

/** Server-only secrets and settings, validated once on first use. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export { requireKeys } from "./schema";
