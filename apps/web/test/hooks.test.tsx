// @vitest-environment jsdom
/**
 * Hook tests: usePoll state transitions with fake timers and the wallet
 * rejection path against a stubbed EIP-1193 provider.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePoll } from "../src/hooks/useData.js";
import { useWallet } from "../src/hooks/useWallet.js";
import { POLL_MS } from "../src/config.js";

function HookProbe<T>(props: { hook: () => T; onValue: (value: T) => void }) {
  props.onValue(props.hook());
  return null;
}

function renderHook<T>(hook: () => T): { values: T[]; unmount: () => void } {
  const values: T[] = [];
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <HookProbe hook={hook} onValue={(value) => values.push(value)} />,
    );
  });
  return {
    values,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

describe("usePoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves loading to ready when the fetcher resolves", async () => {
    let resolveFetch: ((value: { data: string; source: string; time: number } | null) => void) | null = null;
    const fetcher = () =>
      new Promise<{ data: string; source: string; time: number } | null>((resolve) => {
        resolveFetch = resolve;
      });

    const { values, unmount } = renderHook(() => usePoll(fetcher));
    expect(values.at(-1)!.status).toBe("loading");

    await act(async () => {
      resolveFetch?.({ data: "markets", source: "calibre-api", time: Date.now() });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(values.at(-1)!.status).toBe("ready");
    expect(values.at(-1)!.data).toBe("markets");
    expect(values.at(-1)!.source).toBe("calibre-api");
    unmount();
  });

  it("moves to unavailable when the fetcher resolves null", async () => {
    let resolveFetch: ((value: { data: string; source: string; time: number } | null) => void) | null = null;
    const fetcher = () =>
      new Promise<{ data: string; source: string; time: number } | null>((resolve) => {
        resolveFetch = resolve;
      });

    const { values, unmount } = renderHook(() => usePoll(fetcher));
    await act(async () => {
      resolveFetch?.(null);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(values.at(-1)!.status).toBe("unavailable");
    unmount();
  });

  it("moves to error when the fetcher rejects", async () => {
    let rejectFetch: ((reason: Error) => void) | null = null;
    const fetcher = () =>
      new Promise<{ data: string; source: string; time: number } | null>((_, reject) => {
        rejectFetch = reject;
      });

    const { values, unmount } = renderHook(() => usePoll(fetcher));
    await act(async () => {
      rejectFetch?.(new Error("boom"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(values.at(-1)!.status).toBe("error");
    expect(values.at(-1)!.error).toBe("boom");
    unmount();
  });

  it("refetches on the poll interval", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ data: "tick", source: "calibre-api", time: Date.now() });
    const { unmount } = renderHook(() => usePoll(fetcher));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("marks data stale after the stale threshold", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ data: "tick", source: "calibre-api", time: Date.now() });
    const { values, unmount } = renderHook(() => usePoll(fetcher));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(values.at(-1)!.stale).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(95_000);
    });
    expect(values.at(-1)!.stale).toBe(true);
    unmount();
  });
});

describe("useWallet rejection path", () => {
  class ProviderRejectedError extends Error {
    code = 4001;
  }

  it("reports a friendly error when the wallet rejects connection", async () => {
    const request = vi.fn((args: { method: string }) => {
      if (args.method === "eth_requestAccounts") {
        return Promise.reject(new ProviderRejectedError("User rejected"));
      }
      if (args.method === "eth_chainId") {
        return Promise.resolve("0xc488");
      }
      return Promise.resolve(null);
    });
    (window as { ethereum?: unknown }).ethereum = { request };

    let latest: ReturnType<typeof useWallet> | null = null;
    const { unmount } = renderHook(() => {
      const wallet = useWallet();
      latest = wallet;
      return wallet;
    });

    await act(async () => {
      await latest!.connect();
      await Promise.resolve();
    });
    expect(latest!.state.phase).toBe("error");
    if (latest!.state.phase === "error") {
      expect(latest!.state.message).toContain("rejected");
    }
    expect(request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    unmount();
    delete (window as { ethereum?: unknown }).ethereum;
  });

  it("stays disconnected when no provider exists", () => {
    delete (window as { ethereum?: unknown }).ethereum;
    let latest: ReturnType<typeof useWallet> | null = null;
    const { unmount } = renderHook(() => {
      latest = useWallet();
      return latest;
    });
    expect(latest!.state.phase).toBe("disconnected");
    unmount();
  });
});
