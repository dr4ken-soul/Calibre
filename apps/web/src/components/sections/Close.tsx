/**
 * Closing section: quiet final statement.
 *
 * One short line, a clear next action, and the product name as text. No brand
 * symbol, no second hero.
 */

import { APP_VERSION, EXPLORER_URL } from "../../config.js";

export function Close() {
  return (
    <section
      id="close"
      aria-labelledby="close-title"
      className="relative mx-auto max-w-[1440px] overflow-hidden border-t border-[var(--color-line)] px-5 py-24 sm:px-8 lg:px-12 lg:py-36 xl:px-16"
    >
      <p className="font-mono-tech text-xs font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
        07 Close
      </p>
      <h2
        id="close-title"
        className="mt-3 max-w-[12ch] font-sans text-[clamp(2.25rem,5vw,5.5rem)] font-extrabold leading-[0.94] tracking-[-0.06em] text-[var(--color-ink)]"
      >
        Calibrated restraint
      </h2>
      <p className="mt-6 max-w-[34rem] text-base leading-[1.55] text-[var(--color-ink-muted)]">
        Calibre exists to make one number trustworthy: the probability you act
        on. When the estimate and the market disagree, the guards decide
        before the wallet is ever asked.
      </p>
      <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <a
          href="#observe"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-raised)]"
        >
          Back to a live market
        </a>
        <a
          href={EXPLORER_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-[var(--color-ink-muted)] underline decoration-[var(--color-line)] underline-offset-4 transition-colors hover:text-[var(--color-ink)]"
        >
          Open the Somnia explorer
        </a>
      </div>
      <p className="font-mono-tech mt-16 text-xs text-[var(--color-ink-muted)]">
        Calibre, {APP_VERSION}, built for Somnia testnet.
      </p>
    </section>
  );
}
