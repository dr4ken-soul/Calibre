# Calibre Demo Script

Target duration: 2 minutes 30 seconds
Format: PURE SILENT SCREEN RECORDING. No narration, no voice-over, no
background audio, no captions, no subtitles, no on-screen text overlays.
The video shows only your cursor moving, clicking, hovering, and waiting.
Every action below is physical: click, hover, scroll, wait. There is
nothing to say anywhere in this script.
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
3. Wallet: use a Somnia testnet wallet with STT for gas and tUSDC for
   collateral from the SomniaHacks faucet topic
   (https://t.me/+XHq0F0JXMyhmMzM0).
4. Pick the recording market before pressing record: in Observe, open the
   dropdown under the "Markets" panel title. Fresh markets read like
   "ETH Up or Down 0x..." and the "Time to lock" panel shows a real
   countdown, not 00:00. Markets roll every 5 minutes, so the first
   "Up or Down" entry in the list is always fresh.
5. Optional: add the Somnia testnet to the wallet first (chain 50312, RPC
   https://dream-rpc.somnia.network) so the "Wrong chain" pill never appears.
6. Close all other tabs and notifications before recording.

## How to follow this shot list

- Times are rough targets for a 2:30 video. Do not rush. Waiting IS the
  demo: let countdowns tick, let panels fill, let the audit run.
- "Hover" means move the cursor over the element and hold it still for
  about 2 seconds so the viewer can read it.
- "Dwell" means slowly circle the cursor around an element for 2 to 3
  seconds so the viewer's eye follows your cursor.
- No keyframes, no zooms, no edits needed. One continuous screen capture.

## 0:00 to 0:15, the landing

Screen: app just opened, top of the page, section 00 Hero.

1. Wait 2 seconds. Let the page settle.
2. Dwell over the "Live market state" card on the right: the Trading pill,
   the asset ticker, the question, and the rows Market id, Implied,
   Strike, Volume 24h.
3. Hover the "DreamDEX indexer live" badge and its age, for example
   "5s ago". Let the age number tick up once or twice.
4. Scroll down slowly to section 01 Observe.

## 0:15 to 0:40, observe a fresh market

Screen: section 01 Observe.

1. Click the market dropdown under the "Markets" panel title.
2. Move the cursor down the list once so the viewer sees several entries,
   then click the first "Up or Down" entry.
3. Dwell over the detail rows below: Market id, Question, Status.
4. Hover the Market id row and hold. The full 0x id appears in the
   tooltip. Hold 2 seconds.
5. Dwell over the "Time to lock" countdown. Wait 5 seconds on it so the
   timer visibly counts down. Same for the "Time to expiry" line below.
6. Dwell over "Market pressure": Implied probability, Momentum, Current
   price, Open interest. Some read "n/a". That is honest: the indexer does
   not track them.
7. Dwell over the Order book table: Ask rows above Bid rows, prices are
   implied probabilities in percent.
8. Scroll down to section 02 Audit.

## 0:40 to 1:05, run the audit

Screen: section 02 Audit, with the "Audit this market" button at the top
right of the section.

1. Hover the "Audit this market" button for 1 second.
2. Click it once.
3. Wait 1 to 2 seconds. The split view fills in: "Market implies" on the
   left, the edge badge in the middle, "Calibre estimates" on the right.
4. Dwell left to right across the split view once, slowly.
5. Dwell over the decision banner under the split view: it shows exactly
   one of "Guarded trade available", "No trade", or "Insufficient data".
6. Dwell down the Guards list, one row per second: Data freshness,
   Market lifecycle, Time to expiry, Edge threshold, Model confidence,
   Liquidity, Order book. Each row shows pass, warn, or fail.
7. Dwell over the Evidence table at the bottom, showing per-value sources
   and timestamps.
8. Scroll down to section 03 Execute.

## 1:05 to 1:30, execute or refuse

Screen: section 03 Execute.

If the banner said No trade or Insufficient data (most common):

1. Dwell over the disabled "Approve guarded order" button. It is greyed
   out. Hover it to show it cannot be clicked.
2. Dwell over the reason list right below it, for example "The audit
   decision must be trade before an order can be prepared" or "A critical
   guard is failing, execution is blocked".
3. Do not connect a wallet. Leave the button disabled.
4. Scroll down to section 04 Resolve.

If the banner said Guarded trade available:

1. Click "Connect wallet" in the Wallet panel on the left of Execute.
2. The wallet extension opens on its own. Click the account to approve
   the connection.
3. Back in the app, dwell over the Connected pill, your address, and
   "Somnia testnet selected".
4. In the Approve panel, keep the amount at 0.01 in the "Amount in
   outcome tokens" field.
5. Click "Approve guarded order".

## 1:30 to 1:55, confirm and send (only on the Guarded trade path)

Screen: the confirmation modal, then the wallet, then the transaction
panels.

1. Dwell over the modal rows: Market id, Direction (Up or Down), Amount,
   audit id.
2. Click "Continue to wallet".
3. The wallet may prompt twice: first the tUSDC allowance approval for
   the DreamDEX BinaryPool, then the placeBinaryOrder call itself. Click
   approve on both.
4. Back in the app: the Pending panel appears with the real transaction
   hash. Wait on it.
5. The Confirmed panel appears with the same hash and an explorer link.
   Dwell over the hash.
6. Click the explorer link once to show the transaction on
   shannon-explorer.somnia.network, then return to the app.

If the wallet is rejected or has no tUSDC: the Failed panel appears with
a "Dismiss and retry" button. Showing one rejection is fine and honest:
click "Dismiss and retry" or leave it showing, then continue to Resolve.

## 1:30 to 1:55, refuse and move on (No trade path)

Screen: still section 03 Execute, after step 3 above.

1. Wait 3 seconds on the disabled button and the reason list. The viewer
   reads them on their own.
2. Scroll down to section 04 Resolve.

## 1:55 to 2:15, settlement

Screen: section 04 Resolve.

1. Click "Resolve" in the top navigation pill.
2. Dwell over the settlement timeline: the dots move from Listed through
   Trading to Locked to Resolved based on protocol status.
3. If the market just expired during the demo (markets roll every 5
   minutes): dwell over the warning pill "Pending settlement" and the
   line "Current status locked".
4. If the market reached a terminal state: dwell over the Resolved pill,
   the Outcome Up or Down pill, closing price, resolved time, and source
   badge.
5. If nothing settled yet: dwell over the "No settlement yet" card.
6. Scroll down to section 05 Learn.

## 2:15 to 2:30, calibration loop and close

Screen: sections 05 Learn and 07 Close.

1. Click "Learn" in the top navigation pill.
2. Dwell over the "7 days" range toggle and the "Audits recorded in
   range" count. Every audit run in this recording is already counted.
3. If the grid shows the honest empty state, dwell over its text: "No
   audits were recorded in the selected range. Run audits in the Audit
   section and let markets settle, then this grid fills with real
   calibration data."
4. Scroll or click "Close" in the top navigation and end on the closing
   panel.
5. Wait 2 seconds, then stop the recording.

## Contingencies

- All trading markets vanish between rolls: the list tiers down to any
  market, and countdowns show Closed for expired ones. Wait 1 to 2 minutes
  and click "Refresh" (top right of Observe).
- The badge shows "deterministic fallback": the API was unreachable.
  Click "Audit this market" anyway if you are in the Audit section, or
  wait or retry, the badge flips back to "DreamDEX indexer live" on its
  own. The audit still runs locally against the live indexer.
- "Audit failed / Failed to execute 'fetch' on 'Window': Illegal
  invocation": should be fixed. If it ever appears again, refresh the
  page and retry the audit.
- Wrong chain pill: click "Switch to Somnia testnet" and approve in the
  wallet.
- A guard flips between takes: that is the product working. Record it
  again from the Audit section, or keep the take. Never hide a failing
  guard.
- Render API restart: the Learn counts can reset because the free tier
  has an ephemeral disk. The empty state is honest, do not pad it.

## Recording checklist

- Clean browser profile, wallet on Somnia testnet (chain 50312) with STT
  and tUSDC.
- Warm the API with the /api/health check before pressing record.
- Keep the selected market id visible during audit, execute, and resolve.
- Show the source badge and its age before dwelling on any number.
- Show the failing-guard path first; the trade path is the bonus, not the
  proof.
- No narration, no captions, no background music, no on-screen text
  overlays, at any point.
- Never show seed phrases or private keys.
- Do not show any performance number the Learn grid did not compute from
  real audits.
