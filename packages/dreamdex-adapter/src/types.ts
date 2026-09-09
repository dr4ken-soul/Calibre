/**
 * DreamDEX adapter interface.
 *
 * Implementations read event-contract data from DreamDEX infrastructure: the
 * live GraphQL indexer adapter reads the public indexer, the HTTP adapter
 * targets a DreamDEX compatible REST API, and the deterministic fallback
 * generator provides a clearly labeled offline stand-in. Every response
 * carries a source label so the UI can label data honestly.
 */

import type { MarketSnapshot, Settlement } from "@calibre/domain";
import type { MarketSnapshotWire } from "@calibre/validation";

export interface ListMarketsQuery {
  asset?: string;
  status?: MarketSnapshot["status"];
  expiryBefore?: number;
  expiryAfter?: number;
  limit?: number;
  cursor?: string | null;
}

export interface ListMarketsResult {
  markets: MarketSnapshot[];
  nextCursor: string | null;
}

/** On-chain execution details for a market, read from the indexer row. */
export interface ExecutionInfo {
  /** BinaryPool contract address that accepts placeBinaryOrder. */
  poolAddress: string;
  /** Collateral token (tUSDC on testnet) buyers must approve to the pool. */
  collateral: string | null;
  /** ERC-6909 token id of the YES outcome. */
  yesTokenId: string | null;
  /** ERC-6909 token id of the NO outcome. */
  noTokenId: string | null;
  /** Market expiry in epoch seconds; order expiry is capped at this. */
  expirySec: number;
  /** Indexer row id used to correlate order book rows. */
  rowId: string;
}

export interface DreamDexAdapter {
  readonly sourceLabel: string;
  listMarkets(query: ListMarketsQuery): Promise<ListMarketsResult>;
  getMarket(marketId: string): Promise<MarketSnapshot | null>;
  getSettlement(marketId: string): Promise<Settlement | null>;
  /** Optional: live adapters expose on-chain execution details. */
  getExecutionInfo?(marketId: string): Promise<ExecutionInfo | null>;
}

/** Live HTTP adapter configuration. baseUrl points at a DreamDEX compatible API. */
export interface HttpAdapterConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Live GraphQL indexer adapter configuration. indexerUrl points at the DreamDEX GraphQL indexer. */
export interface GraphqlAdapterConfig {
  indexerUrl: string;
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
