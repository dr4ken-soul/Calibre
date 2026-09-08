/**
 * Observe section: 12-column bento grid.
 *
 * Market selector, expiry clock, and pressure panel on the first row; the
 * telemetry canvas and the order book span two rows. Every panel shows its
 * data source and age, plus loading, stale, unavailable, and empty states.
 */

import { useEffect, useState } from "react";
import type { MarketSnapshotWire } from "@calibre/validation";
import {
  formatAge,
  formatCountdown,
  LoadingBlock,
  Panel,
  PanelTitle,
  SourceBadge,
  UnavailableBlock,
} from "../primitives.js";
import { TelemetryCanvas } from "../TelemetryCanvas.js";
import { STALE_AFTER_MS } from "../../config.js";

const LIFECYCLE_LABELS: Record<string, string> = {
  listed: "Listed",
  trading: "Trading",
  locked: "Locked",
  resolved: "Resolved",
  redeemed: "Redeemed",
  voided: "Voided",
};

function pct(bps: string): string {
  return `${(Number(bps) * 100).toFixed(2)}%`;
}

function useTicker(intervalMs = 1_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function OrderBookPanel({
  market,
  stale,
  onRetry,
  status,
}: {
  market: MarketSnapshotWire | null;
  stale: boolean;
  onRetry: () => void;
  status: "loading" | "ready" | "unavailable" | "error";
}) {
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    if (!market) return;
    setAnnounced(
      `Order book refreshed, best bid ${pct(market.orderBook.bids[0]?.price ?? "0")}, best ask ${pct(market.orderBook.asks[0]?.price ?? "0")}`,
    );
  }, [market?.orderBook.observedAt]);

  return (
    <Panel className="md:col-span-4 md:row-span-2">
      <PanelTitle hint={market ? formatAge(market.orderBook.observedAt) : undefined}>
        Order book
      </PanelTitle>
      <div aria-live="polite" className="sr-only">
        {announced}
      </div>
      {status === "loading" ? (
        <LoadingBlock label="Loading order book" />
      ) : status === "unavailable" || status === "error" ? (
        <UnavailableBlock onRetry={onRetry} what="the order book" />
      ) : market ? (
        <div className="space-y-4 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
          <SourceBadge
            source={market.source}
            stale={stale}
            observedAt={market.orderBook.observedAt}
          />
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
            <table className="w-full text-left">
              <caption className="sr-only">
                Order book levels for {market.marketId}
              </caption>
              <thead>
                <tr className="font-mono-tech border-b border-[var(--color-line)] bg-[var(--color-surface-raised)] text-xs text-[var(--color-ink-muted)]">
                  <th scope="col" className="px-3 py-2 font-medium">Side</th>
                  <th scope="col" className="px-3 py-2 font-medium">Price</th>
                  <th scope="col" className="px-3 py-2 font-medium">Size</th>
                </tr>
              </thead>
              <tbody className="font-mono-tech text-xs">
                {market.orderBook.asks
                  .slice()
                  .reverse()
                  .map((level, i) => (
                    <tr key={`ask-${i}`} className="border-b border-[var(--color-line)]">
                      <td className="px-3 py-1.5 text-[var(--color-danger)]">Ask</td>
                      <td className="px-3 py-1.5 text-[var(--color-ink)]">{pct(level.price)}</td>
                      <td className="px-3 py-1.5 text-[var(--color-ink-muted)]">{level.size}</td>
                    </tr>
                  ))}
                {market.orderBook.bids.map((level, i) => (
                  <tr key={`bid-${i}`} className="border-b border-[var(--color-line)] last:border-b-0">
                    <td className="px-3 py-1.5 text-[var(--color-success)]">Bid</td>
                    <td className="px-3 py-1.5 text-[var(--color-ink)]">{pct(level.price)}</td>
                    <td className="px-3 py-1.5 text-[var(--color-ink-muted)]">{level.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-mono-tech text-xs leading-[1.5] text-[var(--color-ink-muted)]">
            Book observed {formatAge(market.orderBook.observedAt)}. Prices are
            implied probabilities in percent.
          </p>
        </div>
      ) : null}
    </Panel>
  );
}

export function Observe({
  markets,
  status,
  stale,
  source,
  observedAt,
  selectedId,
  onSelect,
  onRefresh,
  retry,
}: {
  markets: MarketSnapshotWire[];
  status: "loading" | "ready" | "unavailable" | "error";
  stale: boolean;
  source: string | null;
  observedAt: number | null;
  selectedId: string | null;
  onSelect: (marketId: string) => void;
  onRefresh: () => void;
  retry: () => void;
}) {
  const now = useTicker(1_000);
  const selected = markets.find((m) => m.marketId === selectedId) ?? markets[0] ?? null;
  const staleNow =
    stale ||
    (selected !== null && now - selected.observedAt > STALE_AFTER_MS);

  return (
    <section
      id="observe"
      aria-labelledby="observe-title"
      className="relative isolate mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36 xl:px-16"
    >
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono-tech text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
            01 Observe
          </p>
          <h2
            id="observe-title"
            className="mt-3 text-[clamp(1.75rem,3.2vw,3.5rem)] font-bold leading-[1.0] tracking-[-0.045em] text-[var(--color-ink)]"
          >
            Watch the market before trusting it
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {source ? <SourceBadge source={source} stale={stale} observedAt={observedAt} /> : null}
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-12 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-raised)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {status === "unavailable" || status === "error" ? (
        <Panel>
          <UnavailableBlock onRetry={retry} what="market data" />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:auto-rows-[minmax(9rem,auto)]">
          {/* Market selector */}
          <Panel className="md:col-span-4">
            <PanelTitle hint={observedAt !== null ? formatAge(observedAt) : undefined}>
              Markets
            </PanelTitle>
            {status === "loading" ? (
              <LoadingBlock label="Loading markets" />
            ) : markets.length === 0 ? (
              <div className="flex flex-col gap-2 p-6 sm:p-8">
                <p className="text-sm font-semibold text-[var(--color-ink)]">No markets listed</p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  The source returned no Event Contracts for this filter.
                </p>
              </div>
            ) : (
              <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
                <label htmlFor="market-select" className="sr-only">
                  Select a market
                </label>
                <select
                  id="market-select"
                  value={selected?.marketId ?? ""}
                  onChange={(event) => onSelect(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-ink)]"
                >
                  {markets.map((m) => (
                    <option key={m.marketId} value={m.marketId}>
                      {m.asset} {m.status === "trading" ? "Up or Down" : LIFECYCLE_LABELS[m.status]}{" "}
                      {m.marketId.slice(-12)}
                    </option>
                  ))}
                </select>
                {selected ? (
                  <dl className="mt-4 space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Market id</dt>
                      <dd className="font-mono-tech text-xs text-[var(--color-ink)]">{selected.marketId}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Question</dt>
                      <dd className="text-right text-xs text-[var(--color-ink)]">{selected.question}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Status</dt>
                      <dd className="font-mono-tech text-xs text-[var(--color-ink)]">
                        {LIFECYCLE_LABELS[selected.status]}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            )}
          </Panel>

          {/* Expiry clock */}
          <Panel className="md:col-span-4">
            <PanelTitle>Time to lock</PanelTitle>
            {selected ? (
              <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
                <p className="font-mono-tech text-[clamp(1.5rem,3vw,3rem)] font-medium leading-[1] tracking-[-0.04em] text-[var(--color-ink)]">
                  {formatCountdown(selected.lockAt, now)}
                </p>
                <p className="font-mono-tech mt-3 text-xs leading-[1.5] text-[var(--color-ink-muted)]">
                  Locks at {new Date(selected.lockAt).toLocaleTimeString()}. Time
                  to expiry {formatCountdown(selected.expiryAt, now)}. Guards
                  require at least 120 seconds of runway.
                </p>
              </div>
            ) : (
              <LoadingBlock />
            )}
          </Panel>

          {/* Pressure panel */}
          <Panel className="md:col-span-4">
            <PanelTitle>Market pressure</PanelTitle>
            {selected ? (
              <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
                <dl className="space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Implied probability</dt>
                    <dd className="font-mono-tech text-sm font-semibold text-[var(--color-ink)]">
                      {pct(selected.impliedProbability)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Momentum</dt>
                    <dd className="font-mono-tech text-sm font-semibold text-[var(--color-ink)]">
                      {selected.momentumBp} bp
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Current price</dt>
                    <dd className="font-mono-tech text-sm font-semibold text-[var(--color-ink)]">
                      {selected.currentPrice}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Open interest</dt>
                    <dd className="font-mono-tech text-sm font-semibold text-[var(--color-ink)]">
                      {selected.openInterest}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <LoadingBlock />
            )}
          </Panel>

          {/* Telemetry canvas */}
          <Panel className="relative min-h-[18rem] overflow-hidden md:col-span-8 md:row-span-2">
            <TelemetryCanvas
              seedKey={selected?.marketId ?? "observe"}
              intensity={
                selected ? Math.min(1, Math.max(0, Number(selected.impliedProbability))) : 0.5
              }
            />
            <PanelTitle
              hint={selected ? `${selected.asset} ${LIFECYCLE_LABELS[selected.status]}` : undefined}
            >
              Telemetry
            </PanelTitle>
            <div className="relative z-10 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
              <p className="font-mono-tech max-w-[28rem] text-xs leading-[1.6] text-[var(--color-ink-muted)]">
                Traces and the liquidity band are drawn from the selected
                market order book and implied probability. The canvas is
                decorative and paused when offscreen.{" "}
                <span className="sr-only">
                  Current implied probability{" "}
                  {selected ? pct(selected.impliedProbability) : "unavailable"}.
                </span>
              </p>
            </div>
          </Panel>

          {/* Order book */}
          <OrderBookPanel market={selected} stale={staleNow} onRetry={retry} status={status} />
        </div>
      )}
    </section>
  );
}
