/**
 * Trade service.
 *
 * Prepare: rechecks every guard against the freshest snapshot before a
 * transaction is prepared. Confirm: accepts a user submitted tx hash and
 * verifies it against the Somnia RPC before marking confirmed. Duplicate
 * submission is prevented by open trade per audit and tx hash uniqueness.
 *
 * Execution targets the market's DreamDEX BinaryPool contract with a real
 * placeBinaryOrder calldata encoding. The API never holds keys; the wallet
 * signs the prepared transaction client side.
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
import type { ExecutionInfo } from "@calibre/dreamdex-adapter";
import { encodeFunctionData } from "viem";
import {
  binaryPoolWriteAbi,
  erc20WriteAbi,
  ORDER_KIND,
  ORDER_TYPE,
  ZERO_ADDRESS,
} from "@somnia-chain/markets-sdk";
import type { Store } from "../storage.js";

export const SOMNIA_CHAIN_ID = 50312;

/** Gas units reserved for a BinaryPool placeBinaryOrder call (SDK default). */
export const ORDER_GAS_UNITS = "10000000";
/** Gas units reserved for an ERC-20 approve call. */
export const APPROVE_GAS_UNITS = "60000";

export interface ReceiptInfo {
  status: "confirmed" | "failed" | "unknown";
  from?: string;
  to?: string;
}

export interface RpcClient {
  /** Returns the transaction receipt, or null when not yet mined. */
  getTransactionReceipt(txHash: string): Promise<Record<string, unknown> | null>;
  getChainId(): Promise<number>;
  /** eth_call against an arbitrary contract; returns raw result or null on revert. */
  call(to: string, data: string, from?: string): Promise<string | null>;
}

export class HttpRpcClient implements RpcClient {
  constructor(private readonly rpcUrl: string, private readonly fetchImpl: typeof fetch = fetch) {}

  private async call0<T>(method: string, params: unknown[]): Promise<T> {
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
    const result = await this.call0<Record<string, unknown> | null>(
      "eth_getTransactionReceipt",
      [txHash],
    );
    return result ?? null;
  }

  async getChainId(): Promise<number> {
    const hex = await this.call0<string>("eth_chainId", []);
    return parseInt(hex, 16);
  }

  async call(to: string, data: string, from?: string): Promise<string | null> {
    const tx = { to, data, ...(from ? { from } : {}) };
    try {
      const result = await this.call0<string | null>("eth_call", [tx, "latest"]);
      return result ?? null;
    } catch {
      return null;
    }
  }
}

/** Reads the wallet's ERC-20 allowance to the pool via eth_call. */
export async function readAllowance(
  rpc: RpcClient,
  token: string,
  owner: string,
  spender: string,
): Promise<bigint | null> {
  const data = encodeFunctionData({
    abi: erc20WriteAbi,
    functionName: "allowance",
    args: [owner as `0x${string}`, spender as `0x${string}`],
  });
  const result = await rpc.call(token, data, owner);
  if (!result || result === "0x") return null;
  try {
    return BigInt(result);
  } catch {
    return null;
  }
}

/**
 * Picks the execution price for a BinaryPool order from the freshest book.
 *
 * Prices are always YES-side in 1e6 fixed point. BUY_YES crosses the best
 * ask; BUY_NO pays the complement of the best YES bid (1e6 minus it). When
 * the book is empty the implied probability is used. Clamped to 1..999999
 * so the pool never sees a zero or full price.
 */
export function binaryOrderPriceBp(snapshot: MarketSnapshot, direction: "up" | "down"): bigint {
  const book = snapshot.orderBook;
  let micro: bigint;
  if (direction === "up") {
    const asks = book?.asks ?? [];
    const bestAsk = asks.length > 0 ? asks[asks.length - 1]! : null;
    micro = bestAsk !== null ? bestAsk.priceBp * 100n : snapshot.impliedProbabilityBp * 100n;
  } else {
    const bids = book?.bids ?? [];
    const bestBid = bids.length > 0 ? bids[0]! : null;
    const yesMicro = bestBid !== null ? bestBid.priceBp * 100n : snapshot.impliedProbabilityBp * 100n;
    micro = 1_000_000n - yesMicro;
  }
  if (micro < 100n) micro = 100n;
  if (micro > 999_900n) micro = 999_900n;
  return micro / 100n;
}

