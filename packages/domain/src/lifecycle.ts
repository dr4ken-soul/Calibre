import type { LifecycleStatus } from "./types.js";

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  listed: "Listed",
  trading: "Trading",
  locked: "Locked",
  resolved: "Resolved",
  redeemed: "Redeemed",
  voided: "Voided",
};

/** Only these statuses accept new orders. */
export function isTradable(status: LifecycleStatus): boolean {
  return status === "trading";
}

export function isTerminal(status: LifecycleStatus): boolean {
  return status === "resolved" || status === "redeemed" || status === "voided";
}

export function lifecycleLabel(status: LifecycleStatus): string {
  return LIFECYCLE_LABELS[status];
}

/**
 * Derive lifecycle status from protocol timing anchors. Adapters that talk to a
 * real protocol should read status from the protocol and must not use this.
 * The deterministic fallback uses it to stay consistent with its own clock.
 */
export function statusFromTiming(args: {
  now: number;
  openAt: number;
  lockAt: number;
  expiryAt: number;
  resolveDelayMs: number;
  resolvedAt?: number | null;
}): LifecycleStatus {
  const { now, openAt, lockAt, expiryAt, resolveDelayMs, resolvedAt } = args;
  if (resolvedAt != null) return "resolved";
  if (now >= expiryAt + resolveDelayMs) return "resolved";
  if (now >= expiryAt) return "locked";
  if (now >= lockAt) return "locked";
  if (now >= openAt) return "trading";
  return "listed";
}
