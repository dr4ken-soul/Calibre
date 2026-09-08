+# Calibre App Blueprint

Status: approved product and engineering blueprint
Project: Calibre
Hackathon: Somnia x DreamDEX Event Contracts Hackathon
Network: Somnia testnet during the hackathon

## 1. Executive summary

Calibre is a probability auditor and execution guard for binary DreamDEX Event Contracts.

It compares the market-implied probability with an independently calculated estimate, checks liquidity and contract state, and presents a guarded action only when the edge survives configured rules. It can recommend no trade, which is a first-class outcome.

The product is not a generic AI chat panel or a dashboard that invents performance numbers. It is a decision instrument that makes market mechanics, model reasoning, execution risk, and settlement state visible.

## 2. Hackathon fit

| Criterion | Calibre response |
| --- | --- |
| Innovation and originality | Turns a short-window prediction contract into an auditable decision workflow |
| Technical implementation | Uses DreamDEX markets, order books, lifecycle state, wallet approval, execution, and settlement |
| User experience and design | Explains probability, liquidity, expiry, guards, and settlement in one narrative |
| Business and ecosystem impact | Helps new traders understand Event Contracts and gives operators a reusable execution guard |
| Presentation and demo | Shows a tempting market being rejected or approved for evidence-based reasons |

The submission should demonstrate a working testnet prototype, GitHub repository, and a two to three minute video.

## 3. Problem

Event Contracts compress a market view into a simple Up or Down decision. That simplicity can hide several risks:

- A market price is a probability signal, not a guarantee.
- Thin liquidity can erase an apparent edge through slippage.
- A market can be close to lock or outside a valid lifecycle state.
- A model can be directionally correct and still poorly calibrated.
- Users often have no concise explanation for why a trade was accepted or rejected.

Calibre makes the decision inspectable before money moves and accountable after settlement.

## 4. Product thesis

Calibre has three differentiators:

1. It treats no trade as a valid output.
2. It separates market probability from independent estimated probability.
3. It preserves the reasoning through settlement so confidence can be evaluated against the result.

Positioning statement:

> Calibre is the pre-trade and post-settlement audit layer for DreamDEX Event Contracts.

## 5. Validation plan

Interview five to ten crypto traders or prediction-market users.

Questions:

- How do you decide whether an Event Contract price is mispriced?
- What makes you skip a market?
- Which order-book facts do you check?
- What do you record after settlement?
- Would a pre-trade audit or calibration record change your behaviour?

| Hypothesis | Signal | Threshold |
| --- | --- | --- |
| Users need reasoning visibility | Users identify evidence as useful | 4 of 5 |
| Guardrails increase trust | Users can explain a blocked order | 4 of 5 |
| Settlement history creates retention | Users return to inspect decisions | 3 of 5 |
| Discovery is fast enough | User finds a valid market | Under 1 minute |

Live values must come from a real source or be visibly labeled as a deterministic testnet fallback.

## 6. Competition and advantage

| Alternative | Limitation | Calibre advantage |
| --- | --- | --- |
| Native DreamDEX screen | Access without a complete independent audit | Audit, guards, and calibration |
| Generic signal bot | Directional opinion with limited execution context | Probability comparison and lifecycle checks |
| Spreadsheet workflow | Manual and disconnected from chain state | Real-time, wallet-aware, on-chain flow |
| Social prediction feed | Crowd opinion without execution controls | Evidence-led trade or no-trade decision |

The strongest defensible surface is the combination of market ID, lifecycle, book depth, probability difference, explicit no-trade result, wallet-aware execution, and post-settlement calibration.

## 7. Product principles

- Evidence before action.
- No trade is a successful decision when guards reject the setup.
- Live data must show its source and age.
- Transaction state must never be simulated as success.
- The user approves the final transaction.
- Market IDs are durable identities. Question text is not.
- Fixed-point or bigint-safe arithmetic is mandatory.
- Every model result has a timestamp, source bundle, expiry context, and model version.
- The interface remains useful when AI is unavailable.

## 8. MVP feature set

### 8.1 Live market discovery

User story: As a trader, I want valid BTC and ETH Event Contracts so that I can choose a market without reading raw protocol data.

Acceptance:

- Lists live markets from the DreamDEX source.
- Shows market ID, asset, direction, probability, volume, spread, expiry, and lifecycle.
- Excludes invalid markets from the action flow.
- Displays stale and unavailable states.
- Uses market ID as the stable key.

