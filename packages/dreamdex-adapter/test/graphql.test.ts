import { describe, expect, it } from "vitest";
import { GraphqlAdapter, GRAPHQL_SOURCE } from "../src/graphql.js";
import { resolveAdapter } from "../src/index.js";

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const marketRow = {
  id: "0x0000000000000000000000000000000000000000000000000000000000000130",
  marketId: "0x0000000000000000000000000000000000000000000000000000000000000130",
  question: "ETH closes at or above its opening price",
  asset: "ETH",
  strike: "0",
  intervalSec: "900",
  tradingStart: "1784666700",
  expiry: "1784667600",
  clobStatus: "Trading",
  lastPrice: "435000",
  markPrice: null,
  openInterest: null,
  cumulativeQuoteVolume: "45667000",
  tradeCount: "75",
  collateral: "0x70a86d8842fb63c4ad2b7cdddf530ebf1bb25d8e",
  binaryPoolAddress: "0x9df243eab4fbcbcefee61b8069cebac50d022133",
  yesTokenId: "4258225140687331109193728230373299860755214841483528231299799215767808",
  noTokenId: "4258225140687331109193728230373299860755214841483528231299799215767809",
  finalized: false,
  voided: false,
  winningOutcome: null,
  resolvedAtTimestamp: null,
  createdAtTimestamp: "1784666700",
};

const orderRows = [
  { orderId: "1", side: "BUY_YES", isBid: true, price: "430000", quantityRemaining: "61050000", status: "Open", rested: true },
  { orderId: "2", side: "SELL_YES", isBid: false, price: "445000", quantityRemaining: "27750000", status: "Open", rested: true },
  { orderId: "3", side: "SELL_YES", isBid: false, price: "460000", quantityRemaining: "22250000", status: "Open", rested: true },
  { orderId: "4", side: "SELL_YES", isBid: false, price: "445000", quantityRemaining: "10000000", status: "Open", rested: true },
  { orderId: "5", side: "BUY_YES", isBid: true, price: "490000", quantityRemaining: "5000000", status: "Cancelled", rested: true },
];

function stubFetch(responses: unknown[]): typeof fetch {
  let call = 0;
  return (async () => {
    const body = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    return okJson(body);
  }) as unknown as typeof fetch;
}

describe("graphql adapter", () => {
  it("maps an indexer row to a domain snapshot with a merged order book", async () => {
    const fetchImpl = stubFetch([
      { data: { Market: [marketRow] } },
      { data: { Order: orderRows } },
    ]);
    const adapter = new GraphqlAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql", fetchImpl });
    const snapshot = await adapter.getMarket(marketRow.marketId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.marketId).toBe(marketRow.marketId);
    expect(snapshot!.status).toBe("trading");
    expect(snapshot!.source).toBe(GRAPHQL_SOURCE);
    expect(snapshot!.impliedProbabilityBp).toBe(4350n);
    expect(snapshot!.expiryAt).toBe(1784667600000);
    expect(snapshot!.volume24h).toBe("45.667");
    // Cancelled orders are excluded, same-price asks merged.
    expect(snapshot!.orderBook.bids.length).toBe(1);
    expect(snapshot!.orderBook.bids[0]!.priceBp).toBe(4300n);
    expect(snapshot!.orderBook.asks.length).toBe(2);
    expect(snapshot!.orderBook.asks[0]!.priceBp).toBe(4450n);
    expect(snapshot!.orderBook.asks[0]!.size).toBe(37750000n);
  });

  it("filters by binary type and asset in listMarkets", async () => {
    const fetchImpl = stubFetch([{ data: { Market: [marketRow] } }]);
    const adapter = new GraphqlAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql", fetchImpl });
    const result = await adapter.listMarkets({ asset: "eth", status: "trading" });
    expect(result.markets.length).toBe(1);
    expect(result.markets[0]!.asset).toBe("ETH");
  });

  it("reads execution info from the row", async () => {
    const fetchImpl = stubFetch([{ data: { Market: [marketRow] } }]);
    const adapter = new GraphqlAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql", fetchImpl });
    const info = await adapter.getExecutionInfo!(marketRow.marketId);
    expect(info).not.toBeNull();
    expect(info!.poolAddress).toBe("0x9df243eab4fbcbcefee61b8069cebac50d022133");
    expect(info!.collateral).toBe("0x70a86d8842fb63c4ad2b7cdddf530ebf1bb25d8e");
    expect(info!.expirySec).toBe(1784667600);
  });

  it("maps winningOutcome 0 to up in settlement", async () => {
    const resolvedRow = {
      ...marketRow,
      clobStatus: "Finalized",
      finalized: true,
      winningOutcome: 0,
      resolvedAtTimestamp: "1784667700",
      closingMid: "1000000",
    };
    const fetchImpl = stubFetch([{ data: { Market: [resolvedRow] } }]);
    const adapter = new GraphqlAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql", fetchImpl });
    const settlement = await adapter.getSettlement(marketRow.marketId);
    expect(settlement).not.toBeNull();
    expect(settlement!.status).toBe("resolved");
    expect(settlement!.outcome).toBe("up");
    expect(settlement!.resolvedAt).toBe(1784667700000);
  });

  it("reports voided settlements with no outcome", async () => {
    const voidedRow = {
      ...marketRow,
      clobStatus: "Finalized",
      finalized: true,
      voided: true,
      winningOutcome: null,
      resolvedAtTimestamp: "1784667700",
    };
    const fetchImpl = stubFetch([{ data: { Market: [voidedRow] } }]);
    const adapter = new GraphqlAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql", fetchImpl });
    const settlement = await adapter.getSettlement(marketRow.marketId);
    expect(settlement!.status).toBe("voided");
    expect(settlement!.outcome).toBeNull();
  });

  it("throws on GraphQL errors instead of fabricating data", async () => {
    const fetchImpl = stubFetch([{ errors: [{ message: "field not found" }] }]);
    const adapter = new GraphqlAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql", fetchImpl });
    await expect(adapter.listMarkets({})).rejects.toThrow();
  });

  it("binds the default fetch to globalThis so browsers do not throw Illegal invocation", async () => {
    const originalFetch = globalThis.fetch;
    const receiverStrictFetch = function (this: unknown): Response {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return okJson({ data: { Market: [] } });
    };
    globalThis.fetch = receiverStrictFetch as unknown as typeof fetch;
    try {
      const adapter = new GraphqlAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql" });
      const result = await adapter.listMarkets({ asset: "eth" });
      expect(result.markets).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves to the graphql adapter when an indexer url is configured", () => {
    const live = resolveAdapter({ indexerUrl: "https://dev.smk.somnia.host/v1/graphql" });
    expect(live.usingLive).toBe(true);
    expect(live.sourceLabel).toBe(GRAPHQL_SOURCE);
  });

  it("prefers graphql over http when both are configured", () => {
    const live = resolveAdapter({
      indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
      liveBaseUrl: "https://stg.api.dreamdex.io/v0",
    });
    expect(live.sourceLabel).toBe(GRAPHQL_SOURCE);
  });

  it("falls back to the http adapter when only a base url is configured", () => {
    const live = resolveAdapter({ liveBaseUrl: "https://stg.api.dreamdex.io/v0" });
    expect(live.sourceLabel).toBe("dreamdex-http");
  });

  it("falls back to the deterministic adapter with no urls", () => {
    const fallback = resolveAdapter({});
    expect(fallback.usingLive).toBe(false);
    expect(fallback.sourceLabel).toBe("deterministic-fallback");
  });
});
