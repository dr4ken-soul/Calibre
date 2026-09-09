import { describe, expect, it } from "vitest";
import { HttpAdapter, HTTP_SOURCE } from "../src/http.js";
import { domainSnapshotToWire, marketSnapshotSchema, wireSnapshotToDomain } from "@calibre/validation";
import { generateSnapshot } from "../src/fallback.js";
import { resolveAdapter } from "../src/index.js";

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("http adapter", () => {
  it("parses a wire snapshot into a domain snapshot", async () => {
    const snap = generateSnapshot("BTC-UP-1", Date.now());
    const wire = domainSnapshotToWire(snap);
    const fetchImpl = (async () => okJson({ markets: [wire], nextCursor: null })) as unknown as typeof fetch;
    const adapter = new HttpAdapter({ baseUrl: "https://example.test", fetchImpl });
    const result = await adapter.listMarkets({});
    expect(result.markets.length).toBe(1);
    const back = wireSnapshotToDomain(marketSnapshotSchema.parse(wire));
    expect(back.marketId).toBe(snap.marketId);
    expect(result.markets[0]!.impliedProbabilityBp).toBe(back.impliedProbabilityBp);
  });

  it("throws on HTTP errors instead of fabricating data", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const adapter = new HttpAdapter({ baseUrl: "https://example.test", fetchImpl });
    await expect(adapter.listMarkets({})).rejects.toThrow();
  });

  it("throws on schema violations", async () => {
    const fetchImpl = (async () =>
      okJson({ markets: [{ marketId: "x", status: "bogus" }] })) as unknown as typeof fetch;
    const adapter = new HttpAdapter({ baseUrl: "https://example.test", fetchImpl });
    await expect(adapter.listMarkets({})).rejects.toThrow();
  });

  it("binds the default fetch to globalThis so browsers do not throw Illegal invocation", async () => {
    const originalFetch = globalThis.fetch;
    const receiverStrictFetch = function (this: unknown): Response {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return okJson({ markets: [], nextCursor: null });
    };
    globalThis.fetch = receiverStrictFetch as unknown as typeof fetch;
    try {
      const adapter = new HttpAdapter({ baseUrl: "https://example.test" });
      const result = await adapter.listMarkets({});
      expect(result.markets).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves to the live adapter when a base url is configured", () => {
    const live = resolveAdapter({ liveBaseUrl: "https://dreamdex.example" });
    expect(live.usingLive).toBe(true);
    expect(live.sourceLabel).toBe(HTTP_SOURCE);
  });

  it("resolves to the fallback adapter without a base url", () => {
    const fallback = resolveAdapter({});
    expect(fallback.usingLive).toBe(false);
    expect(fallback.sourceLabel).toBe("deterministic-fallback");
  });
});
