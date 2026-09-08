/**
 * Audit section: split comparison layout.
 *
 * Market probability panel on the left, Calibre estimate panel on the right,
 * difference marker between them. Below: decision banner, reasons, guards
 * summary, and the evidence table. Every value shows its source and the model
 * version that produced it.
 */

import type { AuditResultWire, MarketSnapshotWire } from "@calibre/validation";
import { formatEdgeBp, formatProbability, probabilityToBp } from "@calibre/domain";
import {
  LoadingBlock,
  Panel,
  PanelTitle,
  SourceBadge,
  StatusPill,
} from "../primitives.js";

const GUARD_TONES: Record<string, "success" | "warning" | "danger"> = {
  pass: "success",
  warn: "warning",
  fail: "danger",
};

function DecisionBanner({ decision, direction }: { decision: string; direction: string | null }) {
  if (decision === "trade") {
    return (
      <div className="rounded-[1.5rem] border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] p-5">
        <p className="text-sm font-bold text-[var(--color-success)]">Guarded trade available</p>
        <p className="mt-1 text-sm text-[var(--color-ink)]">
          The edge cleared every rule. Direction {direction === "up" ? "Up" : "Down"}.
          Execution still needs your explicit approval.
        </p>
      </div>
    );
  }
  if (decision === "no_trade") {
    return (
      <div className="rounded-[1.5rem] border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-5">
        <p className="text-sm font-bold text-[var(--color-warning)]">No trade</p>
        <p className="mt-1 text-sm text-[var(--color-ink)]">
          A guard or threshold rejected this setup. Avoiding a weak market is a
          first-class success, not a failure.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
      <p className="text-sm font-bold text-[var(--color-ink)]">Insufficient data</p>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Confidence is too low to produce a usable probability. Treat this as
        unknown, not as a signal.
      </p>
    </div>
  );
}

export function Audit({
  market,
  auditState,
  onRun,
}: {
  market: MarketSnapshotWire | null;
  auditState: {
    status: "idle" | "loading" | "ready" | "error";
    audit: AuditResultWire | null;
    source: string | null;
    time: number | null;
    error: string | null;
  };
  onRun: () => void;
}) {
  const audit = auditState.status === "ready" ? auditState.audit : null;
  const marketBp = audit ? probabilityToBp(audit.marketProbability) : null;
  const calibreBp = audit ? probabilityToBp(audit.calibreProbability) : null;
  const edgeBp = audit ? probabilityToBp(audit.edgeBp) : null;

  return (
    <section
      id="audit"
      aria-labelledby="audit-title"
      className="relative isolate mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36 xl:px-16"
    >
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono-tech text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
            02 Audit
          </p>
          <h2
            id="audit-title"
            className="mt-3 text-[clamp(1.75rem,3.2vw,3.5rem)] font-bold leading-[1.0] tracking-[-0.045em] text-[var(--color-ink)]"
          >
            Two probabilities, one decision
          </h2>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={!market || auditState.status === "loading"}
          className="inline-flex min-h-14 items-center justify-center rounded-xl border border-[var(--color-ink)] px-6 text-sm font-bold text-[var(--color-ink)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {auditState.status === "loading" ? "Auditing" : "Audit this market"}
        </button>
      </div>

      {auditState.status === "error" ? (
        <Panel>
          <div className="p-6 sm:p-8" role="alert">
            <p className="text-sm font-semibold text-[var(--color-danger)]">Audit failed</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {auditState.error ?? "The audit engine could not run."}
            </p>
          </div>
        </Panel>
      ) : auditState.status === "loading" ? (
        <Panel>
          <LoadingBlock label="Auditing market" />
        </Panel>
      ) : audit && marketBp !== null && calibreBp !== null && edgeBp !== null ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8">
              <p className="text-sm font-bold tracking-[-0.02em] text-[var(--color-ink)]">
                Market implies
              </p>
              <p className="font-mono-tech mt-4 text-[clamp(1.5rem,3vw,3rem)] font-medium leading-[1] tracking-[-0.04em] text-[var(--color-ink)]">
                {formatProbability(marketBp)}
              </p>
              <p className="font-mono-tech mt-3 text-xs leading-[1.5] text-[var(--color-ink-muted)]">
                Probability the order book implies for up. Source{" "}
                {audit.source === "deterministic-fallback" ? "deterministic fallback" : audit.source}.
              </p>
            </div>

            <div className="flex items-center justify-center">
              <span
                aria-label={`Difference ${formatEdgeBp(edgeBp)}`}
                className="inline-flex items-center justify-center rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-3 font-mono-tech text-sm font-medium text-[var(--color-focus)]"
              >
                {formatEdgeBp(edgeBp)}
              </span>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--color-telemetry)] bg-[var(--color-telemetry-soft)] p-6 sm:p-8">
              <p className="text-sm font-bold tracking-[-0.02em] text-[var(--color-telemetry)]">
                Calibre estimates
              </p>
              <p className="font-mono-tech mt-4 text-[clamp(1.5rem,3vw,3rem)] font-medium leading-[1] tracking-[-0.04em] text-[var(--color-telemetry)]">
                {formatProbability(calibreBp)}
              </p>
              <p className="font-mono-tech mt-3 text-xs leading-[1.5] text-[var(--color-telemetry)]">
                Independent estimate from book depth, imbalance, and momentum.
                Model {audit.modelVersion}, mode {audit.mode === "model-assisted" ? "model-assisted" : "deterministic"}.
              </p>
            </div>
          </div>

          <DecisionBanner decision={audit.decision} direction={audit.direction} />

          <Panel>
            <PanelTitle hint={`audit ${audit.auditId}`}>Reasons</PanelTitle>
            <ul className="space-y-2 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
              {audit.reasons.map((reason, i) => (
                <li key={i} className="text-sm leading-[1.55] text-[var(--color-ink-muted)]">
                  {reason}
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
            <Panel>
              <PanelTitle>Guards</PanelTitle>
              <ul className="divide-y divide-[var(--color-line)] px-0 pb-2 pt-2">
                {audit.guards.map((guard) => (
                  <li
                    key={guard.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-6 py-3 sm:px-8"
                  >
                    <StatusPill tone={GUARD_TONES[guard.status] ?? "neutral"}>{guard.status}</StatusPill>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink)]">{guard.label}</p>
                      <p className="mt-0.5 text-xs leading-[1.4] text-[var(--color-ink-muted)]">
                        {guard.message}
                      </p>
                    </div>
                    <span className="font-mono-tech text-[0.625rem] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
                      {guard.critical ? "critical" : "advisory"}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelTitle hint={audit.modelVersion}>Evidence</PanelTitle>
              <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
                <ul>
                  {audit.evidence.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t border-[var(--color-line)] py-3 font-mono-tech text-xs first:border-t-0"
                    >
                      <span className="font-mono-tech text-[var(--color-ink)]">{item.id}</span>
                      <span className="font-mono-tech text-[var(--color-ink-muted)]">
                        {item.source}
                      </span>
                      <span className="font-mono-tech text-right text-[var(--color-ink)]">
                        {item.value}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <SourceBadge source={audit.source} observedAt={audit.createdAt} />
                  <span className="font-mono-tech text-xs text-[var(--color-ink-muted)]">
                    Audit at {new Date(audit.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <Panel>
          <div className="flex flex-col items-start gap-3 p-6 sm:p-8">
            <p className="text-sm font-semibold text-[var(--color-ink)]">No audit yet</p>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Select a market in Observe, then run the audit. The engine reads
              the market fresh, compares probabilities, and evaluates every
              guard before any action becomes available.
            </p>
          </div>
        </Panel>
      )}
    </section>
  );
}
