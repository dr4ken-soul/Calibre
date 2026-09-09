/**
 * JSON file backed storage behind an async interface.
 *
 * The APP_BLUEPRINT allows a lightweight store for the hackathon build provided
 * the interface is swappable. Tables mirror the blueprint data model:
 * market_snapshots, audits, trades, settlements, system_events. Records are
 * bigint-safe because all numeric payloads are stored as decimal strings.
 *
 * Swap path: implement the same interface over PostgreSQL by replacing this
 * module. Nothing outside the store may read or write the JSON files.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditResult, Settlement, SystemEvent, TradeRecord } from "@calibre/domain";
import {
  auditResultSchema,
  domainAuditToWire,
  domainSettlementToWire,
  domainTradeToWire,
  settlementSchema,
  tradeRecordSchema,
  wireAuditToDomain,
  wireSettlementToDomain,
  wireTradeToDomain,
} from "@calibre/validation";

export interface StoredSnapshotRecord {
  marketId: string;
  status: string;
  observedAt: number;
  payloadJson: string;
}

export interface CalibrationLink {
  auditId: string;
  marketId: string;
  settlementObservedAt: number | null;
  outcome: string | null;
}

export interface Store {
  appendSnapshot(record: StoredSnapshotRecord): Promise<void>;
  latestSnapshot(marketId: string): Promise<StoredSnapshotRecord | null>;
  putAudit(audit: AuditResult): Promise<void>;
  getAudit(auditId: string): Promise<AuditResult | null>;
  listAudits(since?: number, limit?: number): Promise<AuditResult[]>;
  putTrade(trade: TradeRecord): Promise<void>;
  getTrade(tradeId: string): Promise<TradeRecord | null>;
  listTrades(since?: number, limit?: number): Promise<TradeRecord[]>;
  findTradeByTxHash(txHash: string): Promise<TradeRecord | null>;
  findOpenTradeForAudit(auditId: string): Promise<TradeRecord | null>;
  putSettlement(settlement: Settlement): Promise<void>;
  getSettlement(marketId: string): Promise<Settlement | null>;
  listSettlements(since?: number): Promise<Settlement[]>;
  appendEvent(event: SystemEvent): Promise<void>;
  listEvents(since?: number, limit?: number): Promise<SystemEvent[]>;
  counts(): Promise<{ audits: number; trades: number; settlements: number }>;
  close(): Promise<void>;
}

interface FileShape {
  snapshots: StoredSnapshotRecord[];
  audits: unknown[];
  trades: unknown[];
  settlements: unknown[];
  events: SystemEvent[];
}

const emptyShape = (): FileShape => ({
  snapshots: [],
  audits: [],
  trades: [],
  settlements: [],
  events: [],
});

export class JsonFileStore implements Store {
  private readonly file: string;
  private data: FileShape = emptyShape();
  private loaded = false;
  private writing: Promise<void> = Promise.resolve();

  constructor(dataDir: string, filename = "store.json") {
    this.file = path.join(dataDir, filename);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as Partial<FileShape>;
      this.data = {
        snapshots: parsed.snapshots ?? [],
        audits: parsed.audits ?? [],
        trades: parsed.trades ?? [],
        settlements: parsed.settlements ?? [],
        events: parsed.events ?? [],
      };
    } catch {
      this.data = emptyShape();
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    // Serialize writes to avoid torn files when requests interleave. A failed
    // write must not poison the chain, so the promise resets before the
    // failure is rethrown.
    this.writing = this.writing.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify(this.data), "utf8");
    });
    try {
      await this.writing;
    } catch (error) {
      this.writing = Promise.resolve();
      throw error;
    }
  }

  private parseAudit(entry: unknown): AuditResult | null {
    const parsed = auditResultSchema.safeParse(entry);
    return parsed.success ? wireAuditToDomain(parsed.data) : null;
  }

  private parseTrade(entry: unknown): TradeRecord | null {
    const parsed = tradeRecordSchema.safeParse(entry);
    return parsed.success ? wireTradeToDomain(parsed.data) : null;
  }

  private parseSettlement(entry: unknown): Settlement | null {
    const parsed = settlementSchema.safeParse(entry);
    return parsed.success ? wireSettlementToDomain(parsed.data) : null;
  }

  private async latest<T extends { marketId?: string; auditId?: string; tradeId?: string; id?: string }>(
    list: T[],
    key: keyof T,
    value: string,
  ): Promise<T | null> {
    for (let i = list.length - 1; i >= 0; i--) {
      if (String(list[i]![key]) === value) return list[i]!;
    }
    return null;
  }

  async appendSnapshot(record: StoredSnapshotRecord): Promise<void> {
    await this.ensureLoaded();
    const existing = await this.latest(this.data.snapshots, "marketId", record.marketId);
    if (!existing || existing.observedAt < record.observedAt) {
      this.data.snapshots.push(record);
      if (this.data.snapshots.length > 500) this.data.snapshots.splice(0, 100);
      await this.persist();
    }
  }

  async latestSnapshot(marketId: string): Promise<StoredSnapshotRecord | null> {
    await this.ensureLoaded();
    return this.latest(this.data.snapshots, "marketId", marketId);
  }

  async putAudit(audit: AuditResult): Promise<void> {
    await this.ensureLoaded();
    const wire = domainAuditToWire(audit);
    const idx = this.data.audits.findIndex((a) => this.parseAudit(a)?.auditId === audit.auditId);
    if (idx >= 0) this.data.audits[idx] = wire;
    else this.data.audits.push(wire);
    await this.persist();
  }

  async getAudit(auditId: string): Promise<AuditResult | null> {
    await this.ensureLoaded();
    for (let i = this.data.audits.length - 1; i >= 0; i--) {
      const audit = this.parseAudit(this.data.audits[i]);
      if (audit && audit.auditId === auditId) return audit;
    }
    return null;
  }

  async listAudits(since = 0, limit = 100): Promise<AuditResult[]> {
    await this.ensureLoaded();
    const filtered = this.data.audits
      .map((a) => this.parseAudit(a))
      .filter((a): a is AuditResult => a !== null && a.createdAt >= since);
    return filtered.slice(-limit).reverse();
  }

  async putTrade(trade: TradeRecord): Promise<void> {
    await this.ensureLoaded();
    const wire = domainTradeToWire(trade);
    const idx = this.data.trades.findIndex((t) => this.parseTrade(t)?.tradeId === trade.tradeId);
    if (idx >= 0) this.data.trades[idx] = wire;
    else this.data.trades.push(wire);
    await this.persist();
  }

  async getTrade(tradeId: string): Promise<TradeRecord | null> {
    await this.ensureLoaded();
    for (let i = this.data.trades.length - 1; i >= 0; i--) {
      const trade = this.parseTrade(this.data.trades[i]);
      if (trade && trade.tradeId === tradeId) return trade;
    }
    return null;
  }

  async listTrades(since = 0, limit = 100): Promise<TradeRecord[]> {
    await this.ensureLoaded();
    const filtered = this.data.trades
      .map((t) => this.parseTrade(t))
      .filter((t): t is TradeRecord => t !== null && t.preparedAt >= since);
    return filtered.slice(-limit).reverse();
  }

  async findTradeByTxHash(txHash: string): Promise<TradeRecord | null> {
    await this.ensureLoaded();
    for (let i = this.data.trades.length - 1; i >= 0; i--) {
      const trade = this.parseTrade(this.data.trades[i]);
      if (trade && trade.txHash === txHash) return trade;
    }
    return null;
  }

  async findOpenTradeForAudit(auditId: string): Promise<TradeRecord | null> {
    await this.ensureLoaded();
    for (let i = this.data.trades.length - 1; i >= 0; i--) {
      const trade = this.parseTrade(this.data.trades[i]);
      if (trade && trade.auditId === auditId && (trade.status === "prepared" || trade.status === "pending")) {
        return trade;
      }
    }
    return null;
  }

  async putSettlement(settlement: Settlement): Promise<void> {
    await this.ensureLoaded();
    const wire = domainSettlementToWire(settlement);
    const idx = this.data.settlements.findIndex((s) => this.parseSettlement(s)?.marketId === settlement.marketId);
    if (idx >= 0) this.data.settlements[idx] = wire;
    else this.data.settlements.push(wire);
    await this.persist();
  }

  async getSettlement(marketId: string): Promise<Settlement | null> {
    await this.ensureLoaded();
    for (let i = this.data.settlements.length - 1; i >= 0; i--) {
      const settlement = this.parseSettlement(this.data.settlements[i]);
      if (settlement && settlement.marketId === marketId) return settlement;
    }
    return null;
  }

  async listSettlements(since = 0): Promise<Settlement[]> {
    await this.ensureLoaded();
    return this.data.settlements
      .map((s) => this.parseSettlement(s))
      .filter((s): s is Settlement => s !== null && s.observedAt >= since);
  }

  async appendEvent(event: SystemEvent): Promise<void> {
    await this.ensureLoaded();
    this.data.events.push(event);
    if (this.data.events.length > 300) this.data.events.splice(0, 100);
    await this.persist();
  }

  async listEvents(since = 0, limit = 50): Promise<SystemEvent[]> {
    await this.ensureLoaded();
    return this.data.events.filter((e) => e.at >= since).slice(-limit).reverse();
  }

  async counts(): Promise<{ audits: number; trades: number; settlements: number }> {
    await this.ensureLoaded();
    return {
      audits: this.data.audits.length,
      trades: this.data.trades.length,
      settlements: this.data.settlements.length,
    };
  }

  async close(): Promise<void> {
    await this.writing;
  }
}

/** In-memory store for tests and ephemeral runs. */
export class MemoryStore implements Store {
  private file: {
    snapshots: StoredSnapshotRecord[];
    audits: AuditResult[];
    trades: TradeRecord[];
    settlements: Settlement[];
    events: SystemEvent[];
  } = {
    snapshots: [],
    audits: [],
    trades: [],
    settlements: [],
    events: [],
  };

