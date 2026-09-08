# Calibre Demo Script

Target duration: 2 minutes 30 seconds
Audience: DreamDEX and Somnia hackathon judges
Demo environment: Somnia testnet with a clearly labeled fallback if a live market is unavailable

## Core story

A prediction market price looks actionable, but price alone does not prove that the trade is worth taking. Calibre audits the probability, checks execution risk, and records what happened after settlement.

## 0:00 to 0:15, the problem

Screen: Calibre landing surface with the live portal visible.

Narration:

"Event Contracts make a directional decision simple. The hard part is knowing whether the price deserves your money. Calibre is an audit layer for DreamDEX Event Contracts. It compares the market price with an independent estimate, checks execution risk, and can say no trade."

## 0:15 to 0:35, discover a market

Screen: Observe section and market discovery.

Actions:

1. Connect the testnet wallet if needed.
2. Select a live BTC or ETH Event Contract.
3. Point out market ID, direction, probability, volume, expiry, and lifecycle.
4. Point out the source timestamp.

Narration:

"Every decision starts with a real market. Calibre reads the DreamDEX market ID, probability, order book, expiry, and on-chain lifecycle. The market is not treated as valid just because it appears in a list."

## 0:35 to 1:05, show the audit

Screen: Audit section.

Actions:

1. Start an audit.
2. Show market-implied probability.
3. Show Calibre probability.
4. Expand evidence.
5. Point out confidence, liquidity, and time to expiry.

Narration:

"Calibre separates what the market believes from what the audit estimates. The difference is shown as an edge, but edge alone is not enough. The evidence includes liquidity, time to expiry, and the current contract state. Every value has a source and timestamp."

## 1:05 to 1:30, demonstrate a no-trade decision

Screen: Execute section with a failing guard.

Actions:

1. Show a stale, thin, or near-expiry condition.
2. Point out the failing guard.
3. Attempt to select the action.
4. Show that approval remains disabled.
5. Save the result as an avoided trade.

Narration:

"This is the important path. When liquidity is too thin or expiry is too close, Calibre does not force a trade. It records no trade as a successful risk decision. The action stays disabled because a model opinion cannot override protocol and execution constraints."

## 1:30 to 1:55, demonstrate an approved testnet action

Screen: A second market or refreshed state with all guards passing.

Actions:

1. Select the approved market.
2. Show passing guards.
3. Set a small testnet amount.
4. Open final confirmation.
5. Confirm market ID, direction, amount, limit price, and audit timestamp.
6. Approve in the wallet.

Narration:

"When the edge survives the guards, the user still approves the final action. Calibre prepares a bounded testnet order and makes the exact market, direction, amount, price, and audit timestamp visible before the wallet request."

## 1:55 to 2:15, show transaction state

Screen: Pending, then confirmed state.

Actions:

1. Show pending state.
2. Show transaction hash.
3. Show confirmed state.

Narration:

"Transaction state is never simulated. Pending, confirmed, rejected, and failed are separate states. The transaction hash is stored only after the wallet returns it and the receipt is verified."

## 2:15 to 2:30, show settlement and future

Screen: Resolve and Learn sections.

Actions:

1. Show lifecycle timeline.
2. Show resolved or voided state.
3. Show audit history and calibration metrics.
4. End on the closing action.

Narration:

"After settlement, Calibre links the outcome back to the original audit. This creates a calibration loop instead of a one-time prediction. The result is a safer way to use Event Contracts and a reusable audit layer for traders, consumer apps, and bots."

## Recording checklist

- Use a clean browser profile.
- Confirm wallet is on the correct testnet.
- Preload one passing market and one no-trade market.
- Keep the market ID visible during the important steps.
- Avoid showing secrets, seed phrases, or private keys.
- Show the source timestamp before discussing a value.
- Record a backup version with the deterministic testnet fallback.
- Keep the cursor near the control being discussed.
- Do not claim profitability.
- Do not show fabricated settlement or performance data.

## Judge takeaway

Calibre is not another opinion generator. It is a protocol-aware decision workflow that makes the probability, risk, execution, and settlement of a DreamDEX Event Contract inspectable.