Complexity: medium.

### 8.2 Probability audit

User story: As a trader, I want market probability compared with an independent estimate so that I can judge whether an edge is meaningful.

Acceptance:

- Shows market probability and Calibre probability separately.
- Shows the difference in percentage points.
- Shows confidence and evidence.
- Returns no trade when inputs are insufficient.
- Stores the audit snapshot before an order can be approved.

Complexity: high.

### 8.3 Execution guards

User story: As a trader, I want unsafe orders blocked so that theoretical edge does not become poor execution.

Acceptance:

- Checks lifecycle.
- Checks time to expiry.
- Checks order-book depth and spread.
- Checks wallet and balance.
- Shows pass, warning, or fail for each guard.
- Disables the action when a critical guard fails.

Complexity: high.

### 8.4 Explicit testnet execution

User story: As a trader, I want to approve a valid order through my wallet so that the audit connects to a real Event Contract transaction.

Acceptance:

- Uses the documented DreamDEX SDK path.
- Requests user approval.
- Shows pending, confirmed, failed, and rejected states.
- Prevents duplicate submission.
- Stores audit ID and transaction hash.

Complexity: high.

### 8.5 Settlement and calibration

User story: As a trader, I want to review settlement so that I can learn whether my confidence was justified.

Acceptance:

- Shows lifecycle from trading to resolved or voided.
- Reads final outcome from on-chain state.
- Links outcome to the original audit.
- Calculates confidence error or calibration bucket.
- Distinguishes resolved, voided, pending, and unavailable.

Complexity: high.

## 9. Out of scope for Version 1

- unattended live trading
- leverage or borrowing
- user-generated markets
- social feeds and follower graphs
- financial advice claims
- guaranteed profitability claims
- cross-chain execution
- proprietary oracle
- autonomous wallet signing
- native token
- mobile app
- brand logo or custom symbol

## 10. User flows

### Inspect a market

1. User opens Calibre.
2. App loads live Event Contracts.
3. User selects a market.
4. App reads lifecycle, book, probability, expiry, and volume.
5. Observe surface shows market state.
6. Audit begins only when required inputs are available.

### Approve a guarded trade

1. User reviews market and Calibre probabilities.
2. User opens evidence.
3. Guards evaluate status, expiry, liquidity, wallet, and edge threshold.
4. A critical failure keeps the action disabled.
5. User chooses direction and amount.
6. App confirms market ID, direction, amount, limit price, expiry, and audit timestamp.
7. Wallet requests approval.
8. App shows pending state.
9. App verifies the receipt.
10. App stores audit and transaction state.

### No-trade result

1. Calibre finds weak edge, stale data, unsafe expiry, or insufficient liquidity.
2. App shows the failing guard and evidence age.
3. User can save the audit as an avoided trade.
4. History records no trade as a useful decision.

### Settlement review

1. User opens history.
2. App finds the market by market ID.
3. App reads current on-chain status.
4. App displays resolved or voided outcome.
5. App compares outcome with the audit.
6. App updates calibration metrics.

## 11. Information architecture

| Route | Purpose | Access |
| --- | --- | --- |
| / | Entry and live decision surface | Public read, wallet optional |
| /markets | Discovery and filters | Public read |
| /markets/:marketId | Detailed audit and execution | Wallet for trade |
| /history | Audits, trades, settlements, calibration | Wallet or local session |
| /settings | Risk thresholds and preferences | Wallet or local session |
| /health | Integration status | Public read |

## 12. Screen map

### Root decision surface

Shows the Calibre thesis, connection status, selected market, telemetry canvas, probability comparison, and primary action.

### Market discovery

Shows asset, expiry, direction, and status filters. Each result shows source timestamp, probability, volume, spread, and lifecycle.

### Market audit

Shows market identity, probability comparison, confidence factors, order-book depth, time to expiry, lifecycle, guard list, and guarded action.

### History

Shows audit records, transaction state, market ID, settlement result, calibration summary, and filters for accepted, rejected, no trade, resolved, and voided.

### Settings

Shows minimum edge, minimum confidence, maximum slippage, minimum time to expiry, maximum position size, and data source status.

## 13. Technical architecture

### Frontend

- React with TypeScript.
- Vite or the repository-approved React starter.
- Tailwind CSS using the approved frontend specification.
- Wallet connector compatible with the Somnia testnet flow.
- TanStack Query for server and chain state.
- Zod for API and audit-result validation.
- Canvas telemetry component.
- Inline SVG state component.
- GSAP only for the pinned region if required.

