/**
 * Protocol section: architecture strip.
 *
 * Five nodes show the trust boundaries of the product loop: Wallet, Market
 * Data, Calibre Audit, DreamDEX Event Contract, and Settlement. Text labels
 * only, no logos or protocol symbols.
 */

import { Panel, PanelTitle } from "../primitives.js";
import { Reveal } from "../Reveal.js";
import { API_URL } from "../../config.js";

const NODES = [
  {
    id: "wallet",
    label: "Wallet",
    hint: "Your keys stay in your wallet. Calibre never holds them and never auto-signs. Every order needs one explicit approval.",
  },
  {
    id: "market-data",
    label: "Market Data",
    hint: "Order books and market state are read from DreamDEX, or from a labeled deterministic fallback when no live endpoint is reachable.",
  },
  {
    id: "calibre-audit",
    label: "Calibre Audit",
    hint: "The audit engine compares the market-implied probability with an independent estimate and evaluates every guard before anything else moves.",
  },
  {
    id: "event-contract",
    label: "DreamDEX Event Contract",
    hint: "The venue for Event Contracts on Somnia testnet. Calibre has no say in their rules and reads only what the venue publishes.",
  },
  {
    id: "settlement",
    label: "Settlement",
    hint: "Outcomes come from the protocol status of the market, never from question text. Settled audits feed calibration in Learn.",
  },
] as const;

export function Protocol() {
  return (
    <section
      id="protocol"
      aria-labelledby="protocol-title"
      className="relative isolate mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36 xl:px-16"
    >
      <div className="mb-10">
        <p className="font-mono-tech text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
          06 Protocol
        </p>
        <h2
          id="protocol-title"
          className="mt-3 text-[clamp(1.75rem,3.2vw,3.5rem)] font-bold leading-[1.0] tracking-[-0.045em] text-[var(--color-ink)]"
        >
          Trust boundaries, drawn plainly
        </h2>
      </div>

      <Panel>
        <PanelTitle hint={API_URL ? "Calibre API in the loop" : "browser deterministic fallback"}>
          Architecture
        </PanelTitle>
        <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {NODES.map((node, i) => (
              <Reveal
                key={node.id}
                as="li"
                index={i}
                className="relative rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
              >
                <div
                  aria-hidden="true"
                  className="mb-3 flex items-center gap-2"
                >
                  <span className="font-mono-tech inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-raised)] text-xs font-semibold text-[var(--color-ink-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px flex-1 bg-[var(--color-line)] md:hidden" />
                </div>
                <p className="text-sm font-bold text-[var(--color-ink)]">{node.label}</p>
                <p className="mt-2 text-xs leading-[1.5] text-[var(--color-ink-muted)]">
                  {node.hint}
                </p>
                {i < NODES.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -right-3 z-10 hidden h-px w-3 bg-[var(--color-line)] md:block"
                  />
                ) : null}
              </Reveal>
            ))}
          </ol>
          <p className="font-mono-tech mt-6 text-xs leading-[1.5] text-[var(--color-ink-muted)]">
            Calibre sits between your wallet and the venue. It can refuse an
            order, but it can never move funds on its own. The connectors are
            one way: read market data, write only with your signature.
          </p>
        </div>
      </Panel>
    </section>
  );
}
