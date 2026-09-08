/**
 * SVG state contour layer.
 *
 * An abstract contour built for the market state machine, not a logo or icon.
 * The path stroke reveals progressively as section scroll progress crosses
 * 0.25, 0.5, and 0.75. The full reveal persists once drawn. Under reduced
 * motion the CSS layer forces the stroke visible without transition.
 */

import { useEffect, useRef, useState } from "react";

/** Abstract contour segments, four deterministic states. */
const SEGMENTS = [
  "M 60 620 C 140 560, 220 470, 300 430 S 430 370, 520 330 S 660 210, 780 180",
  "M 780 180 C 840 160, 900 170, 940 210 S 1010 330, 1060 400 S 1120 520, 1140 600",
  "M 300 430 C 380 400, 460 380, 560 370 S 760 360, 880 400 S 1060 480, 1140 520",
  "M 520 330 C 600 300, 700 280, 800 290 S 980 330, 1060 400",
];

export function StateContour({ sectionId }: { sectionId: string }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const section = document.getElementById(sectionId);
    if (!section) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Progress 0 when the section top reaches the viewport bottom, 1 when
        // the section bottom passes the viewport top.
        const total = rect.height + viewportHeight;
        const travelled = viewportHeight - rect.top;
        const value = Math.min(1, Math.max(0, travelled / total));
        setProgress(value);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [sectionId]);

  const stage = progress >= 0.75 ? 3 : progress >= 0.5 ? 2 : progress >= 0.25 ? 1 : 0;

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible"
    >
      {SEGMENTS.map((d, index) => (
        <path
          key={index}
          d={d}
          className="contour-path"
          data-progress={index < stage ? String(Math.min(3, index + 1)) : undefined}
          style={{
            fill: "none",
            stroke: "var(--color-accent)",
            strokeWidth: 1.5,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        />
      ))}
    </svg>
  );
}
