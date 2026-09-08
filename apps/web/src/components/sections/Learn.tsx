/**
 * Learn section: calibration-first metrics grid.
 *
 * Reads the Learn metrics API with a date range. Every metric carries the
 * range and a source label. No fabricated performance: when there is no
 * history the empty state explains the exact reason.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getLearnMetrics } from "../../lib/data.js";
import { API_URL } from "../../config.js";
import type { LearnMetricsWire } from "@calibre/validation";
import {
  EmptyBlock,
  LoadingBlock,
  Panel,
  PanelTitle,
  SourceBadge,
  StatusPill,
  UnavailableBlock,
} from "../primitives.js";
import { Reveal } from "../Reveal.js";

const DAY_MS = 86_400_000;
const RANGES = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
] as const;

export function Learn() {
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [metrics, setMetrics] = useState<LearnMetricsWire | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  const { since, until } = useMemo(() => {
    const now = Date.now();
    return { since: now - rangeDays * DAY_MS, until: now };
  }, [rangeDays]);

  const load = useCallback(() => {
    if (!API_URL) {
      setStatus("unavailable");
      setMetrics(null);
      return;
    }
    setStatus("loading");
    getLearnMetrics(since, until)
      .then((result) => {
        setMetrics(result);
        setStatus("ready");
      })
      .catch(() => {
        setMetrics(null);
        setStatus("unavailable");
      });
  }, [since, until]);

  useEffect(() => {
    load();
  }, [load]);

  const hasHistory = metrics !== null && metrics.totalAudits > 0;
  const avgErrorBp = metrics?.avgConfidenceErrorBp;

  return (
    <section
      id="learn"
      aria-labelledby="learn-title"
      className="relative isolate mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36 xl:px-16"
    >
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono-tech text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
            05 Learn
          </p>
          <h2
            id="learn-title"
            className="mt-3 text-[clamp(1.75rem,3.2vw,3.5rem)] font-bold leading-[1.0] tracking-[-0.045em] text-[var(--color-ink)]"
          >
            Calibration over confidence
          </h2>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => setRangeDays(range.days)}
              aria-pressed={rangeDays === range.days}
              className={`min-h-12 rounded-full border px-4 text-sm font-semibold transition-colors ${
                rangeDays === range.days
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-surface)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        <PanelTitle hint={`since ${new Date(since).toLocaleDateString()}`}>
          Calibration metrics
        </PanelTitle>
        {status === "loading" ? (
          <LoadingBlock label="Loading calibration metrics" />
        ) : status === "unavailable" ? (
          <UnavailableBlock onRetry={load} what="calibration metrics" />
        ) : !hasHistory ? (
          <EmptyBlock
            title="No audits in this range yet"
            reason={
              metrics === null
                ? "The Calibre API is not connected, so there is no stored history to measure."
                : "No audits were recorded in the selected range. Run audits in the Audit section and let markets settle, then this grid fills with real calibration data."
            }
          />
        ) : metrics !== null ? (
          <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-4 sm:grid-cols-2 sm:px-8 sm:pb-8 xl:grid-cols-4">
            <Reveal index={0} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <p className="text-xs font-semibold text-[var(--color-ink-muted)]">Prediction count</p>
              <p className="font-mono-tech mt-2 text-2xl font-medium text-[var(--color-ink)]">
                {metrics.totalAudits}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Audits recorded in range. {metrics.settledAudits} settled.
              </p>
            </Reveal>
            <Reveal index={1} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <p className="text-xs font-semibold text-[var(--color-ink-muted)]">Average confidence error</p>
              <p className="font-mono-tech mt-2 text-2xl font-medium text-[var(--color-ink)]">
                {avgErrorBp === null
                  ? "Not enough settled audits yet"
                  : `${(Number(avgErrorBp) * 100).toFixed(2)} pts`}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Mean absolute gap between the Calibre probability and the
                realized outcome, settled audits only.
              </p>
            </Reveal>
            <Reveal index={2} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <p className="text-xs font-semibold text-[var(--color-ink-muted)]">Avoided trades</p>
              <p className="font-mono-tech mt-2 text-2xl font-medium text-[var(--color-ink)]">
                {metrics.avoidedTrades}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                No-trade decisions stored as useful outcomes.
              </p>
            </Reveal>
            <Reveal index={3} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <p className="text-xs font-semibold text-[var(--color-ink-muted)]">Executed trades</p>
              <p className="font-mono-tech mt-2 text-2xl font-medium text-[var(--color-ink)]">
                {metrics.executedTrades}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Receipt-confirmed orders in range.
              </p>
            </Reveal>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] px-6 py-4 sm:px-8">
          {status === "ready" && metrics !== null ? (
            <>
              <SourceBadge source={metrics.source} observedAt={metrics.until} />
              <StatusPill tone="neutral">
                {new Date(metrics.since).toLocaleDateString()} to{" "}
                {new Date(metrics.until).toLocaleDateString()}
              </StatusPill>
              <StatusPill tone="telemetry">
                {metrics.correctDirection}/{metrics.settledOutcomes} direction calls matched
              </StatusPill>
            </>
          ) : (
            <p className="font-mono-tech text-xs text-[var(--color-ink-muted)]">
              Metrics come only from stored audits and settled markets. Nothing
              here is simulated.
            </p>
          )}
        </div>
      </Panel>
    </section>
  );
}
