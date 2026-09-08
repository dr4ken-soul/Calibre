/**
 * DreamDEX adapter interface.
 *
 * A real DreamDEX deployment would implement this against its indexer or
 * on-chain contracts. No public DreamDEX testnet API or contract addresses were
 * available while building Calibre, so the deterministic fallback generator in
 * this package provides a clearly labeled stand-in. Every fallback response
 * carries source "deterministic-fallback" so the UI can label it honestly.
 */

import type { MarketSnapshot, Settlement } from "@calibre/domain";
import type { MarketSnapshotWire } from "@calibre/validation";

export interface ListMarketsQuery {
  asset?: string;
  status?: MarketSnapshot["status"];
  expiryBefore?: number;
  limit?: number;
  cursor?: string | null;
}

export interface ListMarketsResult {
  markets: MarketSnapshot[];
  nextCursor: string | null;
}

export interface DreamDexAdapter {
  readonly sourceLabel: string;
  listMarkets(query: ListMarketsQuery): Promise<ListMarketsResult>;
  getMarket(marketId: string): Promise<MarketSnapshot | null>;
  getSettlement(marketId: string): Promise<Settlement | null>;
}

/** Live HTTP adapter configuration. baseUrl points at a DreamDEX compatible API. */
export interface HttpAdapterConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface WireMarketResponse {
  markets?: MarketSnapshotWire[];
  nextCursor?: string | null;
}

export interface WireSettlementResponse extends Partial<MarketSnapshotWire> {
  outcome?: "up" | "down" | null;
  closingPrice?: string | null;
  resolvedAt?: number | null;
}
