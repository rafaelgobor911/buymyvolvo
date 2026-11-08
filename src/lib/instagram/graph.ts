/**
 * Minimal typed client for the Meta Graph API (Instagram API with Facebook Login).
 *
 * - Native fetch + Zod, no SDK. The transport is swappable: the network in
 *   production, fictitious fixtures in development and tests.
 * - The user token goes in the Authorization header, never in the URL, so it
 *   cannot leak through logs; `appsecret_proof` is sent when the app secret is
 *   configured (Meta recommends it for server-side calls).
 * - Reads both usage headers: Business Discovery and Hashtag Search follow
 *   Platform Rate Limiting (X-App-Usage); other Instagram calls report the
 *   Business Use Case header (X-Business-Use-Case-Usage).
 * - Errors are classified; transient errors and rate limits are retried with
 *   exponential backoff, everything else fails fast.
 */
import { createHmac } from "node:crypto";

import { z } from "zod";

import { DEFAULT_GRAPH_VERSION } from "@/lib/env/schema";

export interface GraphRequest {
  /** Path after the version, e.g. "17841400000000000" or "ig_hashtag_search". */
  path: string;
  params: Record<string, string>;
  headers: Record<string, string>;
}

export interface GraphResponse {
  status: number;
  body: unknown;
  headers: { get(name: string): string | null };
}

export type Transport = (request: GraphRequest) => Promise<GraphResponse>;

