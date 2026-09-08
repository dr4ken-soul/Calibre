/**
 * Execute section: guarded control surface.
 *
 * Wallet card on the left, guard list plus amount input and the approve flow
 * on the right. The approve button stays disabled until the wallet is
 * connected, the chain is right, the decision is trade, and no critical guard
 * fails. A confirmation modal summarizes the transaction before the wallet
 * prompt. Transaction states are Pending, Confirmed, and Failed and are never
 * simulated as success without a receipt.
 */

import { useEffect, useRef, useState } from "react";
import type { AuditResultWire, TradeRecordWire } from "@calibre/validation";
import { useWallet } from "../../hooks/useWallet.js";
import { confirmTrade, prepareTrade, ApiError } from "../../lib/data.js";
import { CHAIN_ID, EXPLORER_URL } from "../../config.js";
import { EmptyBlock, ErrorBlock, Panel, PanelTitle, StatusPill } from "../primitives.js";

const GUARD_TONES: Record<string, "success" | "warning" | "danger"> = {
  pass: "success",
  warn: "warning",
  fail: "danger",
};

type TxPhase =
  | { phase: "idle" }
  | { phase: "preparing" }
  | { phase: "confirm-modal"; amount: string }
  | { phase: "awaiting-wallet" }
  | { phase: "pending"; txHash: string }
  | { phase: "confirmed"; trade: TradeRecordWire }
  | { phase: "failed"; reason: string };

