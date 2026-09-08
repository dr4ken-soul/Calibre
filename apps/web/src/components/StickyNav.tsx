/**
 * Sticky section indicator. Desktop: fixed top pill with the seven labels
 * (Observe, Audit, Execute, Resolve, Learn, Protocol, Close). Mobile: fixed
 * bottom bar with prev/next and a progress track. All touch targets are at
 * least 44px. The Observe label covers both the hero and observe sections.
 */

import { useEffect, useState } from "react";

/** All scroll sections, in document order. */
export const SECTIONS = [
  { id: "hero", label: "Observe" },
  { id: "observe", label: "Observe" },
  { id: "audit", label: "Audit" },
  { id: "execute", label: "Execute" },
  { id: "resolve", label: "Resolve" },
  { id: "learn", label: "Learn" },
  { id: "protocol", label: "Protocol" },
  { id: "close", label: "Close" },
] as const;

/** The seven visible navigation entries. */
export const NAV_ITEMS = [
  { id: "hero", label: "Observe", alsoActive: "observe" },
  { id: "audit", label: "Audit" },
  { id: "execute", label: "Execute" },
  { id: "resolve", label: "Resolve" },
  { id: "learn", label: "Learn" },
  { id: "protocol", label: "Protocol" },
  { id: "close", label: "Close" },
] as const;

export function useActiveSection(): { active: string; index: number } {
  const [active, setActive] = useState("hero");
  const index = SECTIONS.findIndex((s) => s.id === active);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return { active, index: index < 0 ? 0 : index };
}

export function StickyNav() {
  const { active, index } = useActiveSection();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const navIndex = NAV_ITEMS.findIndex(
    (item) => item.id === active || ("alsoActive" in item && item.alsoActive === active),
  );
  const activeNavIndex = navIndex < 0 ? 0 : navIndex;

  const prev = NAV_ITEMS[Math.max(0, activeNavIndex - 1)]!;
  const next = NAV_ITEMS[Math.min(NAV_ITEMS.length - 1, activeNavIndex + 1)]!;
  const progress = ((activeNavIndex + 1) / NAV_ITEMS.length) * 100;
  const currentLabel =
    active === "observe" ? "Observe" : SECTIONS[index]?.label ?? "Observe";

  return (
    <>
      {/* Desktop pill */}
      <nav
        aria-label="Section navigation"
        className={`fixed top-5 left-1/2 z-40 hidden -translate-x-1/2 lg:block ${
          mounted ? "opacity-100" : "opacity-0"
        } transition-opacity duration-500`}
      >
        <ol className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-1.5 shadow-[0_10px_30px_rgba(32,37,31,0.08)] backdrop-blur">
          {NAV_ITEMS.map((item) => {
            const isActive =
              active === item.id || ("alsoActive" in item && item.alsoActive === active);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Section navigation"
        className="fixed bottom-4 left-4 right-4 z-40 lg:hidden"
      >
        <div className="rounded-[1.25rem] border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-2 shadow-[0_10px_30px_rgba(32,37,31,0.12)] backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go(prev.id)}
              aria-label={`Previous section: ${prev.label}`}
              className="min-h-12 min-w-12 rounded-[1rem] border border-[var(--color-line)] px-3 text-sm font-semibold text-[var(--color-ink)]"
            >
              Prev
            </button>
            <div className="flex-1 text-center">
              <p className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
                {currentLabel} {activeNavIndex + 1}/{NAV_ITEMS.length}
              </p>
              <div
                className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-raised)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-label="Section progress"
              >
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => go(next.id)}
              aria-label={`Next section: ${next.label}`}
              className="min-h-12 min-w-12 rounded-[1rem] bg-[var(--color-accent)] px-3 text-sm font-semibold text-[var(--color-paper)]"
            >
              Next
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
