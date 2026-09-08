/**
 * Deterministic seeded RNG (mulberry32). Used by the fallback market feed and by
 * reproducible audit inputs. Not for secret material.
 */

export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  range(min: number, max: number): number;
}

export function hashSeed(input: string): number {
  // FNV-1a 32 bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    pick: <T,>(items: readonly T[]) => {
      if (items.length === 0) throw new Error("rng.pick: empty list");
      return items[Math.floor(next() * items.length)] as T;
    },
    range: (min: number, max: number) => min + next() * (max - min),
  };
}

export function rngFromString(input: string): Rng {
  return mulberry32(hashSeed(input));
}
