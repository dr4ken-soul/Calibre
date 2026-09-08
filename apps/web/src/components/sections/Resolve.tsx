/**
 * Resolve section: chronological settlement timeline.
 *
 * Reads settlement for the selected market and shows the actual lifecycle
 * from listed to trading to locked to resolved, redeemed, or voided. The
 * outcome is never inferred from question text, only from protocol status
 * tied to the market id. Shows outcome, closing price, and resolvedAt only
 * when terminal.
 */

import { useEffect, useState } from "react";
import type { MarketSnapshotWire } from "@calibre/validation";
import { getSettlement } from "../../lib/data.js";
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

interface SettlementView {
  status: string;
  outcome: string | null;
  closingPrice: string | null;
  resolvedAt: number | null;
  source: string;
  time: number;
}

const STEPS = [
  { id: "listed", label: "Listed", hint: "Market exists, trading has not opened." },
  { id: "trading", label: "Trading", hint: "Orders are accepted." },
  { id: "locked", label: "Locked", hint: "No further orders." },
  { id: "resolved", label: "Resolved", hint: "Outcome recorded on chain." },
] as const;

function stepIndexForStatus(status: string): number {
  if (status === "listed") return 0;
  if (status === "trading") return 1;
  if (status === "locked") return 2;
  return 3;
}

export function Resolve({
  market,
  observedAt,
  stale,
}: {
  market: MarketSnapshotWire | null;
  observedAt: number | null;
  stale: boolean;
}) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "empty" } | { kind: "unavailable" } | { kind: "ready"; data: SettlementView }
  >({ kind: "loading" });

  const marketId = market?.marketId ?? null;

  useEffect(() => {
    if (!marketId) {
      setState({ kind: "empty" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    getSettlement(marketId)
      .then((result) => {
        if (cancelled) return;
        if (result === null) {
          setState({ kind: "empty" });
        } else {
          setState({ kind: "ready", data: { ...result.data, source: result.source, time: result.time } });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  const activeStatus = state.kind === "ready" ? state.data.status : market?.status ?? "listed";
  const activeStep = stepIndexForStatus(activeStatus);
  const terminal = activeStatus === "resolved" || activeStatus === "redeemed" || activeStatus === "voided";

  return (
    <section
      id="resolve"
      aria-labelledby="resolve-title"
      className="relative isolate mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36 xl:px-16"
    >
      <div className="mb-10">
        <p className="font-mono-tech text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
          04 Resolve
        </p>
        <h2
          id="resolve-title"
          className="mt-3 text-[clamp(1.75rem,3.2vw,3.5rem)] font-bold leading-[1.0] tracking-[-0.045em] text-[var(--color-ink)]"
        >
          Settlement is read, never guessed
        </h2>
      </div>

      <Panel>
        <PanelTitle hint={marketId ?? undefined}>Settlement timeline</PanelTitle>
        {state.kind === "loading" ? (
          <LoadingBlock label="Reading settlement" />
        ) : state.kind === "unavailable" ? (
          <UnavailableBlock onRetry={() => setState({ kind: "loading" })} what="settlement data" />
        ) : !marketId ? (
          <EmptyBlock
            title="No market selected"
            reason="Choose a market in Observe to follow its lifecycle."
          />
        ) : (
          <div className="px-5 pb-6 pt-4 sm:px-8 sm:pb-8">
            <ol className="relative grid grid-cols-1 gap-0 lg:grid-cols-5">
              {STEPS.map((step, i) => {
                const reached = i <= activeStep;
                const current = i === activeStep;
                return (
                  <Reveal
                    key={step.id}
                    as="li"
                    index={i}

                  >
                    <div
                      aria-hidden="true"
                      className={`absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full border-2 lg:-top-[7px] lg:left-0 ${
                        reached
                          ? "border-[var(--color-telemetry)] bg-[var(--color-telemetry)]"
                          : "border-[var(--color-line)] bg-[var(--color-surface)]"
                      }`}
                    />
                    <p
                      className={`text-sm font-bold ${
                        current ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]"
                      }`}
                    >
                      {step.label}
                      {current ? <span className="sr-only"> (current)</span> : null}
                    </p>
                    <p className="mt-1 max-w-[16rem] text-xs leading-[1.5] text-[var(--color-ink-muted)]">
                      {step.hint}
                    </p>
                  </Reveal>
                );
              })}
              <Reveal
                as="li"
                index={4}
                className="relative border-l border-[var(--color-line)] pb-8 pl-6 last:border-l-0 last:pb-0 lg:border-l-0 lg:border-t lg:pb-0 lg:pl-0 lg:pt-6"
              >
                <div
                  aria-hidden="true"
                  className={`absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full border-2 lg:-top-[7px] lg:left-0 ${
                    terminal
                      ? "border-[var(--color-telemetry)] bg-[var(--color-telemetry)]"
                      : "border-[var(--color-line)] bg-[var(--color-surface)]"
                  }`}
                />
                <p className="text-sm font-bold text-[var(--color-ink-muted)]">Redeemed or voided</p>
                <p className="mt-1 max-w-[16rem] text-xs leading-[1.5] text-[var(--color-ink-muted)]">
                  Terminal states after resolution, read from protocol status.
                </p>
              </Reveal>
            </ol>

            <div className="mt-6 border-t border-[var(--color-line)] pt-6">
              {state.kind === "empty" ? (
                <div className="flex flex-col gap-3">
                  <StatusPill tone="neutral">No settlement yet</StatusPill>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    This market has not reached a terminal state. The poller
                    checks it every 30 seconds and only reports protocol status.
                  </p>
                </div>
              ) : terminal ? (
                <div className="flex flex-col gap-3" role="status" aria-live="polite">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={activeStatus === "voided" ? "danger" : "telemetry"}>
                      {activeStatus === "voided" ? "Voided" : activeStatus === "redeemed" ? "Redeemed" : "Resolved"}
                    </StatusPill>
                    {state.data.outcome ? (
                      <StatusPill tone={state.data.outcome === "up" ? "success" : "danger"}>
                        Outcome {state.data.outcome === "up" ? "Up" : "Down"}
                      </StatusPill>
                    ) : null}
                  </div>
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Closing price</dt>
                      <dd className="font-mono-tech text-sm text-[var(--color-ink)]">
                        {state.data.closingPrice ?? "n/a"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Resolved at</dt>
                      <dd className="font-mono-tech text-sm text-[var(--color-ink)]">
                        {state.data.resolvedAt
                          ? new Date(state.data.resolvedAt).toLocaleString()
                          : "n/a"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[var(--color-ink-muted)]">Source</dt>
                      <dd>
                        <SourceBadge
                          source={state.data.source}
                          stale={stale}
                          observedAt={state.data.time}
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <StatusPill tone="warning">Pending settlement</StatusPill>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    Current status {activeStatus}. Outcome, closing price, and
                    resolved time appear only after the protocol reports a
                    terminal state.
                  </p>
                  {observedAt !== null ? (
                    <SourceBadge source={market?.source ?? "unknown"} stale={stale} observedAt={observedAt} />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>
    </section>
  );
}
