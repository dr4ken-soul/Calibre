# Architecture

Calibre sits between the user's wallet and the DreamDEX venue on Somnia testnet. It reads market data, runs an independent probability audit, gates execution behind deterministic guards and explicit wallet approval, and links settlement outcomes back to audits for calibration.

## Flow

```text
+----------+      read       +-------------+     read      +---------------+
|  Wallet  | <-------------- | Market Data | <----------- | DreamDEX Event |
| (EIP-    |                  | (adapter)   |               |    Contract    |
|  1193)   |                  +------+------+               +---------------+
+----+-----+                         |
     ^                              v
     | sign once              +--------------+
     | per order              | Calibre Audit |
     |                        |  estimate,   |
     |                        |  guards,     |
     |                        |  decision    |
     |                        +------+-------+
     |                               |
     |        +----------------------v-------------------+
     |        | Execute: prepare, recheck guards,       |
     |        | explicit approval, receipt verification |
     |        +----------------------v-------------------+
     |                               |
     |                        +------v-------+     +------------+
     +----------- write -------->|  Settlement | -->|  Learn:    |
          (only with            |   reader    |     | calibration|
           a signature)         +--------------+     +------------+
```

## Trust boundaries

1. Wallet. Keys never leave the user's wallet. Calibre requests accounts, chain switching, and one explicit transaction approval per order. Nothing is auto-signed.
2. Market data. Order books and market state arrive through an adapter. The deterministic fallback is labeled at every surface. The audit only uses what the adapter publishes.
3. Calibre audit. The engine compares the market-implied probability with an independent estimate from book depth, imbalance, and momentum, then evaluates guards. Guards recheck against a fresh snapshot at execution time.
4. DreamDEX Event Contract. The venue owns its rules. Calibre can refuse an order but cannot alter venue state.
5. Settlement. Outcomes come from the protocol lifecycle status of the market id, never from question text. Settled audits feed calibration metrics.

## Monorepo layout

```text
packages/domain           audit engine, guards, fixed-point math
packages/validation        Zod schemas and wire conversion
packages/dreamdex-adapter  adapter interface, HTTP adapter, deterministic fallback
apps/api                   Express API, storage, settlement poller, calibration
apps/web                   React surface with the seven sections
```

## Data loop

1. Observe: the poller lists markets every 15 seconds, the web app marks data stale after 90 seconds, and every datum carries its source and timestamp.
2. Audit: a POST creates an audit from a fresh snapshot. The optional Groq adjustment is bounded to 800 basis points, Zod validated, and any failure falls back to the deterministic estimate with an honest reason.
3. Execute: prepare rechecks guards server side against a fresh snapshot and returns the unsigned transaction. The wallet signs once. Confirm verifies the receipt before anything is shown as Confirmed.
4. Resolve: the settlement poller checks terminal markets every 30 seconds and records outcome, closing price, and resolved time.
5. Learn: calibration metrics aggregate settled audits: prediction count, average confidence error, avoided trades, executed trades.

## Execution honesty rules

- Trades always require the API, because the server must recheck guards against a fresh snapshot.
- A wallet rejection is a failed state, never a silent retry.
- Pending means submitted without a verified receipt. Confirmed requires the receipt check.
- Until DreamDEX publishes Event Contract addresses, execution is a labeled self-transfer demo on Somnia testnet, disclosed in the UI and the approval modal.
