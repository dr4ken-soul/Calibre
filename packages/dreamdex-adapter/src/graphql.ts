/**
 * Live DreamDEX GraphQL indexer adapter.
 *
 * Reads Event Contract (BINARY) markets from the public DreamDEX indexer at
 * dev.smk.somnia.host/v1/graphql. The indexer is the real protocol feed: rows
 * come from on-chain events, prices are venue probabilities, and settlement
 * comes from the resolution events. This adapter never fabricates data: on
 * error it throws so callers can fall back explicitly.
 *
 * Unit conventions (verified live):
 * - timestamps on Market rows are epoch SECONDS
 * - probability prices (lastPrice, Order.price) are 1e6 fixed point; bp = value / 100
 * - quantities are 1e6 collateral units, matching the domain PRICE_UNIT
 * - Order.price is always the YES-side price, even for NO orders
 * - Order status vocabulary: Open, Closed, Filled, Cancelled, Expired; resting
 *   liquidity is status "Open" and rested true
 * - market status comes from clobStatus/finalized/voided on the row, never from timing
 */

import type { LifecycleStatus, MarketSnapshot, OrderBookLevel, Settlement, TradeDirection } from "@calibre/domain";
import type {
  DreamDexAdapter,
  ExecutionInfo,
  GraphqlAdapterConfig,
  ListMarketsQuery,
  ListMarketsResult,
} from "./types.js";

export const GRAPHQL_SOURCE = "dreamdex-indexer-live";

const MARKET_FIELDS = `
  id
  marketId
  question
  asset
  strike
  intervalSec
  tradingStart
  expiry
  clobStatus
  lastPrice
  markPrice
  openInterest
  cumulativeQuoteVolume
  tradeCount
  collateral
  binaryPoolAddress
  yesTokenId
  noTokenId
  finalized
  voided
  winningOutcome
  resolvedAtTimestamp
  createdAtTimestamp
`;

const ORDER_FIELDS = `
  orderId
  side
  isBid
  price
  quantityRemaining
  status
  rested
`;

interface IndexerMarketRow {
  id: string;
  marketId: string;
  question: string;
  asset: string | null;
  strike: string | null;
  intervalSec: string | null;
  tradingStart: string | null;
  expiry: string;
  clobStatus: string | null;
  lastPrice: string | null;
  markPrice: string | null;
  openInterest: string | null;
  cumulativeQuoteVolume: string | null;
  tradeCount: string | null;
  collateral: string | null;
  binaryPoolAddress: string | null;
  yesTokenId: string | null;
  noTokenId: string | null;
  finalized: boolean;
  voided: boolean;
  winningOutcome: number | null;
  resolvedAtTimestamp: string | null;
  createdAtTimestamp: string | null;
  closingMid: string | null;
}

interface IndexerOrderRow {
  orderId: string;
  side: string;
  isBid: boolean;
  price: string;
  quantityRemaining: string;
  status: string;
  rested: boolean;
}

function statusFromRow(row: Pick<IndexerMarketRow, "clobStatus" | "finalized" | "voided">): LifecycleStatus {
  if (row.voided) return "voided";
  if (row.finalized) return "resolved";
  switch (row.clobStatus) {
    case "Listed":
      return "listed";
    case "Trading":
      return "trading";
    case "Locked":
    case "Settling":
      return "locked";
    case "Resolved":
    case "Finalized":
      return "resolved";
    default:
      return "listed";
  }
}

function secToMs(value: string | null): number {
  if (!value) return 0;
  return Number(value) * 1000;
}

/** 1e6 fixed-point probability to basis points, e.g. 435000 -> 4350 bp. */
function priceToBp(value: string | null): bigint {
  if (!value) return 0n;
  return BigInt(value) / 100n;
}

