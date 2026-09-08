/**
 * Adapter resolution. Prefers the live GraphQL indexer path when configured,
 * then the live HTTP path, and falls back to the deterministic, clearly
 * labeled generator otherwise. The active source label is exposed so every
 * caller can label its data honestly.
 */

import type { DreamDexAdapter } from "./types.js";
import { FallbackAdapter, FALLBACK_SOURCE, generateSnapshot } from "./fallback.js";
import { GraphqlAdapter, GRAPHQL_SOURCE } from "./graphql.js";
import { HttpAdapter, HTTP_SOURCE } from "./http.js";

export { FallbackAdapter, FALLBACK_SOURCE, generateSnapshot, GraphqlAdapter, GRAPHQL_SOURCE, HttpAdapter, HTTP_SOURCE };
export type * from "./types.js";

export interface ResolveOptions {
  indexerUrl?: string;
  liveBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ResolvedAdapter {
  adapter: DreamDexAdapter;
  usingLive: boolean;
  sourceLabel: string;
}

export function resolveAdapter(options: ResolveOptions): ResolvedAdapter {
  const indexerUrl = options.indexerUrl?.trim();
  if (indexerUrl) {
    return {
      adapter: new GraphqlAdapter({ indexerUrl, fetchImpl: options.fetchImpl }),
      usingLive: true,
      sourceLabel: GRAPHQL_SOURCE,
    };
  }
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
