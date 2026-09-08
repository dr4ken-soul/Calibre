/**
 * Canvas telemetry layer.
 *
 * Draws directional traces and liquidity bands derived from market state.
 * One requestAnimationFrame loop, paused offscreen via IntersectionObserver,
 * sized through ResizeObserver, device pixel ratio capped at 2. Under
 * prefers-reduced-motion it renders a single still frame. Stroke colors are
 * resolved from CSS tokens, never hardcoded literals.
 */

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./primitives.js";

interface TraceConfig {
  /** Vertical anchor as a 0..1 fraction of the canvas height. */
  anchor: number;
  /** Horizontal drift in px per frame, positive is rightward. */
  drift: number;
  /** Stroke alpha, 0.14 to 0.58. */
  alpha: number;
  /** Sine amplitude in px. */
  amplitude: number;
  /** Sine frequency multiplier. */
  frequency: number;
  /** Phase offset. */
  phase: number;
}

/** Parse "rgb(r, g, b)" or "rgba(r, g, b, a)" into components. */
function parseRgb(value: string): [number, number, number] | null {
  const match = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function seededTraces(seedKey: string, count: number): TraceConfig[] {
  // Deterministic 32-bit hash so the same market renders the same layer.
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const next = () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return ((hash >>> 0) % 10_000) / 10_000;
  };
  const traces: TraceConfig[] = [];
  for (let i = 0; i < count; i++) {
    traces.push({
      anchor: 0.18 + next() * 0.64,
      drift: 0.12 + next() * 0.3,
      alpha: 0.14 + next() * 0.44,
      amplitude: 8 + next() * 28,
      frequency: 0.4 + next() * 1.4,
      phase: next() * Math.PI * 2,
    });
  }
  return traces;
}

export function TelemetryCanvas({
  seedKey,
  traceCount = 11,
  className = "",
  /** Telemetry pressure in 0..1, from implied probability or momentum. */
  intensity = 0.5,
}: {
  seedKey: string;
  traceCount?: number;
  className?: string;
  intensity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const traces = seededTraces(seedKey, Math.max(8, Math.min(14, traceCount)));
    let width = 0;
    let height = 0;
    let frame = 0;
    let raf = 0;
    let visible = true;

    // Token colors resolved once from computed style: the canvas element
    // carries --color-telemetry through the text color and --color-accent
    // through the top border color.
    const styles = getComputedStyle(canvas);
    const telemetryRgb = parseRgb(styles.color) ?? [128, 155, 120];
    const accentRgb = parseRgb(styles.borderTopColor) ?? telemetryRgb;

    const drawFrame = () => {
      if (width === 0 || height === 0) return;
      context.clearRect(0, 0, width, height);

      // Liquidity band: a soft horizontal band whose height tracks intensity.
      const bandHeight = height * (0.08 + intensityRef.current * 0.2);
      const bandY = height * (0.32 + (1 - intensityRef.current) * 0.3);
      const band = context.createLinearGradient(0, bandY, 0, bandY + bandHeight);
      band.addColorStop(0, "rgba(0,0,0,0)");
      band.addColorStop(
        0.5,
        `rgba(${telemetryRgb[0]},${telemetryRgb[1]},${telemetryRgb[2]},${(0.08 + intensityRef.current * 0.1).toFixed(3)})`,
      );
      band.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = band;
      context.fillRect(0, bandY, width, bandHeight);

      context.lineWidth = 1;
      for (const trace of traces) {
        context.beginPath();
        const offset = (frame * trace.drift) % (width + 260);
        for (let x = -130; x <= width + 130; x += 14) {
          const tx = x - 130 + offset;
          const y =
            trace.anchor * height +
            Math.sin(tx * 0.012 * trace.frequency + trace.phase + frame * 0.01) * trace.amplitude;
          if (x === -130) context.moveTo(tx, y);
          else context.lineTo(tx, y);
        }
        const alpha = trace.alpha * (0.7 + intensityRef.current * 0.3);
        context.strokeStyle = `rgba(${telemetryRgb[0]},${telemetryRgb[1]},${telemetryRgb[2]},${alpha.toFixed(3)})`;
        context.stroke();
      }

      // One accent trace carries the accent token so state changes read warm.
      const accentTrace = traces[0]!;
      context.beginPath();
      const accentOffset = (frame * accentTrace.drift * 1.3) % (width + 260);
      for (let x = -130; x <= width + 130; x += 14) {
        const tx = x - 130 + accentOffset;
        const y =
          accentTrace.anchor * height +
          Math.sin(tx * 0.012 * accentTrace.frequency + accentTrace.phase + frame * 0.014) *
            (accentTrace.amplitude * 1.6);
        if (x === -130) context.moveTo(tx, y);
        else context.lineTo(tx, y);
      }
      context.strokeStyle = `rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},${(0.22 + intensityRef.current * 0.18).toFixed(3)})`;
      context.stroke();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.round(rect.width);
      height = Math.round(rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame();
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const wasVisible = visible;
        visible = entry.isIntersecting;
        if (visible && !wasVisible && !reducedMotion) {
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    function loop() {
      if (!visible || reducedMotion) {
        raf = 0;
        return;
      }
      frame += 1;
      drawFrame();
      raf = requestAnimationFrame(loop);
    }

    resize();
    if (reducedMotion) {
      drawFrame();
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [seedKey, traceCount, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-20 h-full w-full opacity-80 text-[var(--color-telemetry)] border-t-[var(--color-accent)] ${className}`}
    />
  );
}
