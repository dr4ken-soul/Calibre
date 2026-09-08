/**
 * Environment driven configuration. All values are public build constants,
 * never secrets.
 */

export const APP_NAME = import.meta.env.VITE_APP_NAME ?? "Calibre";
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 50312);
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://dream-rpc.somnia.network";
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? null;
export const DREAMDEX_LIVE_URL =
  (import.meta.env.VITE_DREAMDEX_API_URL as string | undefined)?.trim() || null;

export const EXPLORER_URL = "https://shannon-explorer.somnia.network";

export const STALE_AFTER_MS = 90_000;
export const POLL_MS = 15_000;

export const APP_VERSION = "v1 (hackathon build)";