### Backend

- TypeScript service using Fastify or the approved framework.
- DreamDEX SDK for supported reads and writes.
- Read adapters for markets, books, fills, candles, status, and settlement.
- AI audit service with provider adapter and structured output validation.
- PostgreSQL for audits, preferences, execution records, and settlement projections.
- Background settlement poller.
- No private key on the server.

### Data ownership

Browser: wallet connection, user approval, display state, read queries, receipt polling.

Server: normalized public market cache, audit orchestration, model records, settlement projection, rate limiting, validation.

Wallet: signing, transaction authorization, account identity.

## 14. DreamDEX integration rules

Use the current documented DreamDEX Event Contracts SDK surface. Isolate it inside a dedicated adapter.

Required operations:

- list active markets
- read market status
- read order book
- read probability and volume
- read expiry and asset metadata
- prepare or place a guarded limit order
- read transaction result
- read settlement and redemption state

Rules:

- Gate every action on on-chain market status.
- Do not trade near expiry without a configured rule.
- Never use floating point for token amounts or price encoding.
- Use market ID as the durable identity.
- Do not parse question text for lifecycle state.
- Treat indexer data as eventually consistent.
- Show source timestamps and stale state.
- Do not claim settlement before on-chain confirmation.
- Keep testnet identifiers in environment configuration.

## 15. Audit engine

Input bundle:

- market ID
- asset and direction
- market-implied probability
- best bid and best ask
- depth within configured slippage
- recent fills or candles
- time to expiry
- on-chain lifecycle
- independent signal values
- timestamp for every input

Output fields:

| Field | Rule |
| --- | --- |
| decision | trade, no_trade, or insufficient_data |
| direction | up, down, or null |
| marketProbability | normalized probability |
| calibreProbability | independent estimate |
| edge | difference between estimate and market |
| confidence | bounded confidence value |
| guards | pass, warn, or fail with messages |
| evidence | source, value, and observed time |
| modelVersion | explicit version |
| createdAt | ISO timestamp |

The engine must not output a trade decision without valid market status. It must not hide missing evidence. Confidence is not a profit guarantee. A no-trade result is stored and shown.

## 16. Database model

| Table | Purpose |
| --- | --- |
| users | Wallet identities and ownership |
| user_preferences | Risk thresholds |
| market_snapshots | Normalized public market inputs |
| audits | Immutable probability decisions |
| audit_evidence | Evidence rows |
| trades | User-approved transaction attempts |
| settlements | Resolved or voided projections |
| system_events | Integration and error observability |

Relationships:

- one user has many audits
- one audit has many evidence rows
- one audit has zero or one trade
- one trade has zero or one settlement projection
- one market has many snapshots and audits

## 17. API routes

### GET /api/markets

Query: asset, status, expiry, limit, cursor.

Returns market ID, asset, direction, probability, volume, spread, expiry, status, and observed time.

### GET /api/markets/:marketId

Returns normalized market, current book summary, lifecycle, expiry, and source timestamps.

### POST /api/audits

Request: market ID, risk profile, and client observed time.

The server rereads critical market values before creating an audit. Client values are diagnostic only.

### GET /api/audits/:auditId

Returns immutable audit, evidence, guard outcomes, and execution eligibility.

### POST /api/trades/prepare

Request: audit ID, direction, amount, and limit price.

Returns a typed transaction intent after rechecking guards.

### POST /api/trades/confirm

Request: audit ID and transaction hash.

The server verifies the receipt and updates trade state.

### GET /api/history

Returns audits, trades, settlement states, and calibration summaries for the connected wallet.

### GET /api/health

Returns status for DreamDEX adapter, database, AI provider, and settlement poller. It must not expose secrets.

## 18. Security and risk controls

- Validate external responses with Zod.
- Allowlist supported assets and market states.
- Never accept client probability as authoritative.
- Recheck values before preparing a transaction.
- Rate-limit audit requests.
- Redact provider keys and wallet data from logs.
- Store no private keys.
- Treat model output as untrusted input.
- Show an execution warning before signing.
- Prevent duplicate preparation for one audit.
- Add a circuit breaker when market data is stale.

## 19. Monetisation and ecosystem impact

Long-term possibilities:

- free read-only public audits
- paid advanced calibration history
- API access for strategy builders
- team workspaces for bot operators
- subscription or transaction pricing after validation

