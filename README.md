# Calibre

Calibre is an AI probability auditor and execution guard for DreamDEX Event Contracts on Somnia testnet.

It compares the market-implied probability with an independent estimate, checks market lifecycle and execution conditions, and gives the user a guarded trade or an explicit no-trade result. After settlement, it links the outcome back to the original audit for calibration. The product loop is Observe, Audit, Execute, Resolve, Learn.

## Project status

Implementation complete for hackathon submission. All workspaces have passing tests, clean typechecks, and a production web build.

## What is built

- An audit engine that always produces a decision: trade, no_trade, or insufficient_data. No trade is a first-class outcome.
- Deterministic guards that recheck at execution time: data freshness, market lifecycle, time to expiry, liquidity, order book availability, edge, and confidence.
- A guarded execution flow on Somnia testnet: wallet connection through the standard EIP-1193 window interface, explicit per-order approval, and honest transaction states (Pending, Confirmed, Failed). Confirmed requires a verified receipt.
- A settlement reader that follows market lifecycle status and links outcomes back to audits for calibration metrics.

## Setup

Requirements: Node 24 or newer and npm 11 or newer.

```bash
npm install
npm run dev:api
npm run dev:web
```

The web app runs on port 5173. The API runs on port 8787. The web app also works without the API: market reads and audits fall back to a deterministic browser engine, clearly labeled as such.

## Somnia testnet

Calibre targets Somnia testnet:

- Chain id: 50312 (0xc488)
- Currency: STT
- RPC: https://dream-rpc.somnia.network
- Explorer: https://shannon-explorer.somnia.network

To try the execution flow:

1. Add the Somnia testnet chain to your wallet. The app can do this for you: connect a wallet in the Execute section and press Switch to Somnia testnet when prompted.
2. Get testnet tUSDC and STT from the SomniaHacks Telegram group faucet topic at https://t.me/+XHq0F0JXMyhmMzM0.
3. Select a live market, run the audit, and approve a guarded order. The wallet asks for a collateral approval when the pool allowance is short, then the BinaryPool order itself.

## Environment variables

Copy `.env.example` to `.env`. All values are placeholders, no real secrets are committed.

- `VITE_API_URL`: base URL of the Calibre API. Leave empty to use the browser data layer directly against the live DreamDEX indexer.
- `VITE_DREAMDEX_INDEXER_URL`: DreamDEX GraphQL indexer URL. Defaults to the live Somnia testnet indexer; set `off` to force the labeled deterministic fallback feed.
- `VITE_DREAMDEX_API_URL`: optional legacy live DreamDEX HTTP base URL, superseded by the indexer URL.
- `DREAMDEX_INDEXER_URL`: server side DreamDEX GraphQL indexer URL, same default as the web setting.
- `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`: optional Groq configuration. Empty keeps the fully deterministic audit path.
- Audit thresholds (`AUDIT_MIN_EDGE`, `AUDIT_MIN_CONFIDENCE`, `AUDIT_MIN_SECONDS_TO_EXPIRY`, and others) are documented in `.env.example`.

## Architecture

npm workspaces monorepo, TypeScript strict throughout.

| Workspace | Purpose |
| --- | --- |
| packages/domain | Audit engine: probability estimation, guards, decision, fixed-point formatting |
| packages/validation | Zod schemas for every API boundary plus wire conversion |
| packages/dreamdex-adapter | DreamDEX adapter interface, live GraphQL indexer adapter, HTTP adapter, labeled deterministic fallback feed |
| apps/api | Express API: markets, audits, guarded trades, settlement poller, calibration, optional bounded Groq adjustment |
| apps/web | React 19 web surface: Observe, Audit, Execute, Resolve, Learn, Protocol, Close |

See docs/architecture.md for the flow diagram and docs/decisions.md for the trade-offs.

## Test instructions

```bash
npm test
```

Runs every workspace suite: domain 28 tests, validation 9, dreamdex-adapter 13, api 18, web 23. All 91 tests pass. Typechecks run with `npm run typecheck` per workspace or the build script in apps/web.

## Honest disclosures

Both integration boundaries are disclosed in the product UI itself:

- **DreamDEX market data feed.** Market data comes from the live DreamDEX GraphQL indexer on Somnia testnet and is labeled "DreamDEX indexer live" wherever data appears. A deterministic fallback feed remains available as a clearly labeled offline mode (set `VITE_DREAMDEX_INDEXER_URL=off`); it is never presented as live data.
- **Execution mode.** A confirmed order is a real `placeBinaryOrder` call to the market's DreamDEX BinaryPool contract on Somnia testnet, encoded from the published `@somnia-chain/markets-sdk` ABI with the pool address read from the indexer row. The order cost is pulled in tUSDC through the wallet's ERC-20 allowance; when the allowance is short the wallet is asked for an explicit approval first. The full guard, approval, transaction, and receipt flow is real and runs against the chain.

## No-brand-symbol policy

Version 1 ships without a logo or custom brand symbol. The product name renders as text. No sponsor mark is added without explicit approval.

## Approved documents

- FRONTEND_SPEC.md: visual system, layout, motion, responsive behaviour, accessibility
- APP_BLUEPRINT.md: product scope, architecture, data model, API contract, integration rules
- DEMO_SCRIPT.md: two minute thirty second demonstration walkthrough
- SUBMISSION_CHECKLIST.md: submission verification items