/** Real network transport. */
export function fetchTransport(version = DEFAULT_GRAPH_VERSION): Transport {
  return async ({ path, params, headers }) => {
    const url = new URL(`https://graph.facebook.com/${version}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body, headers: res.headers };
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type GraphErrorKind =
  | "rate_limit"
  | "auth"
  | "permission"
  | "not_found"
  | "transient"
  | "invalid_request"
  | "invalid_response";

/** Platform (4, 17, 32, 613) and Business Use Case (80000–80014) throttling. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const isBucThrottle = (code: number) => code >= 80000 && code <= 80014;

const MetaError = z.object({
  message: z.string().optional(),
  type: z.string().optional(),
  code: z.number().optional(),
  error_subcode: z.number().optional(),
  is_transient: z.boolean().optional(),
  error_user_msg: z.string().optional(),
  fbtrace_id: z.string().optional(),
});
type MetaError = z.infer<typeof MetaError>;

export function classifyError(status: number, error: MetaError | undefined): GraphErrorKind {
  const code = error?.code;
  if (code !== undefined && (RATE_LIMIT_CODES.has(code) || isBucThrottle(code))) {
    return "rate_limit";
  }
  if (code === 190 || code === 102) return "auth";
  // "Invalid user id": the username does not exist, is personal or age-gated.
  if (code === 110 || error?.error_subcode === 2207013) return "not_found";
  if (code === 100 && error?.error_subcode === 33) return "not_found";
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) return "permission";
  if (error?.is_transient || code === 1 || code === 2 || status >= 500) return "transient";
  return "invalid_request";
}

export class GraphError extends Error {
  constructor(
    readonly kind: GraphErrorKind,
    message: string,
    readonly details: { status?: number; code?: number; subcode?: number; fbtraceId?: string } = {},
  ) {
    super(message);
    this.name = "GraphError";
  }

  get retryable() {
    return this.kind === "transient" || this.kind === "rate_limit";
  }
}

// ---------------------------------------------------------------------------
// Usage headers
// ---------------------------------------------------------------------------

export interface GraphUsage {
  /** X-App-Usage: percentages of the app's hourly allowance. */
  app?: { call_count?: number; total_cputime?: number; total_time?: number };
  /** X-Business-Use-Case-Usage: per business object, per use case. */
  businessUseCase?: Record<
    string,
    Array<{
      type?: string;
      call_count?: number;
      total_cputime?: number;
      total_time?: number;
      estimated_time_to_regain_access?: number;
    }>
  >;
}

function parseJsonHeader(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function readUsage(headers: GraphResponse["headers"]): GraphUsage {
  return {
    app: parseJsonHeader(headers.get("x-app-usage")) as GraphUsage["app"],
    businessUseCase: parseJsonHeader(
      headers.get("x-business-use-case-usage"),
    ) as GraphUsage["businessUseCase"],
  };
}

/** Highest usage percentage reported by either header (0–100+). */
export function usagePercent(usage: GraphUsage): number {
  const values = [
    usage.app?.call_count,
    usage.app?.total_cputime,
    usage.app?.total_time,
    ...Object.values(usage.businessUseCase ?? {}).flatMap((entries) =>
      entries.flatMap((e) => [e.call_count, e.total_cputime, e.total_time]),
    ),
  ].filter((v): v is number => typeof v === "number");
  return values.length ? Math.max(...values) : 0;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface GraphClientOptions {
  token: string;
  /** Enables appsecret_proof and app-token calls (debug_token). */
  appId?: string;
  appSecret?: string;
  transport: Transport;
  /** Retries after the first attempt. */
  maxRetries?: number;
  /** Backoff base in ms for transient errors; rate limits use 5× this. */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class GraphClient {
  /** Usage reported by the last response (for logs and early stop). */
  lastUsage: GraphUsage = {};
  /** Number of HTTP requests made (including retries). */
  requests = 0;
  private readonly proof?: string;

  constructor(private readonly options: GraphClientOptions) {
    if (options.appSecret) {
      this.proof = createHmac("sha256", options.appSecret).update(options.token).digest("hex");
    }
  }

  /** True when either usage header is at or above `threshold` percent. */
  nearLimit(threshold = 90): boolean {
    return usagePercent(this.lastUsage) >= threshold;
  }

  /** GET with the user token. */
  get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const query = this.proof ? { ...params, appsecret_proof: this.proof } : params;
    return this.request(path, query, `Bearer ${this.options.token}`, schema);
  }

  /** GET with the app token (APP_ID|APP_SECRET), e.g. debug_token. */
  async getAsApp<T>(
    path: string,
    params: Record<string, string>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const { appId, appSecret } = this.options;
    if (!appId || !appSecret) {
      throw new GraphError("invalid_request", "META_APP_ID and META_APP_SECRET are required.");
    }
    return this.request(path, params, `Bearer ${appId}|${appSecret}`, schema);
  }

  private async request<T>(
    path: string,
    params: Record<string, string>,
    authorization: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const maxRetries = this.options.maxRetries ?? 3;
    const base = this.options.backoffMs ?? 1000;
    const sleep = this.options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

    for (let attempt = 0; ; attempt++) {
      let error: GraphError;
      try {
        this.requests++;
        const res = await this.options.transport({
          path,
          params,
          headers: { Authorization: authorization },
        });
        this.lastUsage = readUsage(res.headers);
        const body = res.body as { error?: unknown } | null;
        if (res.status >= 200 && res.status < 300 && body && !body.error) {
          const parsed = schema.safeParse(body);
          if (parsed.success) return parsed.data;
          throw new GraphError(
            "invalid_response",
            `Unexpected response for ${path}: ${parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`,
            { status: res.status },
          );
        }
        const meta = MetaError.safeParse(body?.error);
        const e = meta.success ? meta.data : undefined;
        error = new GraphError(
          classifyError(res.status, e),
          e?.message ?? `HTTP ${res.status} from the Graph API`,
          {
            status: res.status,
            code: e?.code,
            subcode: e?.error_subcode,
            fbtraceId: e?.fbtrace_id,
          },
        );
      } catch (caught) {
        if (caught instanceof GraphError) error = caught;
        else {
          // Network failure (DNS, reset, timeout): worth a retry.
          const message = caught instanceof Error ? caught.message : String(caught);
          error = new GraphError("transient", `Network error calling the Graph API: ${message}`);
        }
      }
      if (!error.retryable || attempt >= maxRetries) throw error;
      const factor = error.kind === "rate_limit" ? 5 : 1;
      const jitter = 0.8 + Math.random() * 0.4;
      await sleep(Math.round(base * factor * 2 ** attempt * jitter));
    }
  }
}