Hackathon impact:

- makes Event Contracts easier to understand
- increases informed participation
- gives traders a reason to revisit settled markets
- creates an audit layer for consumer apps and bots
- demonstrates a production-shaped DreamDEX integration

Keep monetisation out of the first demo. Prove utility and protocol depth first.

## 20. Launch and distribution

1. Publish a working testnet demo.
2. Publish the repository and setup instructions.
3. Record a two to three minute demo with both trade and no-trade paths.
4. Share a short visual showing the audit changing the decision.
5. Include concise DreamDEX SDK and documentation feedback.

After the hackathon:

- recruit prediction-market traders from Somnia and DreamDEX communities
- publish anonymized calibration examples
- offer a read-only public audit page
- invite bot builders to use the audit API
- publish Event Contract lifecycle integration notes

## 21. Four-week implementation plan

### Week 1: protocol foundation

Initialize the project, configure the testnet, connect a wallet, verify the SDK, list markets, read order books and lifecycle state, normalize the adapter, and add health checks.

Exit condition: a user can view a real market and its status.

### Week 2: audit and persistence

Create the database schema, evidence bundle, model adapter, structured output validation, audit screen, no-trade state, and stale-data handling.

Exit condition: a market produces a visible stored audit with evidence.

### Week 3: guarded execution

Implement guards, transaction preparation, wallet submission, receipt polling, failure handling, duplicate prevention, and trade persistence.

Exit condition: a user can approve or reject a real testnet order.

### Week 4: settlement and submission

Add settlement polling, resolved and void states, history, calibration, approved visual system, canvas, SVG motion, accessibility tests, README, and demo recording.

Exit condition: Observe, Audit, Execute, Resolve, and Learn work without hidden manual database edits.

## 22. Repository structure

DreamDex/
- apps/web/src/app
- apps/web/src/components
- apps/web/src/features/markets
- apps/web/src/features/audits
- apps/web/src/features/execution
- apps/web/src/features/settlement
- apps/web/src/features/calibration
- apps/web/src/lib
- apps/api/src/routes
- apps/api/src/services
- apps/api/src/adapters
- apps/api/src/workers
- packages/domain
- packages/validation
- packages/dreamdex-adapter
- packages/ui
- db/migrations
- docs
- FRONTEND_SPEC.md
- APP_BLUEPRINT.md
- DEMO_SCRIPT.md
- README.md
- .env.example

## 23. Required configuration

Create .env.example with placeholders only:

VITE_APP_NAME=Calibre
VITE_CHAIN_ID=50312
VITE_RPC_URL=
VITE_DREAMDEX_API_URL=
VITE_DREAMDEX_MARKETS_ADDRESS=
VITE_DREAMDEX_EVENT_CONTRACT_ADDRESS=
VITE_WALLETCONNECT_PROJECT_ID=
API_PORT=8787
DATABASE_URL=
AI_PROVIDER=
AI_MODEL=
AI_API_KEY=
AUDIT_MIN_EDGE=0.05
AUDIT_MIN_CONFIDENCE=0.65
AUDIT_MAX_SLIPPAGE=0.02
AUDIT_MIN_SECONDS_TO_EXPIRY=120

Do not commit real keys, private keys, wallet seeds, or unverified addresses.

## 24. Testing strategy

Unit tests:

- fixed-point arithmetic
- guard evaluation
- lifecycle mapping
- stale data detection
- audit output validation
- calibration calculation

Integration tests:

- market discovery adapter
- order-book normalization
- audit persistence
- transaction preparation
- receipt confirmation
- settlement projection

Frontend tests:

- loading, empty, and unavailable states
- no-trade state
- disabled approve action
- wallet rejection
- transaction failure
- keyboard navigation
- reduced-motion rendering

Manual testnet checks:

- connect and disconnect wallet
- select a current market
- verify status and expiry
- create an audit
- approve a small testnet order
- confirm the transaction
- inspect settlement
- verify history

## 25. Definition of done

The prototype is ready for submission when:

- a real testnet market loads
- lifecycle is visible
- the audit uses real market inputs
- no-trade works
- guarded execution reaches a real wallet transaction
- pending, confirmed, failed, and rejected states are visible
- settlement is read from on-chain state
- history links audit, transaction, and outcome
- the UI follows FRONTEND_SPEC.md
- the demo works without hidden manual database edits
- the repository contains setup instructions and environment placeholders
- the video explains problem, solution, product, demonstration, and future vision

