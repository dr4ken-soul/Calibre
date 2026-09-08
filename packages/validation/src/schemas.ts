/**
 * Wire schemas for Calibre.
 *
 * Bigint values travel as decimal strings. Every schema that crosses a trust
 * boundary (API request, API response, model output) is validated here before
 * it reaches domain logic.
 */

import { z } from "zod";

export const DECIMAL_STRING = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Expected a decimal string");

export const NON_NEGATIVE_DECIMAL = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Expected a non-negative decimal string");

export const BP_STRING = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Expected a non-negative decimal string");

export const LIFECYCLE_STATUSES = [
  "listed",
  "trading",
  "locked",
  "resolved",
  "redeemed",
  "voided",
] as const;

export const TRADE_DIRECTIONS = ["up", "down"] as const;

export const GUARD_STATUSES = ["pass", "warn", "fail"] as const;

export const AUDIT_DECISIONS = ["trade", "no_trade", "insufficient_data"] as const;

const lifecycle = z.enum(LIFECYCLE_STATUSES);
const direction = z.enum(TRADE_DIRECTIONS);

export const orderBookLevelSchema = z.object({
  price: BP_STRING,
  size: NON_NEGATIVE_DECIMAL,
});

export const orderBookSchema = z.object({
  bids: z.array(orderBookLevelSchema),
  asks: z.array(orderBookLevelSchema),
  observedAt: z.number().int().nonnegative(),
});

export const marketSnapshotSchema = z.object({
  marketId: z.string().min(1),
  question: z.string().min(1),
  asset: z.string().min(1),
  strike: DECIMAL_STRING,
  referencePrice: DECIMAL_STRING,
  currentPrice: DECIMAL_STRING,
  lockAt: z.number().int().nonnegative(),
  expiryAt: z.number().int().nonnegative(),
  status: lifecycle,
  impliedProbability: BP_STRING,
  momentumBp: z.string(),
  volume24h: NON_NEGATIVE_DECIMAL,
  openInterest: NON_NEGATIVE_DECIMAL,
  orderBook: orderBookSchema,
  source: z.string().min(1),
  observedAt: z.number().int().nonnegative(),
});
export type MarketSnapshotWire = z.infer<typeof marketSnapshotSchema>;

export const settlementSchema = z.object({
  marketId: z.string().min(1),
  status: lifecycle,
  outcome: direction.nullable(),
  closingPrice: DECIMAL_STRING.nullable(),
  resolvedAt: z.number().int().nonnegative().nullable(),
  source: z.string().min(1),
  observedAt: z.number().int().nonnegative(),
});
export type SettlementWire = z.infer<typeof settlementSchema>;

export const evidenceSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  value: z.string(),
  observedAt: z.number().int().nonnegative(),
});

export const guardResultSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(GUARD_STATUSES),
  critical: z.boolean(),
  message: z.string().min(1),
});

export const auditResultSchema = z.object({
  auditId: z.string().min(1),
  marketId: z.string().min(1),
  decision: z.enum(AUDIT_DECISIONS),
  direction: direction.nullable(),
  marketProbability: BP_STRING,
  calibreProbability: BP_STRING,
  edgeBp: BP_STRING,
  confidence: BP_STRING,
  guards: z.array(guardResultSchema),
  evidence: z.array(evidenceSchema),
  reasons: z.array(z.string()),
  modelVersion: z.string().min(1),
  mode: z.enum(["deterministic", "model-assisted"]),
  source: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});
export type AuditResultWire = z.infer<typeof auditResultSchema>;

export const marketsQuerySchema = z
  .object({
    asset: z.string().optional(),
    status: lifecycle.optional(),
    expiryBefore: z.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const auditRequestSchema = z
  .object({
    marketId: z.string().min(1),
  })
  .strict();

const ADDRESS = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Expected a 20 byte hex address");

export const tradePrepareRequestSchema = z
  .object({
    auditId: z.string().min(1),
    amount: NON_NEGATIVE_DECIMAL,
    walletAddress: ADDRESS,
  })
  .strict();

export const tradeConfirmRequestSchema = z
  .object({
    tradeId: z.string().min(1),
    txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected a 32 byte transaction hash"),
    walletAddress: ADDRESS,
  })
  .strict();

export const historyQuerySchema = z
  .object({
    since: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const tradeRecordSchema = z.object({
  tradeId: z.string().min(1),
  auditId: z.string().min(1),
  marketId: z.string().min(1),
  direction,
  amount: NON_NEGATIVE_DECIMAL,
  maxSlippageBp: BP_STRING,
  status: z.enum(["prepared", "pending", "confirmed", "failed"]),
  tx: z.object({
    to: z.string().min(1),
    value: NON_NEGATIVE_DECIMAL,
    data: z.string(),
    chainId: z.number().int().positive(),
    gasEstimate: z.string().nullable(),
  }),
  executionMode: z.enum(["self-transfer-demo", "dreamdex-contract"]),
  txHash: z.string().nullable(),
  preparedAt: z.number().int().nonnegative(),
  submittedAt: z.number().int().nonnegative().nullable(),
  confirmedAt: z.number().int().nonnegative().nullable(),
  failReason: z.string().nullable(),
  source: z.string().min(1),
});
export type TradeRecordWire = z.infer<typeof tradeRecordSchema>;

/**
 * Model output is untrusted. The adjustment is a probability in 0..1 bounded to
 * plus or minus MODEL_MAX_ADJUSTMENT_BP of the deterministic baseline.
 */
export const MODEL_MAX_ADJUSTMENT_BP = 800n;

export const modelAdjustmentSchema = z.object({
  adjustedProbability: z.coerce.number().min(0).max(1),
  reasoning: z.string().max(600),
});
export type ModelAdjustment = z.infer<typeof modelAdjustmentSchema>;

export const learnMetricsSchema = z.object({
  totalAudits: z.number().int().nonnegative(),
  settledAudits: z.number().int().nonnegative(),
  avoidedTrades: z.number().int().nonnegative(),
  executedTrades: z.number().int().nonnegative(),
  avgConfidenceErrorBp: BP_STRING.nullable(),
  correctDirection: z.number().int().nonnegative(),
  settledOutcomes: z.number().int().nonnegative(),
  since: z.number().int().nonnegative(),
  until: z.number().int().nonnegative(),
  source: z.string().min(1),
});
export type LearnMetricsWire = z.infer<typeof learnMetricsSchema>;

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  uptimeSeconds: z.number().int().nonnegative(),
  marketSource: z.string(),
  marketDataAgeMs: z.number().int().nullable(),
  auditCount: z.number().int().nonnegative(),
  tradeCount: z.number().int().nonnegative(),
  time: z.number().int().nonnegative(),
});

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
