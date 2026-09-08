/**
 * Express app factory. All routes are registered here so tests can build the
 * app with in-memory stores and stub adapters. Validation uses the shared Zod
 * schemas. No secrets are returned by any route.
 */

import express, { type NextFunction, type Request, type Response } from "express";
import type { AuditResult, MarketSnapshot, Settlement } from "@calibre/domain";
import { canExecute, lifecycleLabel } from "@calibre/domain";
import type { DreamDexAdapter } from "@calibre/dreamdex-adapter";
import {
  auditRequestSchema,
  calibrationRowToWire,
  domainAuditToWire,
  domainSettlementToWire,
  domainSnapshotToWire,
  domainTradeToWire,
  historyQuerySchema,
  marketsQuerySchema,
  tradeConfirmRequestSchema,
  tradePrepareRequestSchema,
} from "@calibre/validation";
import type { AppConfig } from "./config.js";
import type { Store } from "./storage.js";
import { AuditEngine } from "./services/audit-engine.js";
import { HttpRpcClient, SOMNIA_CHAIN_ID, TradeService } from "./services/trade-service.js";
import { SettlementPoller } from "./services/settlement-poller.js";

let auditCounter = 0;
function newAuditId(now: number): string {
  auditCounter += 1;
  return `audit_${now.toString(36)}_${auditCounter.toString(36)}`;
}

export interface AppDeps {
  adapter: DreamDexAdapter;
  store: Store;
  config: AppConfig;
  now(): number;
}

