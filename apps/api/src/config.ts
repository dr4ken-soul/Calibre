import type { AiProvider } from "./services/audit-engine.js";
import { GroqProvider } from "./services/groq.js";

export interface AppConfig {
  port: number;
  allowedOrigin: string | null;
  dataDir: string;
  rpcUrl: string;
  chainId: number;
  dreamdexApiUrl: string | null;
  ai: AiProvider | null;
  audit: {
    minEdgeBp: bigint;
    minConfidenceBp: bigint;
    maxSlippageBp: bigint;
    minSecondsToExpiry: number;
    staleAfterMs: number;
  };
  auditRateLimitPerMinute: number;
  settlementPollMs: number;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") return undefined;
  return value;
}

function envNumber(name: string, fallback: number): number {
  const raw = env(name);
  const parsed = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBp(name: string, fallback: number): bigint {
  const raw = env(name);
  if (raw === undefined) return BigInt(Math.round(fallback * 10_000));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return BigInt(Math.round(fallback * 10_000));
  return BigInt(Math.round(parsed * 10_000));
}

export function loadConfig(overrides?: {
  dataDir?: string;
  ai?: AiProvider | null;
  store?: unknown;
}): AppConfig {
  const aiOverride = overrides?.ai !== undefined ? overrides.ai : undefined;
  let ai: AiProvider | null = null;
  const apiKey = env("AI_API_KEY");
  if (aiOverride !== undefined) {
    ai = aiOverride;
  } else if (apiKey) {
    const model = env("AI_MODEL") ?? "llama-3.1-8b-instant";
    ai = new GroqProvider({ apiKey, model });
  }

  return {
    port: envNumber("API_PORT", 8787),
    allowedOrigin: env("ALLOWED_ORIGIN") ?? null,
    dataDir: overrides?.dataDir ?? env("DATA_DIR") ?? "data",
    rpcUrl: env("RPC_URL") ?? "https://dream-rpc.somnia.network",
    chainId: envNumber("VITE_CHAIN_ID", 50312),
    dreamdexApiUrl: env("DREAMDEX_API_URL") ?? null,
    ai,
    audit: {
      minEdgeBp: envBp("AUDIT_MIN_EDGE", 0.05),
      minConfidenceBp: envBp("AUDIT_MIN_CONFIDENCE", 0.65),
      maxSlippageBp: envBp("AUDIT_MAX_SLIPPAGE", 0.02),
      minSecondsToExpiry: envNumber("AUDIT_MIN_SECONDS_TO_EXPIRY", 120),
      staleAfterMs: envNumber("STALE_AFTER_MS", 90_000),
    },
    auditRateLimitPerMinute: envNumber("AUDIT_RATE_LIMIT_PER_MINUTE", 30),
    settlementPollMs: envNumber("SETTLEMENT_POLL_MS", 30_000),
  };
}
