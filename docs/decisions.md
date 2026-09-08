# Decisions

Key trade-offs made during the build, with the reasoning.

## JSON file store over a database

The API persists audits, trades, settlements, and calibration rows in a JSON file store. For a hackathon build on testnet this keeps the deployment a single process with zero external dependencies, while the storage layer is isolated behind a repository interface so a database can replace it without touching services. The trade-off is no concurrent multi-process writes, which is acceptable for a single-instance testnet deployment.

## Live DreamDEX indexer: read real market data

DreamDEX publishes a GraphQL indexer for Somnia testnet. Calibre reads it directly: markets, resting order books, pool addresses, and settlements all come from live rows and are labeled "DreamDEX indexer live" at every surface where data appears. A deterministic fallback feed remains as a clearly labeled offline mode (set `VITE_DREAMDEX_INDEXER_URL=off`). The fallback is never presented as live data.

## BinaryPool execution

A prepared order is a real `placeBinaryOrder` call to the market's DreamDEX BinaryPool contract, encoded with viem from the published `@somnia-chain/markets-sdk` ABI, with the pool address read from the indexer row. The price is derived from the freshest resting book, the expiry is capped at the market expiry, and the order type is immediate-or-cancel. Because a buy pulls tUSDC through the wallet's ERC-20 allowance, the API reads the on-chain allowance and returns a collateral approval transaction when it is short. The full flow stays real end to end: server guard recheck, unsigned transaction preparation, explicit wallet signatures, on-chain submission, receipt verification, and confirmation states.

## Bounded AI adjustment

The audit engine is deterministic first. An optional Groq pass may adjust the independent probability by at most 800 basis points, must survive a strict Zod schema including a reasoning string, and any failure returns the deterministic estimate with an honest reason. The decision and guards remain rule based either way. This bounds the blast radius of a hallucinating model to a nudge inside the estimate, never to a trade decision.

## Trades require the API

The web app can run standalone for reads and audits using the browser fallback engine. Trade preparation and confirmation deliberately require the API, because the server must recheck guards against a fresh snapshot before preparing an order and must verify the receipt before confirming. Letting the browser self-certify a trade would invert the trust boundary the product is built on.

## Raw window.ethereum instead of a wallet library

The web app talks to the standard EIP-1193 window.ethereum interface directly with no web3 library dependency. The flows needed are narrow: request accounts, read chain id, add or switch the Somnia chain, send one transaction. A library would add bundle weight and an abstraction over the exact states the UI must show honestly, including wallet rejection.

## BigInt fixed-point for prices

All probability and price math uses basis points as BigInt with explicit mulDiv rounding. Floating point never touches a price or probability that feeds a decision. Wire strings are decimal, converted at the validation boundary.

## Canvas colors from computed styles

The telemetry canvas parses its stroke colors from computed styles rather than hardcoding rgba strings, keeping every color sourced from the CSS token block. This satisfies the spec rule of no color literals in components and keeps theming centralized.
