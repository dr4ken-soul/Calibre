/**
 * Web unit tests: format helpers, SourceBadge labels, StatusPill tones,
 * the local audit path, and the Sourced wrapper contract used by Resolve.
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import {
  formatAge,
  formatCountdown,
  SourceBadge,
  StatusPill,
} from "../src/components/primitives.js";
import { auditResultSchema, marketSnapshotSchema } from "@calibre/validation";
import { runAudit, listMarkets, getSettlement } from "../src/lib/data.js";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("formatAge", () => {
  it("formats seconds under a minute", () => {
    expect(formatAge(0, 10_000)).toBe("10s ago");
    expect(formatAge(0, 59_000)).toBe("59s ago");
  });

  it("clamps negative age to zero", () => {
    expect(formatAge(10_000, 0)).toBe("0s ago");
  });

  it("formats minutes under an hour", () => {
    expect(formatAge(0, 60_000)).toBe("1m ago");
    expect(formatAge(0, 59 * MINUTE)).toBe("59m ago");
  });

  it("formats hours under a day", () => {
    expect(formatAge(0, HOUR)).toBe("1h ago");
    expect(formatAge(0, 23 * HOUR + 59 * MINUTE)).toBe("23h ago");
  });

  it("formats days beyond a day", () => {
    expect(formatAge(0, DAY)).toBe("1d ago");
    expect(formatAge(0, 3 * DAY + 5 * HOUR)).toBe("3d ago");
  });
});

describe("formatCountdown", () => {
  it("returns 00:00 at and past the target", () => {
    expect(formatCountdown(1_000, 1_000)).toBe("00:00");
    expect(formatCountdown(0, 10_000)).toBe("00:00");
  });

  it("formats seconds only below one minute", () => {
    expect(formatCountdown(30_000, 0)).toBe("00:30");
    expect(formatCountdown(59_000, 0)).toBe("00:59");
  });

  it("formats minutes and seconds below one hour", () => {
    expect(formatCountdown(5 * MINUTE + 7_000, 0)).toBe("05:07");
    expect(formatCountdown(59 * MINUTE + 59_000, 0)).toBe("59:59");
  });

  it("switches to hours at one hour and beyond", () => {
    expect(formatCountdown(HOUR, 0)).toBe("1:00:00");
    expect(formatCountdown(2 * HOUR + 3 * MINUTE + 4_000, 0)).toBe("2:03:04");
  });
});

describe("SourceBadge", () => {
  it("renders the deterministic fallback label for the fallback source", () => {
    const html = renderToString(
      <SourceBadge source="deterministic-fallback" observedAt={Date.now()} />,
    );
    expect(html).toContain("deterministic fallback");
    expect(html).not.toContain("Live");
  });

  it("renders the raw label for any other source", () => {
    const html = renderToString(
      <SourceBadge source="calibre-api" observedAt={Date.now()} />,
    );
    expect(html).toContain("calibre-api");
  });
});

describe("StatusPill", () => {
  it("maps each tone to its token classes", () => {
    const tones = ["neutral", "accent", "success", "danger", "warning", "telemetry"] as const;
    for (const tone of tones) {
      const html = renderToString(<StatusPill tone={tone}>{tone}</StatusPill>);
      expect(html).toContain(tone);
      expect(html).toContain("rounded-full");
    }
  });

  it("renders exact status labels", () => {
    for (const label of ["Trading", "Locked", "Resolved", "Voided", "Pending", "Confirmed", "Failed", "Unavailable"]) {
      expect(renderToString(<StatusPill tone="neutral">{label}</StatusPill>)).toContain(label);
    }
  });
});

describe("local data path without the API", () => {
  it("listMarkets returns schema-valid fallback markets", async () => {
    const result = await listMarkets({ limit: 12 });
    expect(result.source).toBe("deterministic-fallback");
    expect(result.data.length).toBeGreaterThan(0);
    for (const market of result.data) {
      expect(marketSnapshotSchema.safeParse(market).success).toBe(true);
    }
  });

  it("runAudit returns a schema-valid audit for a fallback market", async () => {
    const markets = await listMarkets({ limit: 12 });
    const market = markets.data[0]!;
    const result = await runAudit(market.marketId);
    expect(auditResultSchema.safeParse(result.data).success).toBe(true);
    expect(result.data.marketId).toBe(market.marketId);
    expect(result.data.guards.length).toBeGreaterThan(0);
    expect(["trade", "no_trade", "insufficient_data"]).toContain(result.data.decision);
  });

  it("getSettlement returns null for non-terminal markets and data for terminal ones", async () => {
    const markets = await listMarkets({ limit: 12 });
    const live = markets.data.find((m) => m.status === "trading" || m.status === "listed");
    if (live) {
      expect(await getSettlement(live.marketId)).toBeNull();
    }
    const settled = markets.data.find(
      (m) => m.status === "resolved" || m.status === "redeemed" || m.status === "voided",
    );
    if (settled) {
      const result = await getSettlement(settled.marketId);
      expect(result).not.toBeNull();
      // The Sourced wrapper carries source and time outside data, matching
      // what Resolve stores into its view.
      expect(result!.source).toBe("deterministic-fallback");
      expect(typeof result!.time).toBe("number");
    }
  });
});
