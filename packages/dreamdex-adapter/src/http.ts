/**
 * Live HTTP adapter for a DreamDEX compatible REST API.
 *
 * Used only when DREAMDEX_API_URL / VITE_DREAMDEX_API_URL is configured and
 * reachable. Any failure (network, schema, timeout) propagates so callers can
 * fall back explicitly. This adapter never fabricates data: on error it throws.
 */

import type { MarketSnapshot, Settlement } from "@calibre/domain";
import {
  domainSettlementToWire,
  domainSnapshotToWire,
  marketSnapshotSchema,
  settlementSchema,
  wireSnapshotToDomain,
} from "@calibre/validation";
import type {
  DreamDexAdapter,
  HttpAdapterConfig,
  ListMarketsQuery,
  ListMarketsResult,
  WireMarketResponse,
} from "./types.js";

export const HTTP_SOURCE = "dreamdex-http";

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

export class HttpAdapter implements DreamDexAdapter {
  readonly sourceLabel = HTTP_SOURCE;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: HttpAdapterConfig) {
    this.baseUrl = config.baseUrl;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 8_000;
  }

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`DreamDEX HTTP ${response.status} for ${path}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async listMarkets(query: ListMarketsQuery): Promise<ListMarketsResult> {
    const params = new URLSearchParams();
    if (query.asset) params.set("asset", query.asset);
    if (query.status) params.set("status", query.status);
    if (query.expiryBefore !== undefined) params.set("expiryBefore", String(query.expiryBefore));
    if (query.expiryAfter !== undefined) params.set("expiryAfter", String(query.expiryAfter));
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    if (query.cursor) params.set("cursor", query.cursor);
    const qs = params.toString();
    const wire = await this.request<WireMarketResponse>(`/markets${qs ? `?${qs}` : ""}`);
    const markets = (wire.markets ?? []).map((m) => {
      const parsed = marketSnapshotSchema.parse(m);
      return wireSnapshotToDomain(parsed);
    });
    return { markets, nextCursor: wire.nextCursor ?? null };
  }

  async getMarket(marketId: string): Promise<MarketSnapshot | null> {
    try {
      const wire = await this.request<WireMarketResponse[`markets`] extends (infer T)[] | undefined ? T : never>(
        `/markets/${encodeURIComponent(marketId)}`,
      );
      const parsed = marketSnapshotSchema.parse(wire);
      return wireSnapshotToDomain(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) return null;
      throw error;
    }
  }

  async getSettlement(marketId: string): Promise<Settlement | null> {
    const wire = await this.request<Record<string, unknown>>(
      `/markets/${encodeURIComponent(marketId)}/settlement`,
    );
    const parsed = settlementSchema.parse({ ...wire, marketId });
    const snapshot: Settlement = {
      marketId: parsed.marketId,
      status: parsed.status,
      outcome: parsed.outcome,
      closingPrice: parsed.closingPrice,
      resolvedAt: parsed.resolvedAt,
      source: parsed.source,
      observedAt: parsed.observedAt,
    };
    return snapshot;
  }
}

// Re-export wire helpers so API consumers can serialize domain objects.
export { domainSnapshotToWire, domainSettlementToWire };
