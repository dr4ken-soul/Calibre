/**
 * Shared UI primitives. All colors flow through CSS tokens via Tailwind
 * arbitrary values. No hex literals appear in JSX.
 */

import { useEffect, useState, type ReactNode } from "react";

export function Panel({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag
      className={`rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_18px_60px_rgba(32,37,31,0.06)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PanelTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
      <h2 className="text-sm font-bold tracking-[0.14em] text-[var(--color-ink)] uppercase">{children}</h2>
      {hint ? <div className="font-mono-tech text-xs text-[var(--color-ink-muted)]">{hint}</div> : null}
    </div>
  );
}

export function SourceBadge({ source, stale, observedAt }: { source: string; stale?: boolean; observedAt?: number | null }) {
  const fallback = source === "deterministic-fallback";
  const label =
    source === "dreamdex-indexer-live"
      ? "DreamDEX indexer live"
      : fallback
        ? "deterministic fallback"
        : source;
  return (
    <span className="font-mono-tech inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-1 text-xs text-[var(--color-ink-muted)]">
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${
          stale
            ? "bg-[var(--color-warning)]"
            : fallback
              ? "bg-[var(--color-telemetry)]"
              : "bg-[var(--color-success)]"
        }`}
      />
      <span data-testid="source-label">{label}</span>
      {typeof observedAt === "number" ? (
        <span data-testid="observed-at">
          {stale ? "stale" : ""} {formatAge(observedAt)}
        </span>
      ) : null}
    </span>
  );
}

export function formatAge(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatCountdown(target: number, now = Date.now()): string {
  const ms = target - now;
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function LoadingBlock({ label = "Loading market data" }: { label?: string }) {
  return (
    <div className="space-y-3 p-6 sm:p-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-4 w-3/4 animate-pulse rounded-full bg-[var(--color-surface-raised)]" />
      <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--color-surface-raised)]" />
      <div className="h-24 w-full animate-pulse rounded-[1rem] bg-[var(--color-surface-raised)]" />
    </div>
  );
}

export function UnavailableBlock({ onRetry, what = "market data" }: { onRetry: () => void; what?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 p-6 sm:p-8">
      <p className="text-sm font-semibold text-[var(--color-ink)]">Unavailable</p>
      <p className="text-sm text-[var(--color-ink-muted)]">Could not load {what} right now.</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-12 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-raised)]"
      >
        Retry
      </button>
    </div>
  );
}

export function EmptyBlock({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex flex-col gap-2 p-6 sm:p-8">
      <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="text-sm text-[var(--color-ink-muted)]">{reason}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 p-6 sm:p-8" role="alert">
      <p className="text-sm font-semibold text-[var(--color-danger)]">Error</p>
      <p className="text-sm text-[var(--color-ink-muted)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-12 rounded-full border border-[var(--color-danger)] px-5 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)]"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "neutral" | "accent" | "success" | "danger" | "warning" | "telemetry"; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--color-surface-raised)] text-[var(--color-ink-muted)] border-[var(--color-line)]",
    accent: "bg-[var(--color-accent-soft)] text-[var(--color-ink)] border-[var(--color-accent-soft)]",
    success: "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-soft)]",
    danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger-soft)]",
    warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning-soft)]",
    telemetry: "bg-[var(--color-telemetry-soft)] text-[var(--color-telemetry)] border-[var(--color-telemetry-soft)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 font-mono-tech text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function LabeledValue({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">{label}</span>
      <span className={`text-sm font-semibold text-[var(--color-ink)] ${mono ? "font-mono-tech" : ""}`}>{value}</span>
    </div>
  );
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return reduced;
}
