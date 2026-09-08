/**
 * Scroll reveal wrapper.
 *
 * Applies the reveal transition on first intersection, re-triggers when the
 * element leaves and re-enters the viewport, and never replays continuously
 * while visible. Stagger comes from an 80ms delay per index.
 */

import { useEffect, useRef, type ReactNode } from "react";

export function Reveal({
  children,
  index = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "p";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            element.dataset.revealed = "true";
          } else {
            element.dataset.revealed = "false";
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-revealed="false"
      className={`reveal ${className}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {children}
    </Tag>
  );
}
