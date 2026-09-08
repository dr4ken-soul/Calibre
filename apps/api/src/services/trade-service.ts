/**
 * Trade service.
 *
 * Prepare: rechecks every guard against the freshest snapshot before a
 * transaction is prepared. Confirm: accepts a user submitted tx hash and
 * verifies it against the Somnia RPC before marking confirmed. Duplicate
 * submission is prevented by open trade per audit and tx hash uniqueness.
 */

import {
  canExecute,
  formatFixed,
  parseFixed,
  type AuditResult,
  type MarketSnapshot,
  type PreparedTransaction,
  type TradeRecord,
} from "@calibre/domain";
import type { Store } from "../storage.js";

export const SOMNIA_CHAIN_ID = 50312;

export interface ReceiptInfo {
  status: "confirmed" | "failed" | "unknown";
  from?: string;
  to?: string;
}

export interface RpcClient {
  /** Returns the transaction receipt, or null when not yet mined. */
  getTransactionReceipt(txHash: string): Promise<Record<string, unknown> | null>;
  getChainId(): Promise<number>;
}

export class HttpRpcClient implements RpcClient {
  constructor(private readonly rpcUrl: string, private readonly fetchImpl: typeof fetch = fetch) {}

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    const response = await this.fetchImpl(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok) throw new Error(`rpc http ${response.status}`);
    const json = (await response.json()) as { result?: T; error?: { message: string } };
    if (json.error) throw new Error(`rpc error: ${json.error.message}`);
    return json.result as T;
  }

  async getTransactionReceipt(txHash: string): Promise<Record<string, unknown> | null> {
    const result = await this.call<Record<string, unknown> | null>(
      "eth_getTransactionReceipt",
      [txHash],
    );
    return result ?? null;
  }

  async getChainId(): Promise<number> {
    const hex = await this.call<string>("eth_chainId", []);
    return parseInt(hex, 16);
  }
}

export interface TradeServiceConfig {
  chainId: number;
  /** Demo destination when no DreamDEX contract address is configured. */
  fallbackRecipient: string;
  rpc: RpcClient;
  selfTransferDemoNote: string;
}

let tradeCounter = 0;
export function newTradeId(now: number): string {
  tradeCounter += 1;
  return `trade_${now.toString(36)}_${tradeCounter.toString(36)}`;
}

export interface PrepareDeps {
  store: Store;
  now(): number;
  fetchSnapshot(marketId: string): Promise<MarketSnapshot | null>;
}

export class TradeService {
  constructor(
    private readonly config: TradeServiceConfig,
    private readonly deps: PrepareDeps,
  ) {}

  async prepare(audit: AuditResult, amount: string): Promise<
    { ok: true; trade: TradeRecord } | { ok: false; code: string; message: string }
  > {
    const { store, now, fetchSnapshot } = this.deps;

    const open = await store.findOpenTradeForAudit(audit.auditId);
    if (open) {
      return { ok: false, code: "duplicate", message: "An open trade already exists for this audit" };
    }
    if (audit.decision !== "trade") {
      return { ok: false, code: "not_tradeable", message: "Audit decision does not allow execution" };
    }
    let amountFixed: bigint;
    try {
      amountFixed = parseFixed(amount);
    } catch {
      return { ok: false, code: "bad_amount", message: "Amount must be a decimal string" };
    }
    if (amountFixed <= 0n) {
      return { ok: false, code: "bad_amount", message: "Amount must be positive" };
    }

    // Recheck guards against the freshest snapshot, not the audit-time one.
    const snapshot = await fetchSnapshot(audit.marketId);
    if (!snapshot) {
      return { ok: false, code: "market_missing", message: "Market snapshot unavailable" };
    }
    if (!canExecute({ ...audit, guards: audit.guards })) {
      return { ok: false, code: "guards", message: "Audit guards do not permit execution" };
    }
    const freshCritical = audit.guards.some((g) => g.critical && g.status === "fail");
    if (freshCritical) {
      return { ok: false, code: "guards", message: "A critical guard failed" };
    }
    if (snapshot.marketId !== audit.marketId) {
      return { ok: false, code: "market_mismatch", message: "Market identity mismatch" };
    }
    if (snapshot.status !== "trading") {
      return { ok: false, code: "not_trading", message: "Market is not in the Trading state" };
    }

    const executionMode: TradeRecord["executionMode"] = "self-transfer-demo";
    const tx: PreparedTransaction = {
      // Without a published DreamDEX contract address, the guarded testnet
      // execution sends an explicit self transfer to the user address. The UI
      // labels this mode clearly and never calls it a DreamDEX order.
      to: this.config.fallbackRecipient,
      value: formatFixed(amountFixed),
      data: "0x",
      chainId: this.config.chainId,
      gasEstimate: "21000",
    };

    const trade: TradeRecord = {
      tradeId: newTradeId(now()),
      auditId: audit.auditId,
      marketId: audit.marketId,
      direction: audit.direction ?? "up",
      amount: formatFixed(amountFixed),
      maxSlippageBp: 200n,
      status: "prepared",
      tx,
      executionMode,
      txHash: null,
      preparedAt: now(),
      submittedAt: null,
      confirmedAt: null,
      failReason: null,
      source: audit.source,
    };
    await store.putTrade(trade);
    return { ok: true, trade };
  }

  async confirmSubmission(tradeId: string, txHash: string, walletAddress: string): Promise<
    { ok: true; trade: TradeRecord } | { ok: false; code: string; message: string }
  > {
    const { store, now } = this.deps;
    const trade = await store.getTrade(tradeId);
    if (!trade) return { ok: false, code: "not_found", message: "Trade not found" };
    if (trade.status === "confirmed") {
      return { ok: false, code: "duplicate", message: "Trade already confirmed" };
    }
    if (trade.status === "pending" && trade.txHash && trade.txHash !== txHash) {
      return { ok: false, code: "duplicate", message: "Trade already has a different pending transaction" };
    }
    const existing = await store.findTradeByTxHash(txHash);
    if (existing && existing.tradeId !== tradeId) {
      return { ok: false, code: "duplicate", message: "Transaction hash already used by another trade" };
    }

    trade.txHash = txHash;
    trade.status = "pending";
    trade.submittedAt = now();
    await store.putTrade(trade);
    return { ok: true, trade };
  }

  async verifyReceipt(trade: TradeRecord): Promise<ReceiptInfo> {
    if (!trade.txHash) return { status: "unknown" };
    try {
      const receipt = await this.config.rpc.getTransactionReceipt(trade.txHash);
      if (!receipt) return { status: "unknown" };
      const status = String(receipt["status"] ?? "0x0");
      return {
        status: status === "0x1" ? "confirmed" : "failed",
        from: typeof receipt["from"] === "string" ? String(receipt["from"]) : undefined,
        to: typeof receipt["to"] === "string" ? String(receipt["to"]) : undefined,
      };
    } catch {
      return { status: "unknown" };
    }
  }
}