function rawToDecimalString(value: string | null): string {
  if (!value) return "0";
  const n = BigInt(value);
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

interface GqlResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export class GraphqlAdapter implements DreamDexAdapter {
  readonly sourceLabel = GRAPHQL_SOURCE;
  private readonly indexerUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: GraphqlAdapterConfig) {
    this.indexerUrl = config.indexerUrl;
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.timeoutMs = config.timeoutMs ?? 8_000;
  }

  private async query<T>(document: string, variables: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.indexerUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: document, variables }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`DreamDEX indexer HTTP ${response.status}`);
      }
      const body = (await response.json()) as GqlResponse<T>;
      if (body.errors?.length) {
        throw new Error(`DreamDEX indexer GraphQL error: ${body.errors[0]!.message}`);
      }
      if (!body.data) {
        throw new Error("DreamDEX indexer returned no data");
      }
      return body.data;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildWhere(query: ListMarketsQuery): Record<string, unknown> {
    const where: Record<string, unknown> = { marketType: { _eq: "BINARY" } };
    if (query.asset) where.asset = { _eq: query.asset.toUpperCase() };
    const statusFilters: Record<string, unknown> = {};
    if (query.status === "trading") statusFilters.clobStatus = { _eq: "Trading" };
    if (query.status === "listed") statusFilters.clobStatus = { _eq: "Listed" };
    if (query.status === "locked") statusFilters.clobStatus = { _in: ["Locked", "Settling"] };
    if (query.status === "resolved" || query.status === "redeemed") {
      statusFilters.finalized = { _eq: true };
    }
    if (query.status === "voided") statusFilters.voided = { _eq: true };
    const expiry: Record<string, number> = {};
    if (query.expiryBefore !== undefined) expiry._lte = Math.floor(query.expiryBefore / 1000);
    if (query.expiryAfter !== undefined) expiry._gte = Math.floor(query.expiryAfter / 1000);
    if (Object.keys(expiry).length > 0) where.expiry = expiry;
    return Object.keys(statusFilters).length > 0
      ? { ...where, ...statusFilters }
      : where;
  }

  private async fetchOrderBook(rowId: string, observedAt: number): Promise<{
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    observedAt: number;
  }> {
    const data = await this.query<{ Order: IndexerOrderRow[] }>(
      `query ($where: Order_bool_exp, $limit: Int) {
        Order(where: $where, order_by: { price: desc }, limit: $limit) {
          ${ORDER_FIELDS}
        }
      }`,
      { where: { market_id: { _eq: rowId }, status: { _eq: "Open" }, rested: { _eq: true } }, limit: 60 },
    );
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    for (const order of data.Order ?? []) {
      // Defense in depth: the query filters server-side, but never trust a
      // cancelled or expired row as resting liquidity.
      if (order.status !== "Open" || !order.rested) continue;
      const level: OrderBookLevel = {
        priceBp: priceToBp(order.price),
        size: BigInt(order.quantityRemaining),
      };
      if (order.isBid) {
        const existing = bids.find((b) => b.priceBp === level.priceBp);
        if (existing) existing.size += level.size;
        else bids.push(level);
      } else {
        const existing = asks.find((a) => a.priceBp === level.priceBp);
        if (existing) existing.size += level.size;
        else asks.push(level);
      }
    }
    bids.sort((a, b) => Number(b.priceBp - a.priceBp));
    asks.sort((a, b) => Number(a.priceBp - b.priceBp));
    return { bids, asks, observedAt };
  }

  private async rowToSnapshot(row: IndexerMarketRow, now: number, withBook: boolean): Promise<MarketSnapshot> {
    const status = statusFromRow(row);
    let book = { bids: [] as OrderBookLevel[], asks: [] as OrderBookLevel[], observedAt: now };
    if (withBook && status === "trading") {
      try {
        book = await this.fetchOrderBook(row.id, now);
      } catch {
        // A failed book read must not lose the market row; empty book is honest.
      }
    }
    const impliedProbabilityBp = priceToBp(row.lastPrice);
    const strike = rawToDecimalString(row.strike);
    return {
      marketId: row.marketId,
      question: row.question,
      asset: row.asset ?? "UNKNOWN",
      strike,
      referencePrice: strike === "0" ? rawToDecimalString(row.markPrice) : strike,
      currentPrice: rawToDecimalString(row.markPrice),
      // Binary pools accept orders until expiry; tradingStart only marks the open.
      lockAt: secToMs(row.expiry),
      expiryAt: secToMs(row.expiry),
      status,
      impliedProbabilityBp,
      momentumBp: 0n,
      volume24h: rawToDecimalString(row.cumulativeQuoteVolume),
      openInterest: rawToDecimalString(row.openInterest),
      orderBook: book,
      source: this.sourceLabel,
      observedAt: now,
    };
  }

  async listMarkets(query: ListMarketsQuery): Promise<ListMarketsResult> {
    const now = Date.now();
    const limit = query.limit ?? 50;
    const offset = query.cursor ? Number(query.cursor) : 0;
    const document = `query ($where: Market_bool_exp, $limit: Int, $offset: Int) {
      Market(where: $where, order_by: { expiry: asc }, limit: $limit, offset: $offset) {
        ${MARKET_FIELDS}
      }
    }`;
    const data = await this.query<{ Market: IndexerMarketRow[] }>(document, {
      where: this.buildWhere(query),
      limit,
      offset,
    });
    const rows = data.Market ?? [];
    const markets = await Promise.all(
      rows.map(async (row) => this.rowToSnapshot(row, now, rows.length <= 12)),
    );
    const nextCursor = rows.length === limit ? String(offset + limit) : null;
    return { markets, nextCursor };
  }

  async getMarket(marketId: string): Promise<MarketSnapshot | null> {
    const now = Date.now();
    const document = `query ($where: Market_bool_exp, $limit: Int) {
      Market(where: $where, limit: $limit) {
        ${MARKET_FIELDS}
      }
    }`;
    const data = await this.query<{ Market: IndexerMarketRow[] }>(document, {
      where: { marketType: { _eq: "BINARY" }, marketId: { _eq: marketId } },
      limit: 1,
    });
    const row = data.Market?.[0];
    if (!row) return null;
    return this.rowToSnapshot(row, now, true);
  }

  async getExecutionInfo(marketId: string): Promise<ExecutionInfo | null> {
    const document = `query ($where: Market_bool_exp, $limit: Int) {
      Market(where: $where, limit: $limit) {
        id
        binaryPoolAddress
        collateral
        yesTokenId
        noTokenId
        expiry
      }
    }`;
    const data = await this.query<{ Market: IndexerMarketRow[] }>(document, {
      where: { marketType: { _eq: "BINARY" }, marketId: { _eq: marketId } },
      limit: 1,
    });
    const row = data.Market?.[0];
    if (!row?.binaryPoolAddress) return null;
    return {
      poolAddress: row.binaryPoolAddress,
      collateral: row.collateral,
      yesTokenId: row.yesTokenId,
      noTokenId: row.noTokenId,
      expirySec: Number(row.expiry),
      rowId: row.id,
    };
  }

  async getSettlement(marketId: string): Promise<Settlement | null> {
    const now = Date.now();
    const document = `query ($where: Market_bool_exp, $limit: Int) {
      Market(where: $where, limit: $limit) {
        marketId
        clobStatus
        finalized
        voided
        winningOutcome
        resolvedAtTimestamp
        strike
        closingMid
        lastPrice
      }
    }`;
    const data = await this.query<{ Market: IndexerMarketRow[] }>(document, {
      where: { marketType: { _eq: "BINARY" }, marketId: { _eq: marketId } },
      limit: 1,
    });
    const row = data.Market?.[0];
    if (!row) return null;
    const status = statusFromRow(row);
    if (status !== "resolved" && status !== "voided" && status !== "redeemed") {
      return {
        marketId,
        status,
        outcome: null,
        closingPrice: null,
        resolvedAt: null,
        source: this.sourceLabel,
        observedAt: now,
      };
    }
    if (row.voided) {
      return {
        marketId,
        status: "voided",
        outcome: null,
        closingPrice: null,
        resolvedAt: secToMs(row.resolvedAtTimestamp) || null,
        source: this.sourceLabel,
        observedAt: now,
      };
    }
    // winningOutcome 0 means YES (up) won, 1 means NO (down) won.
    const outcome: TradeDirection | null =
      row.winningOutcome === 0 ? "up" : row.winningOutcome === 1 ? "down" : null;
    const closing = row.closingMid ?? row.lastPrice;
    return {
      marketId,
      status,
      outcome,
      closingPrice: closing ? rawToDecimalString(closing) : null,
      resolvedAt: secToMs(row.resolvedAtTimestamp) || null,
      source: this.sourceLabel,
      observedAt: now,
    };
  }
}
