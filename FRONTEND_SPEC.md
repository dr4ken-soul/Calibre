# Calibre Frontend Specification

Status: approved design specification
Project: Calibre
Platform: DreamDEX Event Contracts on Somnia testnet
Document purpose: implementation-ready frontend direction

## 1. Product definition

Calibre is an AI probability auditor and execution guard for DreamDEX Event Contracts. It compares market-implied probability with an independently calculated estimate, checks liquidity and contract state, and presents a guarded action only when the edge survives the configured rules.

The product must feel like a serious decision instrument. It should make market mechanics, model reasoning, execution risk, and settlement state visible without becoming a generic trading dashboard.

Primary user: a crypto trader or automated strategy operator who wants a second opinion before entering a short-window BTC or ETH Up or Down Event Contract.

Primary action: inspect a live market, review the audit, and approve or reject a guarded trade.

## 2. Approved design decisions

### 2.1 Project Identity Fingerprint

| Axis | Decision |
| --- | --- |
| Hero | Asymmetric editorial |
| Typography | Swiss rational with a human secondary voice |
| Colour | Mineral neutral with warm semantic accents |
| Background | Technical grid and telemetry canvas |
| Rhythm | Editorial stagger |
| Motion | Scroll-driven narrative with precision timing |

### 2.2 Design dials

| Dial | Value | Intent |
| --- | ---: | --- |
| DESIGN_VARIANCE | 6/10 | A distinct editorial composition with familiar trading controls |
| MOTION_INTENSITY | 4/10 | Noticeable state changes without distracting from evidence |
| VISUAL_DENSITY | 6/10 | Dense enough for an operator, spaced enough for a first-time user |

### 2.3 Locked gates

- Gate 1: Bento grid operational, supported by warm organic surfaces.
- Gate 2: Sticky section indicator.
- Gate 3A: Coded animated canvas with supporting SVG animation and morphing.
- Gate 3B: Unified sticky canvas.
- Gate 4: Manrope with DM Mono.
- Gate 5: Approved warm operational palette.
- Gate 6: Asymmetric framed portal hero.
- Gate 7: Observe, Audit, Execute, Resolve, Learn, Protocol, Closing action.

## 3. Visual principles

1. Every visual element must explain market state, model state, execution state, or settlement state.
2. Warm organic styling is expressed through mineral surfaces, softened corners, sage telemetry, and tactile spacing. It must not become beige decoration.
3. The interface uses one primary interaction accent, burnt amber. Sage, red, and ochre are semantic states only.
4. There is no purple or blue AI glow, no floating orb, and no decorative trading chart without a data relationship.
5. The canvas is an instrument layer. It is not a background video and it must not reduce readability.
6. Calibre has no logo requirement in Version 1. Render the product name as text. Do not invent or hardcode a logo, mascot, or brand symbol.

## 4. Typography

~~~css
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
~~~

~~~css
:root {
  --font-sans: 'Manrope', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'DM Mono', ui-monospace, SFMono-Regular, monospace;
}
~~~

| Role | Font | Weight | Size | Line height | Tracking |
| --- | --- | ---: | ---: | ---: | ---: |
| Hero statement | Manrope | 800 | clamp(2.75rem, 6.5vw, 7rem) | 0.92 | -0.065em |
| Section title | Manrope | 700 | clamp(1.75rem, 3.2vw, 3.5rem) | 1.0 | -0.045em |
| Panel title | Manrope | 700 | 1.125rem | 1.2 | -0.02em |
| Body | Manrope | 400 | 0.9375rem | 1.55 | 0 |
| Navigation | Manrope | 600 | 0.75rem | 1 | 0.08em |
| Telemetry | DM Mono | 500 | 0.75rem | 1.3 | 0.02em |
| Large value | DM Mono | 500 | clamp(1.5rem, 3vw, 3rem) | 1 | -0.04em |

Do not use Inter as a display font. Do not use more than two type families.

## 5. Colour tokens

Use these variables in JSX through Tailwind arbitrary-value classes. Do not hardcode a colour directly in a component.

~~~css
:root {
  --color-ink: #20251F;
  --color-ink-muted: #5E655B;
  --color-paper: #F4F0E7;
  --color-surface: #FBF9F4;
  --color-surface-raised: #E9E5DA;
  --color-line: #D3CEC1;
  --color-accent: #C9793D;
  --color-accent-soft: #F0D4BE;
  --color-telemetry: #809B78;
  --color-telemetry-soft: #DCE6D8;
  --color-success: #4F8061;
  --color-success-soft: #DDEADF;
  --color-danger: #B45F55;
  --color-danger-soft: #F0DCD8;
  --color-warning: #B77A32;
  --color-warning-soft: #F1E2C7;
  --color-focus: #A8562A;
  --color-canvas: #E3E8DF;
}
~~~

