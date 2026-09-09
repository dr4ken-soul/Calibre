/**
 * Data hooks with the full state matrix: loading, live, stale, unavailable,
 * empty, error. Polling with pause on tab hidden.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_MS, STALE_AFTER_MS } from "../config.js";
import { listMarkets, runAudit, type Sourced } from "../lib/data.js";
import type { AuditResultWire, MarketSnapshotWire } from "@calibre/validation";

export interface DataState<T> {
  status: "loading" | "ready" | "unavailable" | "error";
  data: T | null;
  source: string | null;
  observedAt: number | null;
  error: string | null;
  stale: boolean;
  refresh: () => void;
  lastAttemptAt: number;
}

export function isStale(observedAt: number | null, now: number): boolean {
  if (observedAt === null) return true;
  return now - observedAt > STALE_AFTER_MS;
}

export function usePoll<T>(
  fetcher: () => Promise<Sourced<T> | null>,
  initial: T | null = null,
): DataState<T> {
  const [state, setState] = useState<{
    status: DataState<T>["status"];
    data: T | null;
    source: string | null;
    observedAt: number | null;
    error: string | null;
    lastAttemptAt: number;
  }>({
    status: "loading",
    data: initial,
    source: null,
    observedAt: null,
    error: null,
    lastAttemptAt: Date.now(),
  });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetcherRef.current();
        if (cancelled) return;
        if (result === null) {
          setState((prev) => ({
            ...prev,
            status: "unavailable",
            lastAttemptAt: Date.now(),
          }));
        } else {
          setState({
            status: "ready",
            data: result.data,
            source: result.source,
            observedAt: result.time,
            error: null,
            lastAttemptAt: Date.now(),
          });
        }
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Request failed",
          lastAttemptAt: Date.now(),
        }));
      }
    };
    void load();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  return {
    ...state,
    refresh,
    stale: state.status === "ready" ? isStale(state.observedAt, now) : false,
  };
}

export function useMarkets(query: { asset?: string; status?: string; minRunwayMs?: number } = {}) {
  const fetcher = useCallback(async () => {
    // Tiered default: tradable markets with runway first, then any tradable
    // market, then any market, so the page degrades honestly instead of
    // showing an expired list when nothing fresh exists yet.
    const attempts: { asset?: string; status?: string; expiryAfter?: number; limit: number }[] = [
      {
        asset: query.asset,
        status: query.status,
        expiryAfter: Date.now() + (query.minRunwayMs ?? 0),
        limit: 12,
      },
      { asset: query.asset, status: query.status, expiryAfter: Date.now(), limit: 12 },
      { asset: query.asset, limit: 12 },
    ];
    let last: Awaited<ReturnType<typeof listMarkets>> | null = null;
    for (const attempt of attempts) {
      const result = await listMarkets(attempt);
      if (result.data.length > 0) return result;
      last = result;
    }
    return last;
  }, [query.asset, query.status, query.minRunwayMs]);
  return usePoll<MarketSnapshotWire[]>(fetcher, []);
}

export type AuditState = {
  status: "idle" | "loading" | "ready" | "error";
  audit: AuditResultWire | null;
  source: string | null;
  time: number | null;
  error: string | null;
};

export function useAudit() {
  const [state, setState] = useState<AuditState>({ status: "idle", audit: null, source: null, time: null, error: null });

  const audit = useCallback(async (marketId: string) => {
    setState({ status: "loading", audit: null, source: null, time: null, error: null });
    try {
      const result = await runAudit(marketId);
      setState({ status: "ready", audit: result.data, source: result.source, time: result.time, error: null });
      return result.data;
    } catch (error) {
      setState({
        status: "error",
        audit: null,
        source: null,
        time: null,
        error: error instanceof Error ? error.message : "Audit failed",
      });
      return null;
    }
  }, []);

  return { state, audit };
}
