/**
 * Web data layer.
 *
 * Talks to the Calibre API when available. When the API is not running, the
 * deterministic fallback adapter runs in the browser so the full product loop
 * stays demonstrable offline. Every response carries its source label so the UI
 * can render the Live or deterministic-fallback badge honestly.
 */

import {
  FALLBACK_SOURCE,
  generateSnapshot,
  resolveAdapter,
  type DreamDexAdapter,
} from "@calibre/dreamdex-adapter";
import {
  auditResultSchema,
  domainAuditToWire,
  domainSnapshotToWire,
  domainTradeToWire,
  learnMetricsSchema,
  marketsQuerySchema,
  type AuditResultWire,
  type LearnMetricsWire,
  type MarketSnapshotWire,
  type TradeRecordWire,
} from "@calibre/validation";
import type { AuditResult, MarketSnapshot } from "@calibre/domain";
import { API_URL, DREAMDEX_INDEXER_URL, DREAMDEX_LIVE_URL } from "../config.js";

export interface Sourced<T> {
  data: T;
  source: string;
  time: number;
}

export interface ApiStatus {
  mode: "api" | "local-fallback";
  sourceLabel: string;
}

const { adapter: browserAdapter } = resolveAdapter({
  indexerUrl: DREAMDEX_INDEXER_URL ?? undefined,
  liveBaseUrl: DREAMDEX_LIVE_URL ?? undefined,
});