Core classes:

~~~text
Page:        bg-[var(--color-paper)] text-[var(--color-ink)]
Surface:     bg-[var(--color-surface)] border border-[var(--color-line)]
Raised:      bg-[var(--color-surface-raised)]
Accent:      bg-[var(--color-accent)] text-[var(--color-surface)]
Telemetry:   bg-[var(--color-telemetry-soft)] text-[var(--color-telemetry)]
Success:     bg-[var(--color-success-soft)] text-[var(--color-success)]
Danger:      bg-[var(--color-danger-soft)] text-[var(--color-danger)]
Focus ring:  ring-2 ring-[var(--color-focus)] ring-offset-2 ring-offset-[var(--color-paper)]
~~~

## 6. Global layout contract

Page shell:

~~~text
min-h-screen overflow-x-clip bg-[var(--color-paper)] text-[var(--color-ink)] antialiased
~~~

Main container:

~~~text
mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16
~~~

Section spacing:

~~~text
py-20 sm:py-28 lg:py-36
~~~

Panel baseline:

~~~text
rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_18px_60px_rgba(32,37,31,0.06)]
~~~

Use rounded-[1.5rem] for primary panels and rounded-xl for controls. Do not use excessive pills. Pills are reserved for status labels and filter chips.

## 7. Z-index contract

~~~text
z-0       page background and grid
z-10      section content
z-20      canvas telemetry layer
z-30      SVG state layer
z-40      sticky section indicator
z-50      dropdowns, popovers, wallet status tray
z-[60]    modal confirmation and transaction state
z-[70]    emergency error banner
~~~

The canvas and SVG layer must remain behind readable controls. A modal must never be obscured by the sticky indicator.

## 8. Navigation and sticky indicator

The sticky section indicator contains seven text labels:

~~~text
Observe / Audit / Execute / Resolve / Learn / Protocol / Close
~~~

Desktop shell:

~~~text
fixed left-1/2 top-5 z-40 flex w-fit -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--color-line)] bg-[color:var(--color-surface)/0.88] p-1.5 shadow-[0_12px_30px_rgba(32,37,31,0.08)] backdrop-blur-md
~~~

Indicator button:

~~~text
relative rounded-full px-3 py-2 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)] transition-colors duration-200 ease-out hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]
~~~

Active indicator:

~~~text
bg-[var(--color-ink)] text-[var(--color-surface)]
~~~

Mobile shell:

~~~text
fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[color:var(--color-surface)/0.94] p-2 shadow-[0_12px_30px_rgba(32,37,31,0.1)] backdrop-blur-md
~~~

On mobile, display the current section label, a progress fraction, and previous or next controls. Do not force all seven labels into a narrow row.

## 9. Hero: asymmetric framed portal

Section wrapper:

~~~text
relative isolate min-h-[min(920px,100svh)] overflow-hidden border-b border-[var(--color-line)]
~~~

Grid:

~~~text
mx-auto grid min-h-[min(920px,100svh)] w-full max-w-[1440px] grid-cols-1 gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:px-12 lg:pb-24 lg:pt-36 xl:px-16
~~~

Left column:

~~~text
relative z-10 flex max-w-[34rem] flex-col justify-center
~~~

Eyebrow:

~~~text
mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]
~~~

Hero title:

~~~text
max-w-[10ch] font-sans text-[clamp(2.75rem,6.5vw,7rem)] font-extrabold leading-[0.92] tracking-[-0.065em] text-[var(--color-ink)]
~~~

Hero body:

~~~text
mt-7 max-w-[31rem] text-[0.9375rem] leading-[1.55] text-[var(--color-ink-muted)] sm:text-base
~~~

Action row:

~~~text
mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center
~~~

Primary action:

~~~text
inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--color-surface)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)]
~~~

Secondary action:

~~~text
inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3 font-sans text-sm font-semibold text-[var(--color-ink)] transition-colors duration-200 ease-out hover:bg-[var(--color-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]
~~~

Right portal frame:

~~~text
relative z-10 min-h-[34rem] overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-canvas)] p-3 shadow-[0_28px_90px_rgba(32,37,31,0.12)] sm:min-h-[42rem] lg:min-h-[36rem] xl:min-h-[42rem]
~~~

Inside the frame, the layer order is:

~~~text
canvas z-20 absolute inset-0 h-full w-full
SVG z-30 absolute inset-0 h-full w-full pointer-events-none
data panel z-10 relative
~~~

The frame must contain a functional live market state, not a static mockup. The initial state may use a clearly labeled testnet market when live data is unavailable.

## 10. Observe section

Section wrapper:

~~~text
relative isolate mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36 xl:px-16
~~~

Header row:

~~~text
mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between
~~~

Bento grid:

~~~text
grid grid-cols-1 gap-4 md:grid-cols-12 md:auto-rows-[minmax(9rem,auto)]
~~~

