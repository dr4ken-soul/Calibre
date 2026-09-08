/**
 * Hero: asymmetric framed portal.
 *
 * Left column carries the thesis. The right portal frame layers the telemetry
 * canvas (z-20), the SVG state contour (z-30), and a live market data panel
 * (z-10). The portal must show a real or clearly labeled market, never a
 * static mockup.
 */

import { LabeledValue, SourceBadge, StatusPill } from "../primitives.js";
import { TelemetryCanvas } from "../TelemetryCanvas.js";
import { StateContour } from "../StateContour.js";
import { APP_VERSION, API_URL, CHAIN_ID, EXPLORER_URL } from "../../config.js";
import type { MarketSnapshotWire } from "@calibre/validation";

const LIFECYCLE_TONES: Record<string, "neutral" | "accent" | "success" | "danger" | "warning" | "telemetry"> = {
  listed: "neutral",
  trading: "success",
  locked: "warning",
  resolved: "telemetry",
  redeemed: "telemetry",
  voided: "danger",
};

const LIFECYCLE_LABELS: Record<string, string> = {
  listed: "Listed",
  trading: "Trading",
  locked: "Locked",
  resolved: "Resolved",
  redeemed: "Redeemed",
  voided: "Voided",
};

function pct(bps: string): string {
  return `${(Number(bps) * 100).toFixed(1)}%`;
}

export function Hero({ market }: { market: MarketSnapshotWire | null }) {
  const implied = market ? Number(market.impliedProbability) : null;
  const intensity = implied === null ? 0.5 : Math.min(1, Math.max(0, implied));

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative isolate min-h-[min(920px,100svh)] overflow-hidden border-b border-[var(--color-line)]"
    >
      <div className="mx-auto grid min-h-[min(920px,100svh)] w-full max-w-[1440px] grid-cols-1 gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:px-12 lg:pb-24 lg:pt-36 xl:px-16">
        <div className="relative z-10 flex max-w-[34rem] flex-col justify-center">
          <p className="font-mono-tech mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
            Somnia testnet, chain {CHAIN_ID}
          </p>
          <h1
            id="hero-title"
            className="max-w-[10ch] text-[clamp(2.75rem,6.5vw,7rem)] font-extrabold leading-[0.92] tracking-[-0.065em] text-[var(--color-ink)]"
          >
            Calibre
          </h1>
          <p className="mt-7 max-w-[31rem] text-[0.9375rem] leading-[1.55] text-[var(--color-ink-muted)] sm:text-base">
            An AI probability auditor and execution guard for DreamDEX Event
            Contracts. It compares the market-implied probability with an
            independent estimate, checks liquidity and contract state, and only
            presents a guarded action when the edge survives the rules. No trade
            is a first-class outcome.
          </p>
          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <a
              href="#observe"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold text-[var(--color-surface)] transition-transform duration-200 ease-out hover:-translate-y-0.5"
            >
              Inspect a market
            </a>
            <a
              href="#protocol"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors duration-200 ease-out hover:bg-[var(--color-surface-raised)]"
            >
              How it works
            </a>
          </div>
          <p className="font-mono-tech mt-8 text-xs text-[var(--color-ink-muted)]">
            {APP_VERSION}. Data source:{" "}
            {API_URL ? "Calibre API" : "browser deterministic fallback"}. Explorer:{" "}
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-[var(--color-line)] underline-offset-4 hover:text-[var(--color-ink)]"
            >
              shannon-explorer.somnia.network
            </a>
          </p>
        </div>

        <div className="relative z-10 min-h-[34rem] overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-canvas)] p-3 shadow-[0_28px_90px_rgba(32,37,31,0.12)] sm:min-h-[42rem] lg:min-h-[36rem] xl:min-h-[42rem]">
          <TelemetryCanvas
            seedKey={market?.marketId ?? "calibre-portal"}
            intensity={intensity}
          />
          <StateContour sectionId="hero" />

          <div className="relative z-10 h-full">
            <div className="grid h-full grid-rows-[auto_1fr_auto] gap-3 p-3 sm:p-4">
              <div className="rounded-[1.25rem] border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-4 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono-tech text-xs font-medium tracking-[0.08em] text-[var(--color-ink-muted)] uppercase">
                    Live market state
                  </p>
                  {market ? (
                    <SourceBadge source={market.source} observedAt={market.orderBook.observedAt} />
                  ) : (
                    <span className="font-mono-tech text-xs text-[var(--color-ink-muted)]">
                      loading
                    </span>
                  )}
                </div>
              </div>

              <div className="self-center">
                {market ? (
                  <div className="grid gap-4 rounded-[1.25rem] border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-5 backdrop-blur">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={LIFECYCLE_TONES[market.status] ?? "neutral"}>
                        {LIFECYCLE_LABELS[market.status] ?? market.status}
                      </StatusPill>
                      <span className="font-mono-tech text-xs text-[var(--color-ink-muted)]">
                        {market.asset}
                      </span>
                    </div>
                    <p className="max-w-[24rem] text-sm leading-[1.5] text-[var(--color-ink)]">
                      {market.question}
                    </p>
                    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <LabeledValue label="Market id" value={market.marketId} />
                      <LabeledValue label="Implied" value={pct(market.impliedProbability)} />
                      <LabeledValue label="Strike" value={market.strike} />
                      <LabeledValue label="Volume 24h" value={market.volume24h} />
                    </dl>
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-5">
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-[var(--color-surface-raised)]" />
                    <div className="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-[var(--color-surface-raised)]" />
                  </div>
                )}
              </div>

              <div
                className="rounded-[1.25rem] border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-4 backdrop-blur"
                role="status"
              >
                <p className="font-mono-tech text-xs leading-[1.5] text-[var(--color-ink-muted)]">
                  Canvas summary: directional traces and a liquidity band rendered
                  from the selected market order book. The canvas is decorative;
                  every value it reflects also appears as text in the panels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
