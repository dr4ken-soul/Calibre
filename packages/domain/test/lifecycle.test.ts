import { describe, expect, it } from "vitest";
import { statusFromTiming } from "../src/lifecycle.js";

describe("lifecycle", () => {
  const base = {
    openAt: 1000,
    lockAt: 5000,
    expiryAt: 6000,
    resolveDelayMs: 2000,
  };

  it("walks through the full lifecycle in order", () => {
    expect(statusFromTiming({ ...base, now: 500 })).toBe("listed");
    expect(statusFromTiming({ ...base, now: 1000 })).toBe("trading");
    expect(statusFromTiming({ ...base, now: 5500 })).toBe("locked");
    expect(statusFromTiming({ ...base, now: 6100 })).toBe("locked");
    expect(statusFromTiming({ ...base, now: 8000 })).toBe("resolved");
  });

  it("honours an explicit resolvedAt from the protocol", () => {
    expect(statusFromTiming({ ...base, now: 2000, resolvedAt: 1500 })).toBe("resolved");
  });
});