export function createApp(deps: AppDeps) {
  const { adapter, store, config } = deps;
  const now = deps.now ?? Date.now;
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  // CORS, no credentials. Optional origin restriction.
  app.use((req, res, next) => {
    res.setHeader("access-control-allow-origin", config.allowedOrigin ?? "*");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Simple in-memory rate limiter for audits.
  const auditHits = new Map<string, number[]>();
  function rateLimit(key: string): boolean {
    const windowMs = 60_000;
    const max = config.auditRateLimitPerMinute;
    const t = now();
    const hits = (auditHits.get(key) ?? []).filter((ts) => t - ts < windowMs);
    if (hits.length >= max) {
      auditHits.set(key, hits);
      return false;
    }
    hits.push(t);
    auditHits.set(key, hits);
    return true;
  }

  function marketFromStoreOrAdapter(marketId: string): Promise<MarketSnapshot | null> {
    return adapter.getMarket(marketId);
  }

  const auditEngine = new AuditEngine({
    minEdgeBp: config.audit.minEdgeBp,
    minConfidenceBp: config.audit.minConfidenceBp,
    maxSlippageBp: config.audit.maxSlippageBp,
    minSecondsToExpiry: config.audit.minSecondsToExpiry,
    staleAfterMs: config.audit.staleAfterMs,
    ai: config.ai,
  });

  const rpc = new HttpRpcClient(config.rpcUrl);
  const fetchExecutionInfo = async (marketId: string) =>
    (await adapter.getExecutionInfo?.(marketId)) ?? null;
  const tradeService = new TradeService(
    { chainId: SOMNIA_CHAIN_ID, rpc },
    { store, now, fetchSnapshot: marketFromStoreOrAdapter, fetchExecutionInfo },
  );

  const poller = new SettlementPoller(
    adapter,
    store,
    { pollMs: config.settlementPollMs, graceMs: 3_600_000 },
    {
      now,
      listMarketIds: async () => {
        const result = await adapter.listMarkets({ limit: 50 });
        return result.markets.map((m) => m.marketId);
      },
      onEvent: async (kind, message, level) => {
        await store.appendEvent({
          id: `evt_${now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
          kind,
          message,
          at: now(),
          level,
        });
      },
    },
  );

  app.get("/api/health", (_req, res) => {
    void (async () => {
      const counts = await store.counts();
      res.json({
        status: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
        marketSource: adapter.sourceLabel,
        marketDataAgeMs: null,
        auditCount: counts.audits,
        tradeCount: counts.trades,
        time: now(),
      });
    })();
  });

  app.get("/api/markets", (req, res) => {
    void (async () => {
      const parsed = marketsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: { code: "bad_request", message: "Invalid query" } });
        return;
      }
      try {
        const result = await adapter.listMarkets({
          asset: parsed.data.asset,
          status: parsed.data.status,
          expiryBefore: parsed.data.expiryBefore,
          limit: parsed.data.limit,
          cursor: parsed.data.cursor ?? null,
        });
        res.json({
          markets: result.markets.map(domainSnapshotToWire),
          nextCursor: result.nextCursor,
          source: adapter.sourceLabel,
          time: now(),
        });
      } catch {
        res.status(503).json({ error: { code: "upstream", message: "Market data unavailable" } });
      }
    })();
  });

  app.get("/api/markets/:marketId", (req, res) => {
    void (async () => {
      try {
        const market = await adapter.getMarket(req.params.marketId);
        if (!market) {
          res.status(404).json({ error: { code: "not_found", message: "Market not found" } });
          return;
        }
        res.json({ market: domainSnapshotToWire(market), source: adapter.sourceLabel, time: now() });
      } catch {
        res.status(503).json({ error: { code: "upstream", message: "Market data unavailable" } });
      }
    })();
  });

  app.get("/api/markets/:marketId/settlement", (req, res) => {
    void (async () => {
      try {
        const settlement = await poller.refreshSingle(req.params.marketId);
        if (!settlement) {
          res.status(404).json({ error: { code: "not_found", message: "No settlement yet" } });
          return;
        }
        res.json({
          settlement: domainSettlementToWire(settlement),
          source: settlement.source,
          time: now(),
        });
      } catch {
        res.status(503).json({ error: { code: "upstream", message: "Settlement data unavailable" } });
      }
    })();
  });

  app.post("/api/audits", (req, res) => {
    void (async () => {
      const clientKey = req.ip ?? "unknown";
      if (!rateLimit(clientKey)) {
        res.status(429).json({ error: { code: "rate_limited", message: "Too many audits, wait a moment" } });
        return;
      }
      const parsed = auditRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: "bad_request", message: "Expected { marketId }" } });
        return;
      }
      try {
        // The server rereads market values itself. Client supplied values, if
        // any, are diagnostic only and never used for the decision.
        const snapshot = await adapter.getMarket(parsed.data.marketId);
        if (!snapshot) {
          res.status(404).json({ error: { code: "not_found", message: "Market not found" } });
          return;
        }
        const audit = await auditEngine.run(snapshot, now(), newAuditId(now()));
        await store.putAudit(audit);
        await store.appendEvent({
          id: `evt_${now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
          kind: "audit",
          message: `Audit ${audit.auditId} for ${audit.marketId}: ${audit.decision}`,
          at: now(),
          level: "info",
        });
        res.status(201).json({ audit: domainAuditToWire(audit) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "audit failure";
        res.status(500).json({ error: { code: "audit_failed", message } });
      }
    })();
  });

  app.get("/api/audits/:auditId", (req, res) => {
    void (async () => {
      const audit = await store.getAudit(req.params.auditId);
      if (!audit) {
        res.status(404).json({ error: { code: "not_found", message: "Audit not found" } });
        return;
      }
      res.json({ audit: domainAuditToWire(audit) });
    })();
  });

  app.post("/api/trades/prepare", (req, res) => {
    void (async () => {
      const parsed = tradePrepareRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: "bad_request", message: "Expected { auditId, amount, walletAddress }" } });
        return;
      }
      const walletAddress = typeof req.body?.walletAddress === "string" ? req.body.walletAddress : null;
      if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        res.status(400).json({ error: { code: "bad_request", message: "walletAddress must be a 20 byte hex address" } });
        return;
      }
      const audit = await store.getAudit(parsed.data.auditId);
      if (!audit) {
        res.status(404).json({ error: { code: "not_found", message: "Audit not found" } });
        return;
      }
      const fresh = await adapter.getMarket(audit.marketId);
      if (!fresh) {
        res.status(404).json({ error: { code: "not_found", message: "Market not found" } });
        return;
      }
      // Recheck guards against the fresh snapshot.
      const { evaluateGuards } = await import("@calibre/domain");
      const guardsNow = evaluateGuards(
        {
          snapshot: fresh,
          now: now(),
          thresholds: {
            minEdgeBp: config.audit.minEdgeBp,
            minConfidenceBp: config.audit.minConfidenceBp,
            maxSlippageBp: config.audit.maxSlippageBp,
            minSecondsToExpiry: config.audit.minSecondsToExpiry,
            staleAfterMs: config.audit.staleAfterMs,
          },
        },
        audit,
      );
      const blocked = guardsNow.some((g) => g.critical && g.status === "fail");
      if (blocked) {
        res.status(409).json({
          error: { code: "guards", message: "Guards failed on recheck, execution blocked" },
        });
        return;
      }
      const tradeService = new TradeService(
        { chainId: SOMNIA_CHAIN_ID, rpc },
        { store, now, fetchSnapshot: marketFromStoreOrAdapter, fetchExecutionInfo },
      );
      const result = await tradeService.prepare(
        { ...audit, guards: guardsNow },
        parsed.data.amount,
        walletAddress,
      );
      if (!result.ok) {
        res.status(409).json({ error: { code: result.code, message: result.message } });
        return;
      }
      res.status(201).json({
        trade: domainTradeToWire(result.trade),
        approvalTx: result.approvalTx,
      });
    })();
  });

  app.post("/api/trades/confirm", (req, res) => {
    void (async () => {
      const parsed = tradeConfirmRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: "bad_request", message: "Expected { tradeId, txHash, walletAddress }" } });
        return;
      }
      const walletAddress = typeof req.body?.walletAddress === "string" ? req.body.walletAddress : null;
      if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        res.status(400).json({ error: { code: "bad_request", message: "walletAddress must be a 20 byte hex address" } });
        return;
      }
      const trade = await store.getTrade(parsed.data.tradeId);
      if (!trade) {
        res.status(404).json({ error: { code: "not_found", message: "Trade not found" } });
        return;
      }
      if (trade.status === "confirmed") {
        res.status(409).json({ error: { code: "duplicate", message: "Trade already confirmed" } });
        return;
      }
      const dup = await store.findTradeByTxHash(parsed.data.txHash);
      if (dup && dup.tradeId !== trade.tradeId) {
        res.status(409).json({ error: { code: "duplicate", message: "Transaction hash already used" } });
        return;
      }
      // Verify the receipt against the chain before marking anything.
      const receipt = await rpc.getTransactionReceipt(parsed.data.txHash).catch(() => null);
      const confirmed = receipt !== null && String(receipt["status"] ?? "0x0") === "0x1";
      trade.txHash = parsed.data.txHash;
      trade.submittedAt = now();
      trade.status = confirmed ? "confirmed" : "pending";
      if (confirmed) trade.confirmedAt = now();
      await store.putTrade(trade);
      res.json({
        trade: domainTradeToWire(trade),
        receiptChecked: receipt !== null,
      });
    })();
  });

  app.get("/api/history", (req, res) => {
    void (async () => {
      const parsed = historyQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: { code: "bad_request", message: "Invalid query" } });
        return;
      }
      const since = parsed.data.since ?? 0;
      const audits = await store.listAudits(since, 200);
      const trades = await store.listTrades(since, 200);
      const settlements = await store.listSettlements(since);
      const settlementByMarket = new Map<string, Settlement>();
      for (const s of settlements) settlementByMarket.set(s.marketId, s);
      const rows = audits.map((audit) => {
        const settlement = settlementByMarket.get(audit.marketId) ?? null;
        const settled = settlement !== null && (settlement.status === "resolved" || settlement.status === "redeemed");
        return calibrationRowToWire({
          auditId: audit.auditId,
          marketId: audit.marketId,
          decision: audit.decision,
          direction: audit.direction,
          calibreProbabilityBp: audit.calibreProbabilityBp,
          outcome: settled ? settlement!.outcome : null,
          settled,
          outcomeErrorBp: settled && settlement!.outcome !== null
            ? (audit.calibreProbabilityBp > (settlement!.outcome === "up" ? 10_000n : 0n)
                ? audit.calibreProbabilityBp - (settlement!.outcome === "up" ? 10_000n : 0n)
                : (settlement!.outcome === "up" ? 10_000n : 0n) - audit.calibreProbabilityBp)
            : null,
          settledAt: settled ? settlement!.resolvedAt : null,
        });
      });
      res.json({
        audits: audits.map(domainAuditToWire),
        trades: trades.map(domainTradeToWire),
        settlements: settlements.map(domainSettlementToWire),
        calibration: rows,
        time: now(),
      });
    })();
  });

  app.get("/api/learn", (req, res) => {
    void (async () => {
      const since = Number(req.query.since ?? 0);
      const until = Number(req.query.until ?? now());
      const audits = (await store.listAudits(0, 2000)).filter(
        (a) => a.createdAt >= since && a.createdAt <= until,
      );
      const settlements = await store.listSettlements(0);
      const byMarket = new Map<string, Settlement>();
      for (const s of settlements) byMarket.set(s.marketId, s);

      let settledAudits = 0;
      let totalErrorBp = 0n;
      let correctDirection = 0;
      let settledOutcomes = 0;
      for (const audit of audits) {
        const s = byMarket.get(audit.marketId);
        if (!s || !(s.status === "resolved" || s.status === "redeemed") || s.outcome === null) continue;
        settledAudits += 1;
        settledOutcomes += 1;
        const realized = s.outcome === "up" ? 10_000n : 0n;
        const diff = audit.calibreProbabilityBp > realized
          ? audit.calibreProbabilityBp - realized
          : realized - audit.calibreProbabilityBp;
        totalErrorBp += diff;
        const predicted: "up" | "down" = audit.calibreProbabilityBp >= 5000n ? "up" : "down";
        if (predicted === s.outcome) correctDirection += 1;
      }
      const trades = await store.listTrades(0, 2000);
      const executedTrades = trades.filter((t) => t.status === "confirmed").length;
      const avoidedTrades = audits.filter((a) => a.decision === "no_trade").length;
      res.json({
        totalAudits: audits.length,
        settledAudits,
        avoidedTrades,
        executedTrades,
        avgConfidenceErrorBp: settledAudits === 0 ? null : (Number(totalErrorBp) / settledAudits / 10_000).toFixed(4),
        correctDirection,
        settledOutcomes,
        since,
        until,
        source: adapter.sourceLabel,
      });
    })();
  });

  // Error boundary.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    void store.appendEvent({
      id: `evt_err_${now().toString(36)}`,
      kind: "api-error",
      message: err.message,
      at: now(),
      level: "error",
    });
    if (res.headersSent) return;
    res.status(500).json({ error: { code: "internal", message: "Internal error" } });
  });

  return { app, poller };
}

export { canExecute, lifecycleLabel };
export type { AuditResult };
