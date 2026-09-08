/**
 * App root: page shell and data wiring.
 *
 * Top level owns market polling and the audit state. Sections receive only
 * what they need. The z-index contract is: page 0, content 10, canvas 20,
 * SVG contour 30, sticky nav 40, dropdowns 50, modal 60, emergency banner 70.
 */

import { useState } from "react";
import { StickyNav } from "./components/StickyNav.js";
import { Hero } from "./components/sections/Hero.js";
import { Observe } from "./components/sections/Observe.js";
import { Audit } from "./components/sections/Audit.js";
import { Execute } from "./components/sections/Execute.js";
import { Resolve } from "./components/sections/Resolve.js";
import { Learn } from "./components/sections/Learn.js";
import { Protocol } from "./components/sections/Protocol.js";
import { Close } from "./components/sections/Close.js";
import { useAudit, useMarkets } from "./hooks/useData.js";

export function App() {
  const markets = useMarkets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const audit = useAudit();

  const marketList = markets.data ?? [];
  const selected =
    marketList.find((m) => m.marketId === selectedId) ?? marketList[0] ?? null;

  const runAudit = () => {
    if (selected) void audit.audit(selected.marketId);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--color-paper)] text-[var(--color-ink)] antialiased">
      <StickyNav />
      <main>
        <Hero market={selected} />
        <Observe
          markets={marketList}
          status={markets.status}
          stale={markets.stale}
          source={markets.source}
          observedAt={markets.observedAt}
          selectedId={selected?.marketId ?? null}
          onSelect={setSelectedId}
          onRefresh={markets.refresh}
          retry={markets.refresh}
        />
        <Audit market={selected} auditState={audit.state} onRun={runAudit} />
        <Execute audit={audit.state.status === "ready" ? audit.state.audit : null} />
        <Resolve
          market={selected}
          observedAt={markets.observedAt}
          stale={markets.stale}
        />
        <Learn />
        <Protocol />
        <Close />
      </main>
    </div>
  );
}