export function Execute({ audit }: { audit: AuditResultWire | null }) {
  const wallet = useWallet();
  const [amount, setAmount] = useState("0.01");
  const [txPhase, setTxPhase] = useState<TxPhase>({ phase: "idle" });
  const [prepError, setPrepError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const approveButtonRef = useRef<HTMLButtonElement | null>(null);

  const connected = wallet.state.phase === "connected";
  const criticalFail = audit?.guards.some((g) => g.critical && g.status === "fail") ?? true;
  const decisionAllows = audit?.decision === "trade";
  const canApprove =
    connected && !wallet.wrongChain && audit !== null && decisionAllows && !criticalFail;
  const busy =
    txPhase.phase === "preparing" ||
    txPhase.phase === "awaiting-wallet" ||
    txPhase.phase === "pending";

  useEffect(() => {
    if (txPhase.phase === "confirm-modal") {
      modalRef.current?.focus();
    }
  }, [txPhase.phase]);

  useEffect(() => {
    if (txPhase.phase === "idle" || txPhase.phase === "failed") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && txPhase.phase === "confirm-modal") {
        setTxPhase({ phase: "idle" });
        approveButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [txPhase.phase]);

  const startApproval = () => {
    if (!canApprove || !audit || !connected) return;
    setPrepError(null);
    setTxPhase({ phase: "confirm-modal", amount });
  };

  const submit = async () => {
    if (!canApprove || !audit || wallet.state.phase !== "connected") return;
    setTxPhase({ phase: "preparing" });
    try {
      const prepared = await prepareTrade({
        auditId: audit.auditId,
        amount,
        walletAddress: wallet.state.address,
      });
      const tx = prepared.data.tx;
      setTxPhase({ phase: "awaiting-wallet" });
      // The pool pulls tUSDC through the wallet's ERC-20 allowance. When the
      // on-chain allowance cannot cover the order cost, the API returns an
      // approval tx that the wallet signs first (one extra explicit prompt).
      if (prepared.approvalTx) {
        const approvalHash = await wallet.sendTransaction({
          to: prepared.approvalTx.to,
          value: prepared.approvalTx.value,
          data: prepared.approvalTx.data,
        });
        if (approvalHash === null) {
          setTxPhase({
            phase: "failed",
            reason: "The collateral approval was rejected in the wallet. Nothing was sent.",
          });
          approveButtonRef.current?.focus();
          return;
        }
      }
      const hash = await wallet.sendTransaction({
        to: tx.to,
        value: tx.value,
        data: tx.data,
      });
      if (hash === null) {
        setTxPhase({
          phase: "failed",
          reason: "The order was rejected in the wallet. Nothing was sent.",
        });
        approveButtonRef.current?.focus();
        return;
      }
      setTxPhase({ phase: "pending", txHash: hash });
      const confirmed = await confirmTrade({
        tradeId: prepared.data.tradeId,
        txHash: hash,
        walletAddress: wallet.state.address,
      });
      if (confirmed.data.status === "confirmed") {
        setTxPhase({ phase: "confirmed", trade: confirmed.data });
      } else {
        setTxPhase({ phase: "pending", txHash: hash });
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Execution failed.";
      setPrepError(message);
      setTxPhase({ phase: "failed", reason: message });
    }
  };

  return (
    <section
      id="execute"
      aria-labelledby="execute-title"
      className="relative isolate mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36 xl:px-16"
    >
      <div className="mb-10">
        <p className="font-mono-tech text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
          03 Execute
        </p>
        <h2
          id="execute-title"
          className="mt-3 text-[clamp(1.75rem,3.2vw,3.5rem)] font-bold leading-[1.0] tracking-[-0.045em] text-[var(--color-ink)]"
        >
          Nothing moves without you
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        {/* Wallet card */}
        <Panel className="self-start">
          <PanelTitle hint={`chain ${CHAIN_ID}`}>Wallet</PanelTitle>
          <div className="space-y-4 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
            {wallet.state.phase === "disconnected" && (
              <>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Read-only view. Connect a wallet to approve guarded orders.
                  Calibre never holds keys and never auto-signs.
                </p>
                <button
                  type="button"
                  onClick={() => void wallet.connect()}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold text-[var(--color-surface)] transition-transform duration-200 ease-out hover:-translate-y-0.5"
                >
                  Connect wallet
                </button>
              </>
            )}
            {wallet.state.phase === "connecting" && (
              <p className="text-sm text-[var(--color-ink-muted)]">Waiting for the wallet.</p>
            )}
            {wallet.state.phase === "error" && (
              <ErrorBlock message={wallet.state.message} onRetry={() => void wallet.connect()} />
            )}
            {connected && wallet.state.phase === "connected" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="success">Connected</StatusPill>
                  {wallet.wrongChain && <StatusPill tone="warning">Wrong chain</StatusPill>}
                </div>
                <p className="font-mono-tech text-xs break-all text-[var(--color-ink)]">
                  {wallet.state.address}
                </p>
                {wallet.wrongChain ? (
                  <button
                    type="button"
                    onClick={() => void wallet.ensureChain()}
                    disabled={wallet.chainSwitching}
                    className="min-h-12 w-full rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 text-sm font-semibold text-[var(--color-warning)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {wallet.chainSwitching ? "Switching" : "Switch to Somnia testnet"}
                  </button>
                ) : (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    Somnia testnet selected. Approvals are explicit per order.
                  </p>
                )}
              </>
            )}
            <p className="font-mono-tech text-xs leading-[1.5] text-[var(--color-ink-muted)]">
              Execution mode: DreamDEX BinaryPool order. A confirmed order is a
              real placeBinaryOrder call to the market's pool on Somnia testnet,
              settled on chain by the DreamDEX resolution flow.
            </p>
          </div>
        </Panel>

        {/* Guard list and approve flow */}
        <div className="space-y-4">
          <Panel>
            <PanelTitle hint={audit ? audit.decision.replace("_", " ") : "no audit"}>
              Guards
            </PanelTitle>
            {audit ? (
              <ul className="divide-y divide-[var(--color-line)]">
                {audit.guards.map((guard) => (
                  <li
                    key={guard.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 sm:px-6"
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        guard.status === "pass"
                          ? "bg-[var(--color-success)]"
                          : guard.status === "warn"
                            ? "bg-[var(--color-warning)]"
                            : "bg-[var(--color-danger)]"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink)]">
                        {guard.label}
                        <span className="sr-only">: {guard.status}</span>
                      </p>
                      <p className="mt-0.5 text-xs leading-[1.4] text-[var(--color-ink-muted)]">
                        {guard.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone={GUARD_TONES[guard.status] ?? "neutral"}>
                        {guard.status === "pass" ? "Pass" : guard.status === "warn" ? "Warn" : "Fail"}
                      </StatusPill>
                      {guard.critical ? (
                        <span className="font-mono-tech text-[0.625rem] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
                          critical
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBlock
                title="No guards evaluated yet"
                reason="Run an audit first. Guards only recheck against a stored audit and fresh market data."
              />
            )}
          </Panel>

          <Panel>
            <PanelTitle>Approve</PanelTitle>
            <div className="space-y-4 px-5 pb-6 pt-4 sm:px-6 sm:pb-8">
              <label htmlFor="trade-amount" className="block text-xs font-semibold text-[var(--color-ink-muted)]">
                Amount in outcome tokens
              </label>
              <input
                id="trade-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={busy}
                className="font-mono-tech min-h-12 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-describedby="amount-help"
              />
              <p id="amount-help" className="font-mono-tech text-xs text-[var(--color-ink-muted)]">
                Outcome token quantity for the selected direction. Cost is paid
                in tUSDC collateral through your wallet's pool allowance. The
                server rechecks guards before preparing and rejects duplicates.
              </p>

              <button
                ref={approveButtonRef}
                type="button"
                onClick={startApproval}
                disabled={!canApprove || busy}
                className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-[var(--color-surface)] transition-transform duration-200 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Working" : "Approve guarded order"}
              </button>

              <ul className="space-y-1 text-xs text-[var(--color-ink-muted)]">
                {!connected && <li>Connect a wallet to enable approval.</li>}
                {connected && wallet.wrongChain && <li>Switch to Somnia testnet to enable approval.</li>}
                {audit !== null && !decisionAllows && (
                  <li>The audit decision must be trade before an order can be prepared.</li>
                )}
                {audit !== null && decisionAllows && criticalFail && (
                  <li>A critical guard is failing, execution is blocked.</li>
                )}
              </ul>

              {prepError ? (
                <div role="alert">
                  <ErrorBlock message={prepError} onRetry={() => setPrepError(null)} />
                </div>
              ) : null}
            </div>
          </Panel>

          {/* Transaction state */}
          {txPhase.phase === "pending" && (
            <Panel>
              <PanelTitle>Pending</PanelTitle>
              <div className="space-y-2 px-6 pb-6 pt-4 sm:px-8 sm:pb-8" role="status" aria-live="polite">
                <StatusPill tone="warning">Pending</StatusPill>
                <p className="font-mono-tech text-xs break-all text-[var(--color-ink)]">
                  {txPhase.txHash}
                </p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Submitted. The receipt has not verified on chain yet, so this
                  stays Pending rather than claiming success.
                </p>
              </div>
            </Panel>
          )}
          {txPhase.phase === "confirmed" && (
            <Panel>
              <PanelTitle>Confirmed</PanelTitle>
              <div className="space-y-2 px-6 pb-6 pt-4 sm:px-8 sm:pb-8" role="status">
                <StatusPill tone="success">Confirmed</StatusPill>
                <p className="font-mono-tech text-xs break-all text-[var(--color-ink)]">
                  {txPhase.trade.txHash}
                </p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Receipt verified on Somnia testnet. See the transaction on the{" "}
                  <a
                    href={`${EXPLORER_URL}/tx/${txPhase.trade.txHash}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline decoration-[var(--color-line)] underline-offset-4"
                  >
                    explorer
                  </a>
                  . Next: watch settlement in Resolve.
                </p>
              </div>
            </Panel>
          )}
          {txPhase.phase === "failed" && (
            <Panel>
              <PanelTitle>Failed</PanelTitle>
              <div role="alert" aria-live="assertive" className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
                <StatusPill tone="danger">Failed</StatusPill>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{txPhase.reason}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTxPhase({ phase: "idle" });
                    approveButtonRef.current?.focus();
                  }}
                  className="mt-4 min-h-12 rounded-xl border border-[var(--color-danger)] px-5 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)]"
                >
                  Dismiss and retry
                </button>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {txPhase.phase === "confirm-modal" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-ink)]/40 p-4 backdrop-blur-sm">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[0_28px_90px_rgba(32,37,31,0.3)]"
          >
            <h3 id="confirm-title" className="text-lg font-bold text-[var(--color-ink)]">
              Confirm the guarded order
            </h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-ink-muted)]">Market</dt>
                <dd className="font-mono-tech text-right text-[var(--color-ink)]">
                  {audit?.marketId ?? "unknown"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-ink-muted)]">Direction</dt>
                <dd className="font-mono-tech text-[var(--color-ink)]">
                  {audit?.direction === "up" ? "Up" : "Down"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-ink-muted)]">Amount</dt>
                <dd className="font-mono-tech text-[var(--color-ink)]">{txPhase.amount} tokens</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-ink-muted)]">Audit</dt>
                <dd className="font-mono-tech text-right text-[var(--color-ink)]">
                  {audit?.auditId ?? "unknown"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-[1.5] text-[var(--color-ink-muted)]">
              The wallet will ask for an explicit collateral approval when the
              pool allowance is short, then the BinaryPool order itself. Both
              are real Somnia testnet transactions. The order fills against the
              live DreamDEX book or expires immediately as a market order.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void submit()}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-[var(--color-surface)]"
              >
                Continue to wallet
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxPhase({ phase: "idle" });
                  approveButtonRef.current?.focus();
                }}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-raised)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