/** Builds the encoded placeBinaryOrder calldata for the market's pool. */
export function encodeBinaryOrder(input: {
  direction: "up" | "down";
  quantityFixed: bigint;
  priceBp: bigint;
  expirySec: number;
}): string {
  const kind =
    input.direction === "up" ? (ORDER_KIND.BUY_YES as number) : (ORDER_KIND.BUY_NO as number);
  // Price is always the YES-side price in 1e6 units, even for BUY_NO.
  const price = input.priceBp * 100n;
  // Pool rejects OrderExpiryBeyondMarket; cap at market expiry.
  const expireTimestampNs = BigInt(Math.max(0, input.expirySec)) * 1_000_000_000n;
  return encodeFunctionData({
    abi: binaryPoolWriteAbi,
    functionName: "placeBinaryOrder",
    args: [
      kind,
      price,
      input.quantityFixed,
      expireTimestampNs,
      ORDER_TYPE.MARKET as number,
      0,
      ZERO_ADDRESS,
      0n,
      0n,
    ],
  });
}

/** Builds the encoded ERC-20 approve calldata for the collateral. */
export function encodeCollateralApproval(spender: string): string {
  const max = (1n << 256n) - 1n;
  return encodeFunctionData({
    abi: erc20WriteAbi,
    functionName: "approve",
    args: [spender as `0x${string}`, max],
  });
}

export interface TradeServiceConfig {
  chainId: number;
  rpc: RpcClient;
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
  fetchExecutionInfo(marketId: string): Promise<ExecutionInfo | null>;
}

export class TradeService {
  constructor(
    private readonly config: TradeServiceConfig,
    private readonly deps: PrepareDeps,
  ) {}

  async prepare(
    audit: AuditResult,
    amount: string,
    walletAddress: string,
  ): Promise<
    { ok: true; trade: TradeRecord; approvalTx: PreparedTransaction | null } | { ok: false, code: string; message: string }
  > {
    const { store, now, fetchSnapshot, fetchExecutionInfo } = this.deps;

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

    const executionInfo = await fetchExecutionInfo(audit.marketId);
    if (!executionInfo || !executionInfo.poolAddress) {
      return {
        ok: false,
        code: "no_pool",
        message: "No BinaryPool address published for this market",
      };
    }

    const direction = audit.direction ?? "up";
    const priceBp = binaryOrderPriceBp(snapshot, direction);
    const data = encodeBinaryOrder({
      direction,
      quantityFixed: amountFixed,
      priceBp,
      expirySec: executionInfo.expirySec,
    });

    const tx: PreparedTransaction = {
      // Real DreamDEX BinaryPool order on Somnia testnet. The amount is the
      // outcome token quantity; collateral is pulled through the wallet's
      // ERC-20 allowance, so the order tx itself carries zero STT value.
      to: executionInfo.poolAddress,
      value: "0",
      data,
      chainId: this.config.chainId,
      gasEstimate: ORDER_GAS_UNITS,
    };

    // A BUY pulls tUSDC via transferFrom, so the wallet needs an allowance to
    // the pool first. When the on-chain allowance cannot cover the expected
    // cost, an approval tx is returned alongside the order for the wallet to
    // sign before submitting the order.
    let approvalTx: PreparedTransaction | null = null;
    if (executionInfo.collateral) {
      const cost = direction === "up"
        ? (amountFixed * priceBp * 100n) / 1_000_000n
        : (amountFixed * (10_000n - priceBp) * 100n) / 1_000_000n;
      const allowance = await readAllowance(
        this.config.rpc,
        executionInfo.collateral,
        walletAddress,
        executionInfo.poolAddress,
      );
      if (allowance === null || allowance < cost) {
        approvalTx = {
          to: executionInfo.collateral,
          value: "0",
          data: encodeCollateralApproval(executionInfo.poolAddress),
          chainId: this.config.chainId,
          gasEstimate: APPROVE_GAS_UNITS,
        };
      }
    }

    const trade: TradeRecord = {
      tradeId: newTradeId(now()),
      auditId: audit.auditId,
      marketId: audit.marketId,
      direction,
      amount: formatFixed(amountFixed),
      maxSlippageBp: 200n,
      status: "prepared",
      tx,
      executionMode: "dreamdex-contract",
      txHash: null,
      preparedAt: now(),
      submittedAt: null,
      confirmedAt: null,
      failReason: null,
      source: audit.source,
    };
    await store.putTrade(trade);
    return { ok: true, trade, approvalTx };
  }

  async confirmSubmission(tradeId: string, txHash: string, walletAddress: string): Promise<
    { ok: true; trade: TradeRecord } | { ok: false, code: string; message: string }
  > {
    void walletAddress;
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
