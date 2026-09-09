# Calibre Demo Script

Target duration: 2 minutes 30 seconds
Audience: DreamDEX and Somnia hackathon judges
App: https://calibre-web-beryl.vercel.app (API: https://calibre-tvq3.onrender.com)
Data: live DreamDEX indexer (dev.smk.somnia.host/v1/graphql), Somnia testnet, chain 50312

## Before recording, 5 minutes of prep

1. Open https://calibre-tvq3.onrender.com/api/health once and wait for the
   "ok" JSON. The free-tier API sleeps after idle and needs about 50 seconds
   to wake. Do this first so no part of the recording shows a cold start.
2. Open the app in a clean browser window. The badge in the Observe header
   must read "DreamDEX indexer live". If it says "deterministic fallback",
   wait and hit Refresh (top right of Observe).
3. Wallet: use a Somnia testnet wallet with STT for gas. Trades also need
   tUSDC collateral from the SomniaHacks faucet topic
   (https://t.me/+XHq0F0JXMyhmMzM0, same group as the STT faucet).
4. Pick the recording market: in Observe, open the dropdown under the
   "Markets" panel title. Fresh markets read like "ETH Up or Down 0x…" and
   the "Time to lock" panel shows a real countdown, not 00:00. Markets roll
   every 5 minutes, so the default selection is always fresh.
5. Optional: add the Somnia testnet to the wallet first (chain 50312, RPC
   https://dream-rpc.somnia.network) so the "Wrong chain" pill never appears.

## Core story

A prediction market price looks actionable, but price alone does not prove
the trade is worth taking. Calibre audits the probability against the live
DreamDEX book, checks execution guards, prepares a real BinaryPool order,
and records what happened after settlement. No trade is a first-class
outcome.

## 0:00 to 0:15, the problem

Screen: landing Hero.

DO:

1. Show the "Live market state" card on the right: the Trading pill, the
   asset ticker, the question, and the row Market id / Implied / Strike /
   Volume 24h.
2. Point at the "DreamDEX indexer live" badge with its age, for example
   "5s ago".

SAY: "Event Contracts make the direction simple. The hard part is knowing
whether the price deserves your money. Calibre is an audit layer for
DreamDEX Event Contracts: it reads the live indexer, compares the market
probability with an independent estimate, and only prepares a real order
when the guards pass. Everything on screen is live testnet data."

## 0:15 to 0:40, observe a fresh market

Screen: section 01 Observe.

DO:

1. Click the market dropdown under the "Markets" panel title and pick the
   first "Up or Down" entry (a Trading market).
2. Point at the Market id, Question, and Status rows below the dropdown.
   Hover the Market id to show the full 0x id in the tooltip.
3. Point at the "Time to lock" countdown: minutes counting down, plus the
   "Time to expiry" line below it.
4. Point at "Market pressure": Implied probability, Momentum, Current
   price, Open interest. Values the indexer does not carry read "n/a",
   never a fake zero.
5. Point at the Order book table: Ask rows above Bid rows, prices are
   implied probabilities in percent.

SAY: "Every decision starts with a real market from the DreamDEX indexer.
Market id, question, lifecycle, countdown, and the live order book all come
from the protocol feed. Fields the venue does not provide, like momentum,
read n/a instead of inventing a number."

## 0:40 to 1:05, run the audit

Screen: section 02 Audit.

DO:

1. Click the "Audit this market" button at the top right of the Audit
   section (next to the "Two probabilities, one decision" heading).
2. Wait about a second. The split view appears: "Market implies" on the
   left, the edge badge in the middle, "Calibre estimates" on the right.
3. Read the decision banner under it: it is exactly one of "Guarded trade
   available", "No trade", or "Insufficient data".
4. Point at the Guards list: Data freshness, Market lifecycle, Time to
   expiry, Edge threshold, Model confidence, Liquidity, Order book. Each
   row shows pass, warn, or fail, plus critical or advisory.
5. Point at the Evidence table with per-value sources and timestamps.

SAY: "One click runs the audit on the API. The market says one probability,
the audit estimates another from book depth, imbalance, and time pressure,
and the difference is the edge. But edge alone never triggers a trade: the
guards recheck data freshness, lifecycle, liquidity, and runway, and any
critical failure blocks execution."

## 1:05 to 1:30, execute or refuse

Screen: section 03 Execute.

If the banner said No trade or Insufficient data (most common):

1. Point at the disabled "Approve guarded order" button.
2. Point at the reason list right below it, for example "The audit
   decision must be trade before an order can be prepared" or "A critical
   guard is failing, execution is blocked".
3. Do not connect a wallet. Leave the button disabled.

SAY: "This is the important path. When a guard fails, Calibre refuses. The
approve button stays disabled and the reason is stated, because a model
opinion cannot override protocol constraints. Avoiding a weak market is a
first-class outcome, and the audit is stored so it can be scored later."

If the banner said Guarded trade available:

1. Click "Connect wallet" in the Wallet panel on the left of Execute.
2. Approve the connection in the wallet extension. The panel now shows the
   Connected pill, your address, and "Somnia testnet selected".
3. In the Approve panel, keep the amount at 0.01 or type a small testnet
   amount into the "Amount in outcome tokens" field.
4. Click "Approve guarded order".

SAY: "Nothing moves without the user. The wallet connects through the
standard provider, the amount is explicit, and the server rechecks the
guards and the pool allowance before preparing anything."

## 1:30 to 1:55, confirm and send

Screen: the confirmation modal, then the wallet, then the transaction
panels.

DO:

1. In the modal, read out loud the Market id, Direction (Up or Down),
   Amount, and audit id.
2. Click "Continue to wallet". Cancel is also shown; point at it once.
3. The wallet may prompt twice: first the tUSDC allowance approval for the
   DreamDEX BinaryPool, then the placeBinaryOrder call itself. Approve both.
4. Back in the app: the Pending panel appears with the real transaction
   hash. Then the Confirmed panel appears with the same hash and an
   explorer link. Click the explorer link once to show the tx on
   shannon-explorer.somnia.network, then return.

SAY: "The order is a real placeBinaryOrder call to the market's own
BinaryPool on Somnia testnet. If the tUSDC allowance is short, the wallet
asks for the collateral approval first, then the order. Pending stays
Pending until the receipt verifies, and the hash is the actual on-chain
transaction, visible in the block explorer."

If the wallet is rejected or has no tUSDC: the Failed panel appears with
"Dismiss and retry". Showing one rejection is fine and honest: say "the
user can always refuse, and the app reports it instead of pretending
success".

## 1:55 to 2:15, settlement

Screen: section 04 Resolve.

DO:

1. Click "Resolve" in the top navigation pill.
2. Show the settlement timeline: the dots move from Listed through
   Trading to Locked to Resolved based on protocol status, not guesses.
3. For a market that just expired during the demo (markets roll every 5
   minutes): show the warning pill "Pending settlement" and the line
   "Current status locked" while the protocol settles it.
4. If a market reached a terminal state, show the Resolved pill, the
   Outcome Up or Down pill, closing price, resolved time, and source badge.
   If nothing settled yet, show the "No settlement yet" card and say why.

SAY: "Settlement is read, never guessed. The outcome, closing price, and
resolved time appear only after the protocol reports them, tied to the
market id from the resolution events."

## 2:15 to 2:30, calibration loop and close

Screen: sections 05 Learn and 07 Close.

DO:

1. Click "Learn" in the top navigation pill.
2. Point at the "7 days" range toggle and the "Audits recorded in range"
   count. Every audit run in this demo is already counted.
3. If the grid shows the honest empty state, read its text: "No audits were
   recorded in the selected range. Run audits in the Audit section and let
   markets settle, then this grid fills with real calibration data."
4. Scroll or click "Close" to end on the closing panel.

SAY: "Every audit links back to its settled outcome, so the estimate
quality is scored over time instead of asserted. Calibre is a protocol-aware
audit layer: probability, risk, execution, and settlement, all inspectable,
all on live Somnia testnet data."

## Contingencies

- All trading markets vanish between rolls: the list tiers down to any
  market, and countdowns show Closed for expired ones. Wait 1 to 2 minutes
  and click Refresh.
- The badge shows "deterministic fallback": the API was unreachable; wait
  or retry, the badge flips back to "DreamDEX indexer live" on its own.
- Wrong chain pill: click "Switch to Somnia testnet" and approve in the
  wallet.
- A guard flips between recording takes: that is the product working; say
  so and continue. Never hide a failing guard.
- Render API restart: the Learn counts can reset because the free tier has
  an ephemeral disk; the empty state is honest, do not pad it.

## Recording checklist

- Clean browser profile, wallet on Somnia testnet (chain 50312) with STT,
  and tUSDC if the trade path will be shown.
- Warm the API with the /api/health check before pressing record.
- Keep the selected market id visible during audit, execute, and resolve.
- Show the source badge and its age before quoting any number.
- Show the failing-guard path first; the trade path is the bonus, not the
  proof.
- Never show seed phrases or private keys.
- Do not claim profitability or show any performance number that the Learn
  grid did not compute from real audits.

## Judge takeaway

Calibre is not another opinion generator. It is a protocol-aware decision
workflow that makes the probability, risk, execution, and settlement of a
DreamDEX Event Contract inspectable, with real indexer data and real
BinaryPool execution on Somnia testnet.
