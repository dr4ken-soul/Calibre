# Calibre Project Instructions

## Project identity

- Product name: Calibre
- Product role: AI probability auditor and execution guard for DreamDEX Event Contracts
- Network: Somnia testnet during hackathon development
- Primary user: crypto trader or strategy operator
- Primary action: inspect, audit, guard, approve, resolve, and learn

## Required reading order

Before changing implementation files, read:

1. FRONTEND_SPEC.md
2. APP_BLUEPRINT.md
3. BUILD_GUIDE.md
4. DEMO_SCRIPT.md

Use the reference materials in the parent Agents and Skill files directories as guidance. Do not copy their examples, product names, sample copy, or project-specific content.

## Scope control

- Do not implement features outside APP_BLUEPRINT.md without documenting the reason.
- Do not add autonomous trading.
- Do not add private-key custody.
- Do not add leverage, borrowing, or cross-chain execution.
- Do not add social feeds to Version 1.
- Do not add a logo or custom symbol without asking for approval.
- Do not create fake market data or fake settlement data.
- Do not claim profitability.

## Protocol safety

- Use market ID as the durable identity.
- Read lifecycle from the protocol.
- Recheck critical status before preparing a transaction.
- Use bigint-safe or fixed-point arithmetic.
- Treat indexer data as eventually consistent.
- Display source timestamps and stale state.
- Verify receipts before showing success.
- Do not show resolved or redeemed before on-chain confirmation.
- Prevent duplicate transaction submission.
- Never log private keys, wallet seeds, provider secrets, or unredacted sensitive payloads.

## AI safety

- Validate all model responses with a schema.
- Store model version and audit timestamp.
- Store the evidence used for each decision.
- Allow no-trade and insufficient-data outputs.
- Never let an unvalidated model response enable a transaction.
- Describe confidence as model confidence, not guaranteed profit probability.
- Keep the deterministic guard layer independent from the model layer.

## Frontend rules

- Follow FRONTEND_SPEC.md exactly.
- Use Manrope for interface and display text.
- Use DM Mono for telemetry and machine-readable values.
- Consume CSS colour tokens through Tailwind arbitrary-value classes.
- Do not use direct hex values in JSX.
- Use the approved z-index values.
- Keep canvas and SVG behind readable controls.
- Implement loading, stale, unavailable, empty, error, pending, confirmed, rejected, and failed states.
- Support keyboard navigation and reduced motion.
- Keep buttons at least 44 by 44 pixels on touch layouts.
- Do not use decorative motion when it has no relationship to application state.

## Writing and copy rules

- Use clear professional English.
- Prefer short sentences.
- Use sentence case for interface copy.
- Avoid hype, guarantees, and unexplained jargon.
- Do not use em dashes e.g: only—no application code or brand assets—a. Use commas, colons, parentheses, or separate sentences instead.
- Do not write copy that implies the product can predict the future with certainty.
- Use exact status labels such as Trading, Locked, Resolved, Voided, Pending, Confirmed, Failed, or Unavailable.

## Naming rules

- Use Calibre consistently.
- Use single-word feature names where possible.
- Avoid unnecessary compound names.
- Use DreamDEX and Somnia exactly as styled by their official documentation.
- Do not create an alternate brand name in code or copy.

## Change workflow

Before a change:

1. Identify the affected product flow.
2. Check the data source and trust boundary.
3. Check the relevant acceptance criteria.
4. Note any schema or API effect.

After a change:

1. Run type checking.
2. Run relevant unit and integration tests.
3. Check the browser states manually.
4. Check keyboard and reduced-motion behaviour.
5. Confirm no secrets or brand assets were added.
6. Update documentation if the public behaviour changed.

## Definition of done

A feature is complete only when its normal, loading, stale, unavailable, empty, error, pending, confirmed, and rejected states are considered. A transaction feature is incomplete until the receipt and failure paths are tested.

