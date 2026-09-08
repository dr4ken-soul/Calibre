# Calibre Build Guide

Status: approved implementation guide
Read first: APP_BLUEPRINT.md and FRONTEND_SPEC.md

## 1. Build objective

Build Calibre as a working Somnia testnet application that audits DreamDEX Event Contracts, guards execution, and records settlement outcomes.

The implementation must prove the complete product loop:

Observe -> Audit -> Execute -> Resolve -> Learn

## 2. Non-negotiable rules

- Use real DreamDEX market and lifecycle data wherever the interface displays live values.
- Use a clearly labeled deterministic fallback only when testnet data is unavailable.
- Use market ID as the durable market identity.
- Use bigint-safe or fixed-point arithmetic for prices and token amounts.
- Gate every action on current on-chain status.
- Never claim transaction success before receipt verification.
- Never claim settlement before on-chain confirmation.
- Never auto-sign or auto-submit a transaction.
- Do not add a logo, mascot, sponsor symbol, or custom brand mark without approval.
- Do not add fabricated performance statistics.
- Do not use purple or blue AI glow, generic crypto neon, or decorative charts without data meaning.
- Do not use em dashes in user-facing copy, documentation, comments, or generated content.

## 3. Implementation sequence

### Phase 0: repository foundation

- create the approved folder structure
- configure TypeScript
- configure linting and formatting
- configure environment variables
- add health endpoint
- add error boundary and logging policy
- add a minimal README setup path

Exit condition: the project starts locally and reports its configuration status.

### Phase 1: protocol adapter

- configure Somnia testnet
- verify wallet connection
- install and verify the DreamDEX SDK
- implement market discovery
- implement lifecycle status reads
- implement order-book reads
- normalize values into the domain package
- add source timestamps and stale detection

Exit condition: the application can display a real market, market ID, status, probability, expiry, and order-book summary.

### Phase 2: domain and persistence

- create domain types
- add Zod schemas
- create database migration
- add users and preferences
- add market snapshots
- add audits and evidence
- add trades and settlements
- add system events

Exit condition: a market snapshot and audit can be stored and retrieved without losing precision.

### Phase 3: audit engine

- define the audit input bundle
- implement deterministic guard evaluation
- add the independent estimate provider
- validate structured model output
- store model version and timestamps
- implement trade, no-trade, and insufficient-data decisions
- expose the audit API

Exit condition: the same input produces a reproducible validated audit result.

### Phase 4: frontend decision surface

- implement the approved shell
- implement the sticky section indicator
- build the asymmetric framed portal
- build Observe, Audit, Execute, Resolve, Learn, Protocol, and closing sections
- implement loading, stale, unavailable, empty, and error states
- connect live data
- add wallet state

Exit condition: a user can inspect a real market and understand why the audit exists.

### Phase 5: guarded execution

- prepare a transaction from a validated audit
- recheck status and guard conditions on the server
- request wallet approval
- display pending state
- verify the receipt
- handle rejected and failed transactions
- prevent duplicate submission
- store transaction hash

Exit condition: a small testnet transaction can move from preparation to verified confirmation.

### Phase 6: settlement and calibration

- poll lifecycle and settlement state
- distinguish resolved and voided markets
- link settlement to the market ID
- update trade and settlement records
- calculate confidence error
- display history and calibration

Exit condition: a completed market can be traced from audit to outcome.

### Phase 7: motion, quality, and submission

- add coded telemetry canvas
- add SVG state morphing
- add unified sticky canvas behavior
- test reduced motion
- test keyboard navigation
- test narrow screens
- remove direct colour literals from JSX
- verify no brand symbols were added
- record the demo
- complete the submission checklist

Exit condition: the demo is reliable, explainable, and reproducible on a clean setup.

## 4. Data implementation rules

Use these boundaries:

- wallet writes happen through the user's wallet
- public market reads use the protocol adapter
- model output is treated as untrusted input
- server validation runs before persistence
- UI components consume typed domain objects
- display formatting happens at the UI boundary
- raw SDK objects do not pass directly into visual components

Every market snapshot should include:

- market ID
- asset
- direction
- lifecycle status
- probability
- best bid
- best ask
- volume
- expiry
- observed timestamp
- source

## 5. Frontend implementation rules

Read FRONTEND_SPEC.md before implementing any component.

Required:

- Tailwind classes must follow the approved token system.
- Use Manrope and DM Mono only.
- Use the approved z-index contract.
- Keep canvas and SVG layers behind readable content.
- Keep the approve action disabled until all critical guards pass.
- Show source age beside live values.
- Provide text summaries for canvas content.
- Support reduced motion.
- Keep all actions keyboard reachable.
- Use a real error state instead of hiding a failed request.

Avoid:

- generic three-card feature rows
- a second hero section
- unexplained icon buttons
- automatic page transitions
- motion that continues when offscreen
- charts that imply performance without evidence
- a hardcoded protocol logo

## 6. Test order

Run tests in this order:

1. type checking
2. unit tests for arithmetic and guards
3. adapter tests with fixtures
4. API validation tests
5. database integration tests
6. frontend component tests
7. browser flow tests
8. testnet smoke test
9. reduced-motion and keyboard checks
10. clean-machine demo rehearsal

## 7. Testnet smoke test

Record the following evidence during the final test:

- wallet connection
- current chain ID
- market ID
- lifecycle status
- order-book timestamp
- audit ID
- guard result
- transaction hash
- receipt status
- settlement state or documented pending state

Do not expose private keys or seed phrases in screenshots or recordings.

## 8. Completion gates

The build is not ready when only the visual surface works. It is ready when:

- protocol data is real or clearly labeled
- the audit is validated
- no-trade works
- guarded execution works
- transaction states are truthful
- settlement handling is present
- history is linked by market ID
- accessibility checks pass
- the demo can be repeated without manual database edits