Recommended placements:

~~~text
market selector: md:col-span-4
expiry clock:     md:col-span-4
market pressure:  md:col-span-4
telemetry canvas:  md:col-span-8 md:row-span-2
order book:       md:col-span-4 md:row-span-2
~~~

Each card uses:

~~~text
rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6
~~~

Do not present three identical feature cards. Cards must have unequal scale and a clear operational relationship.

## 11. Audit section

Use a split comparison layout:

~~~text
grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch
~~~

Market probability panel:

~~~text
rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8
~~~

Calibre probability panel:

~~~text
rounded-[1.5rem] border border-[var(--color-telemetry)] bg-[var(--color-telemetry-soft)] p-6 sm:p-8
~~~

Difference marker:

~~~text
flex items-center justify-center rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-3 font-mono text-sm font-medium text-[var(--color-focus)]
~~~

Evidence rows:

~~~text
grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t border-[var(--color-line)] py-3 font-mono text-xs
~~~

The section must expose the reason behind the estimate. At minimum, show market price, independent estimate, liquidity quality, time to expiry, and confidence.

## 12. Execute section

Use a control surface with a prominent guarded action:

~~~text
grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]
~~~

Guard list:

~~~text
divide-y divide-[var(--color-line)] rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)]
~~~

Guard row:

~~~text
grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 sm:px-6
~~~

Approve control:

~~~text
inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-3 font-sans text-sm font-bold text-[var(--color-surface)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50
~~~

The approve button must remain disabled until wallet connection, market status, expiry guard, liquidity guard, and model confidence requirements are satisfied.

## 13. Resolve section

Use a chronological settlement timeline:

~~~text
relative grid grid-cols-1 gap-0 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-8 lg:grid-cols-5
~~~

Timeline step:

~~~text
relative border-l border-[var(--color-line)] pb-8 pl-6 last:border-l-0 last:pb-0 lg:border-l-0 lg:border-t lg:pb-0 lg:pl-0 lg:pt-6
~~~

Show the actual lifecycle: listed, trading, locked, resolved, redeemed, or voided. The UI must never infer settlement from question text. Use the on-chain status and market identifier.

## 14. Learn section

Use a metrics grid with a calibration-first focus:

~~~text
grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4
~~~

Metrics:

- prediction count
- average confidence error
- avoided trades
- settled outcomes

Every metric needs a date range and a source label. Do not show fabricated performance. When no history exists, show an empty state with the exact reason.

## 15. Protocol section

Use an architecture strip rather than a marketing feature grid:

~~~text
grid grid-cols-1 gap-3 md:grid-cols-5
~~~

Nodes:

~~~text
rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5
~~~

The nodes are Wallet, Market Data, Calibre Audit, DreamDEX Event Contract, and Settlement. Connectors may use CSS borders or inline SVG lines. Do not use a brand logo or hardcoded protocol symbol. Text labels are sufficient.

## 16. Closing section

~~~text
relative mx-auto max-w-[1440px] overflow-hidden border-t border-[var(--color-line)] px-5 py-24 sm:px-8 lg:px-12 lg:py-36 xl:px-16
~~~

Statement:

~~~text
max-w-[12ch] font-sans text-[clamp(2.25rem,5vw,5.5rem)] font-extrabold leading-[0.94] tracking-[-0.06em]
~~~

Keep the closing action quiet. The page should finish with a clear next action, not a second hero.

## 17. Animation specification

### 17.1 Canvas telemetry

Implementation: a single requestAnimationFrame loop in a dedicated canvas component.

Canvas classes:

~~~text
pointer-events-none absolute inset-0 z-20 h-full w-full opacity-80
~~~

Render rules:

- Use device pixel ratio capped at 2.
- Resize through ResizeObserver.
- Use the market feed when connected.
- Use a deterministic labeled testnet fallback when disconnected.
- Animate a small number of directional traces and liquidity bands.
- Use telemetry, accent, and semantic state tokens only.
- Pause the loop when the canvas is outside the viewport.
- Use prefers-reduced-motion to render a still frame with no continuous loop.

Target loop values:

~~~text
frame budget: 16.67ms at 60fps
trace count:  8 to 14
line alpha:   0.14 to 0.58
drift:        0.12 to 0.42 px per frame
~~~

### 17.2 SVG state morph

SVG classes:

~~~text
pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible
~~~

Path style:

~~~css
fill: none;
stroke: var(--color-accent);
stroke-width: 1.5;
stroke-linecap: round;
stroke-linejoin: round;
stroke-dasharray: 1000;
stroke-dashoffset: 0;
~~~

Morph values:

~~~text
duration: 520ms
ease: cubic-bezier(0.65, 0, 0.35, 1)
trigger: section progress crossing 0.25, 0.5, 0.75
~~~

Do not use an icon or logo as the shape source. Use an abstract contour built specifically for the state machine.

### 17.3 Section reveal

Initial state:

~~~text
opacity: 0
transform: translateY(16px)
~~~

Animated state:

~~~text
opacity: 1
transform: translateY(0)
duration: 560ms
ease: cubic-bezier(0.22, 1, 0.36, 1)
delay: 0ms, 80ms, 160ms, 240ms by item index
~~~

Use a single entry reveal per element. The reveal must be repeatable when a section leaves and re-enters the viewport, but it must not replay continuously while the element remains visible.

### 17.4 Sticky canvas transition

Use an intersection observer or GSAP ScrollTrigger. The canvas frame remains in the same visual position while section context changes.

~~~text
canvas transition duration: 420ms
canvas transition ease: cubic-bezier(0.22, 1, 0.36, 1)
indicator transition duration: 220ms
indicator transition ease: ease-out
~~~

If GSAP is selected, the pinned region must use pinSpacing: true, scrub: 0.6, and a cleanup function on unmount. Do not pin the entire document.

### 17.5 Reduced motion

~~~css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
~~~

For reduced motion, show static telemetry, preserve state labels, and keep all controls available.

## 18. Interaction states

Every data component must define these states:

- loading: skeleton using animate-pulse only on neutral surfaces
- live: source and last-updated timestamp visible
- stale: amber warning with exact age
- unavailable: explicit explanation and retry action
- empty: explanation of why no history or market exists
- error: human-readable error, technical details behind disclosure
- wallet disconnected: read-only view with connect action
- transaction pending: visible transaction state, disabled duplicate submission
- transaction confirmed: on-chain confirmation and next available action
- transaction failed: reason, retry action, and no false success state

## 19. Responsive behaviour

Breakpoints:

- below 640px: one-column flow, compact sticky indicator, no side-by-side comparison.
- 640px to 1023px: one-column hero with the portal below the statement, two-column metric cards where possible.
- 1024px and above: asymmetric hero and 12-column bento layout.
- 1280px and above: allow full portal frame and five-node protocol strip.

Mobile requirements:

- all actions have at least min-h-12
- tap targets are at least 44 by 44 pixels
- tables become stacked rows or horizontally scrollable regions with visible labels
- canvas remains decorative to the data layer and never blocks text selection or controls
- sticky indicator never covers focused content

## 20. Accessibility

- Use semantic landmarks: header, nav, main, section, footer.
- Every section has a unique heading.
- Every live value has a text equivalent.
- Do not encode Up, Down, valid, or invalid through colour alone.
- Use aria-live="polite" for non-critical market refreshes.
- Use aria-live="assertive" only for transaction failure or settlement completion.
- Use visible keyboard focus with the approved focus token.
- The canvas must have aria-hidden="true" and a nearby text summary.
- Modal confirmation traps focus and restores it to the invoking control.
- Never auto-submit a trade after a model recommendation.

## 21. Asset briefs

No raster asset is required for Version 1. The product is intentionally code-native.

| Asset | Type | Brief | Motion | Mood | Resolution | Tool | Hosting | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Telemetry layer | Canvas | Directional traces and liquidity bands derived from market state | Continuous only when visible; reduced-motion still frame | Precise, quiet, analytical | Canvas-sized, DPR capped at 2 | Code | Browser canvas | Static SVG contour and text summary |
| State contour | SVG | Abstract contour with four deterministic states | 520ms path morph on section progress | Tactile, controlled, warm | viewBox 0 0 1200 800 | Code | Inline SVG component | No contour, state badge remains |
| Technical grid | CSS or SVG | Low-contrast grid for depth and orientation | None | Instrument-like | Responsive | Code | CSS background or inline SVG | Solid paper background |

Do not generate or embed a logo. If a sponsor mark is later required for submission materials, request approval before adding it.

## 22. Component acceptance checklist

- The hero opens with a readable thesis within 2 seconds.
- The portal displays a real or clearly labeled testnet market.
- Market probability and Calibre probability are visually distinct.
- The execution action is guarded by explicit checks.
- The sticky indicator tracks the active section and does not cover content.
- Canvas and SVG motion remain below the motion intensity target.
- No component contains a direct hex colour literal in JSX.
- No component contains a hardcoded logo, brand symbol, or unexplained icon.
- Loading, stale, unavailable, empty, error, pending, success, and reduced-motion states are implemented.
- Keyboard navigation reaches every action in logical order.
- Wallet and transaction states come from actual application state.

## 23. Implementation handoff

Build the frontend only after the backend contract and market-data adapters are agreed. Start with the static layout and real data states, then add the canvas, SVG morph, and scroll orchestration. Keep the canvas and SVG components independently removable so the core trading flow remains usable if animation is disabled.