async function fetchFromApi<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!API_URL) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    clearTimeout(timer);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new ApiError(response.status, body?.error?.message ?? `Request failed (${response.status})`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Network failure: API unreachable, caller decides fallback.
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getApiStatus(): Promise<ApiStatus> {
  if (API_URL) {
    const health = await fetchFromApi<{ status: string }>("/api/health");
    if (health !== null) {
      return { mode: "api", sourceLabel: "calibre-api" };
    }
  }
  return { mode: "local-fallback", sourceLabel: browserAdapter.sourceLabel };
}

export async function listMarkets(query: {
  asset?: string;
  status?: string;
  expiryBefore?: number;
  expiryAfter?: number;
  limit?: number;
}): Promise<Sourced<MarketSnapshotWire[]>> {
  const parsed = marketsQuerySchema.safeParse(query);
  const qs = parsed.success
    ? new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";
  if (API_URL) {
    const result = await fetchFromApi<{ markets: MarketSnapshotWire[]; source: string; time: number }>(
      `/api/markets${qs ? `?${qs}` : ""}`,
    );
    if (result !== null) {
      return { data: result.markets, source: result.source, time: result.time };
    }
  }
  const local = await browserAdapter.listMarkets({
    ...query,
    status: query.status as MarketSnapshot["status"] | undefined,
  });
  return {
    data: local.markets.map(domainSnapshotToWire),
    source: local.markets[0]?.source ?? FALLBACK_SOURCE,
    time: Date.now(),
  };
}

export async function getMarket(marketId: string): Promise<Sourced<MarketSnapshotWire> | null> {
  if (API_URL) {
    const result = await fetchFromApi<{ market: MarketSnapshotWire; source: string; time: number }>(
      `/api/markets/${encodeURIComponent(marketId)}`,
    );
    if (result !== null) {
      return { data: result.market, source: result.source, time: result.time };
    }
  }
  const snap = await browserAdapter.getMarket(marketId);
  if (!snap) return null;
  return { data: domainSnapshotToWire(snap), source: snap.source, time: Date.now() };
}

export async function getSettlement(marketId: string): Promise<
  Sourced<{ status: string; outcome: string | null; closingPrice: string | null; resolvedAt: number | null }> | null
> {
  if (API_URL) {
    const result = await fetchFromApi<{
      settlement: { status: string; outcome: string | null; closingPrice: string | null; resolvedAt: number | null };
      source: string;
      time: number;
    }>(`/api/markets/${encodeURIComponent(marketId)}/settlement`);
    if (result !== null) {
      return { data: result.settlement, source: result.source, time: result.time };
    }
  }
  const settlement = await browserAdapter.getSettlement(marketId);
  if (!settlement) return null;
  return {
    data: {
      status: settlement.status,
      outcome: settlement.outcome,
      closingPrice: settlement.closingPrice,
      resolvedAt: settlement.resolvedAt,
    },
    source: settlement.source,
    time: settlement.observedAt,
  };
}

export async function runAudit(marketId: string): Promise<Sourced<AuditResultWire>> {
  if (API_URL) {
    const result = await fetchFromApi<{ audit: AuditResultWire }>("/api/audits", {
      method: "POST",
      body: JSON.stringify({ marketId }),
    });
    if (result !== null) {
      return { data: result.audit, source: "calibre-api", time: Date.now() };
    }
  }
  // Local deterministic audit, same engine shape as the server.
  const { estimateProbability, evaluateGuards, buildAudit, DEFAULT_GUARD_THRESHOLDS } = await import(
    "@calibre/domain"
  );
  const snap = await browserAdapter.getMarket(marketId);
  if (!snap) throw new ApiError(404, "Market not found");
  const now = Date.now();
  const estimate = estimateProbability(snap, now);
  const audit: AuditResult = buildAudit({
    auditId: `local_${now.toString(36)}`,
    snapshot: snap,
    estimate,
    guards: [],
    thresholds: { minEdgeBp: DEFAULT_GUARD_THRESHOLDS.minEdgeBp, minConfidenceBp: DEFAULT_GUARD_THRESHOLDS.minConfidenceBp },
    modelVersion: "calibre-estimate-v1",
    mode: "deterministic",
    source: snap.source,
    createdAt: now,
  });
  const guards = evaluateGuards({ snapshot: snap, now, thresholds: DEFAULT_GUARD_THRESHOLDS }, audit);
  const withGuards = { ...audit, guards };
  const rebuilt = buildAudit({
    auditId: withGuards.auditId,
    snapshot: snap,
    estimate,
    guards,
    thresholds: { minEdgeBp: DEFAULT_GUARD_THRESHOLDS.minEdgeBp, minConfidenceBp: DEFAULT_GUARD_THRESHOLDS.minConfidenceBp },
    modelVersion: "calibre-estimate-v1",
    mode: "deterministic",
    source: snap.source,
    createdAt: now,
  });
  const parsed = auditResultSchema.parse(domainAuditToWire(rebuilt));
  return { data: parsed, source: snap.source, time: now };
}

export async function prepareTrade(input: {
  auditId: string;
  amount: string;
  walletAddress: string;
}): Promise<Sourced<TradeRecordWire> & { approvalTx: { to: string; value: string; data: string } | null }> {
  if (API_URL) {
    const result = await fetchFromApi<{
      trade: TradeRecordWire;
      approvalTx: { to: string; value: string; data: string } | null;
    }>("/api/trades/prepare", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (result !== null) {
      return {
        data: result.trade,
        source: "calibre-api",
        time: Date.now(),
        approvalTx: result.approvalTx,
      };
    }
    throw new ApiError(503, "API unavailable for trade preparation");
  }
  throw new ApiError(400, "API must be running to prepare guarded trades");
}

export async function confirmTrade(input: {
  tradeId: string;
  txHash: string;
  walletAddress: string;
}): Promise<Sourced<TradeRecordWire>> {
  if (API_URL) {
    const result = await fetchFromApi<{ trade: TradeRecordWire }>("/api/trades/confirm", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (result !== null) {
      return { data: result.trade, source: "calibre-api", time: Date.now() };
    }
    throw new ApiError(503, "API unavailable to confirm a trade");
  }
  throw new ApiError(400, "API must be running to confirm trades");
}

export interface HistoryRow {
  audits: AuditResultWire[];
  trades: TradeRecordWire[];
  calibration: {
    auditId: string;
    marketId: string;
    decision: string;
    calibreProbability: string;
    outcome: string | null;
    settled: boolean;
    outcomeErrorBp: string | null;
    settledAt: number | null;
  }[];
}

export async function getHistory(): Promise<Sourced<HistoryRow> | null> {
  if (API_URL) {
    const result = await fetchFromApi<HistoryRow & { time: number }>("/api/history");
    if (result !== null) {
      return { data: result, source: "calibre-api", time: result.time };
    }
  }
  return null;
}

export async function getLearnMetrics(since: number, until: number): Promise<LearnMetricsWire | null> {
  if (API_URL) {
    const result = await fetchFromApi<LearnMetricsWire>(
      `/api/learn?since=${since}&until=${until}`,
    );
    if (result !== null) {
      return learnMetricsSchema.safeParse(result).success ? result : null;
    }
  }
  return null;
}

export { FALLBACK_SOURCE, generateSnapshot };
export type { DreamDexAdapter };
