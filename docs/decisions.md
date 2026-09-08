# Decisions

Key trade-offs made during the build, with the reasoning.

## JSON file store over a database

The API persists audits, trades, settlements, and calibration rows in a JSON file store. For a hackathon build on testnet this keeps the deployment a single process with zero external dependencies, while the storage layer is isolated behind a repository interface so a database can replace it without touching services. The trade-off is no concurrent multi-process writes, which is acceptable for a single-instance testnet deployment.

## No public DreamDEX SDK: disclose, do not fake

DreamDEX has not published a public SDK, API, or Event Contract addresses. Rather than inventing a plausible-looking live feed, Calibre ships:

- an HTTP adapter implementing the expected live endpoint shape, inactive until a base URL is configured;
- a deterministic fallback feed, seeded and reproducible, labeled "deterministic fallback" at every surface where data appears.

The decision cost is that the app cannot claim live venue data today. The benefit is the demo never lies about its data source, and the swap to real endpoints is a configuration change.

## Self-transfer demo execution

Because Event Contract addresses are unpublished, a prepared order is a value transfer to the user's own wallet address. This preserves the full real flow: server guard recheck, unsigned transaction preparation, one explicit wallet signature, on-chain submission, receipt verification, and confirmation states. It is disclosed in the Execute panel and the approval modal. The alternative, simulating a fill against a fake contract, would fabricate the exact thing the product exists to audit.

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
