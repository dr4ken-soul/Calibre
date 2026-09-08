/**
 * Adapter resolution. Prefers the live HTTP path when configured, and falls
 * back to the deterministic, clearly labeled generator otherwise. The active
 * source label is exposed so every caller can label its data honestly.
 */

import type { DreamDexAdapter } from "./types.js";
import { FallbackAdapter, FALLBACK_SOURCE, generateSnapshot } from "./fallback.js";
import { HttpAdapter, HTTP_SOURCE } from "./http.js";

export { FallbackAdapter, FALLBACK_SOURCE, generateSnapshot, HttpAdapter, HTTP_SOURCE };
export type * from "./types.js";

export interface ResolveOptions {
  liveBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ResolvedAdapter {
  adapter: DreamDexAdapter;
  usingLive: boolean;
  sourceLabel: string;
}

export function resolveAdapter(options: ResolveOptions): ResolvedAdapter {
  const baseUrl = options.liveBaseUrl?.trim();
  if (baseUrl) {
    return {
      adapter: new HttpAdapter({ baseUrl, fetchImpl: options.fetchImpl }),
      usingLive: true,
      sourceLabel: HTTP_SOURCE,
    };
  }
  return {
    adapter: new FallbackAdapter(),
    usingLive: false,
    sourceLabel: FALLBACK_SOURCE,
  };
}