  private latestBy<T>(list: T[], pred: (item: T) => boolean): T | null {
    for (let i = list.length - 1; i >= 0; i--) {
      if (pred(list[i]!)) return list[i]!;
    }
    return null;
  }

  async appendSnapshot(record: StoredSnapshotRecord): Promise<void> {
    const existing = this.latestBy(this.file.snapshots, (s) => s.marketId === record.marketId);
    if (!existing || existing.observedAt < record.observedAt) this.file.snapshots.push(record);
  }
  async latestSnapshot(marketId: string): Promise<StoredSnapshotRecord | null> {
    return this.latestBy(this.file.snapshots, (s) => s.marketId === marketId);
  }
  async putAudit(audit: AuditResult): Promise<void> {
    const idx = this.file.audits.findIndex((a) => a.auditId === audit.auditId);
    if (idx >= 0) this.file.audits[idx] = audit;
    else this.file.audits.push(audit);
  }
  async getAudit(auditId: string): Promise<AuditResult | null> {
    return this.latestBy(this.file.audits, (a) => a.auditId === auditId);
  }
  async listAudits(since = 0, limit = 100): Promise<AuditResult[]> {
    return this.file.audits.filter((a) => a.createdAt >= since).slice(-limit).reverse();
  }
  async putTrade(trade: TradeRecord): Promise<void> {
    const idx = this.file.trades.findIndex((t) => t.tradeId === trade.tradeId);
    if (idx >= 0) this.file.trades[idx] = trade;
    else this.file.trades.push(trade);
  }
  async getTrade(tradeId: string): Promise<TradeRecord | null> {
    return this.latestBy(this.file.trades, (t) => t.tradeId === tradeId);
  }
  async listTrades(since = 0, limit = 100): Promise<TradeRecord[]> {
    return this.file.trades.filter((t) => t.preparedAt >= since).slice(-limit).reverse();
  }
  async findTradeByTxHash(txHash: string): Promise<TradeRecord | null> {
    return this.latestBy(this.file.trades, (t) => t.txHash === txHash);
  }
  async findOpenTradeForAudit(auditId: string): Promise<TradeRecord | null> {
    return this.latestBy(
      this.file.trades,
      (t) => t.auditId === auditId && (t.status === "prepared" || t.status === "pending"),
    );
  }
  async putSettlement(settlement: Settlement): Promise<void> {
    const idx = this.file.settlements.findIndex((s) => s.marketId === settlement.marketId);
    if (idx >= 0) this.file.settlements[idx] = settlement;
    else this.file.settlements.push(settlement);
  }
  async getSettlement(marketId: string): Promise<Settlement | null> {
    return this.latestBy(this.file.settlements, (s) => s.marketId === marketId);
  }
  async listSettlements(since = 0): Promise<Settlement[]> {
    return this.file.settlements.filter((s) => s.observedAt >= since);
  }
  async appendEvent(event: SystemEvent): Promise<void> {
    this.file.events.push(event);
  }
  async listEvents(since = 0, limit = 50): Promise<SystemEvent[]> {
    return this.file.events.filter((e) => e.at >= since).slice(-limit).reverse();
  }
  async counts(): Promise<{ audits: number; trades: number; settlements: number }> {
    return {
      audits: this.file.audits.length,
      trades: this.file.trades.length,
      settlements: this.file.settlements.length,
    };
  }
  async close(): Promise<void> {}
}
