/**
 * Settlement poller.
 *
 * Periodically checks markets approaching or past expiry for settlement data.
 * Settlement is only recorded when the adapter (or live protocol) reports a
 * terminal status. Audits for the settled market are linked for calibration.
 */

import { settlementToCalibrationRow, type Settlement } from "@calibre/domain";
import type { DreamDexAdapter } from "@calibre/dreamdex-adapter";
import type { Store } from "../storage.js";

export interface PollerConfig {
  pollMs: number;
  /** How long after expiry we keep checking a market before parking it. */
  graceMs: number;
}

export class SettlementPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly watched = new Map<string, number>();

  constructor(
    private readonly adapter: DreamDexAdapter,
    private readonly store: Store,
    private readonly config: PollerConfig,
    private readonly options: {
      now(): number;
      listMarketIds(): Promise<string[]>;
      onEvent(kind: string, message: string, level: "info" | "warn" | "error"): Promise<void>;
    },
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.pollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Single poll pass. Also callable directly from tests and manual runs. */
  async tick(): Promise<void> {
    const now = this.options.now();
    const marketIds = await this.options.listMarketIds();
    for (const marketId of marketIds) {
      const lastWatched = this.watched.get(marketId) ?? 0;
      if (now - lastWatched < this.config.pollMs) continue;
      this.watched.set(marketId, now);

      try {
        const settlement = await this.adapter.getSettlement(marketId);
        if (!settlement) continue;
        if (settlement.status !== "resolved" && settlement.status !== "redeemed" && settlement.status !== "voided") {
          continue;
        }
        await this.store.putSettlement(settlement);
        const audits = await this.store.listAudits(0, 1000);
        for (const audit of audits) {
          if (audit.marketId !== marketId) continue;
          const row = settlementToCalibrationRow(audit, settlement);
          if (row.settled) {
            await this.options.onEvent(
              "settlement-linked",
              `Settlement for ${marketId} linked to audit ${audit.auditId}`,
              "info",
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        await this.options.onEvent("settlement-poll-error", `Poll failed for ${marketId}: ${message}`, "warn");
      }
    }
  }

  async refreshSingle(marketId: string): Promise<Settlement | null> {
    const settlement = await this.adapter.getSettlement(marketId);
    if (settlement && (settlement.status === "resolved" || settlement.status === "redeemed" || settlement.status === "voided")) {
      await this.store.putSettlement(settlement);
    }
    return settlement;
  }
}
