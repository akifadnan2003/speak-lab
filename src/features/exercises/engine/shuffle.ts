/**
 * Deterministic shuffling. Exercises present options, tokens and matching
 * targets in a shuffled order so the position never gives the answer away,
 * but the order must be stable across re-renders and reproducible in tests,
 * so it is derived from a string seed (the exercise id) rather than Math.random.
 */

function hashSeed(seed: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 PRNG. */
function createRandom(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates with a seeded PRNG; never returns the identity order for n ≥ 2 unless all items are equal. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items]
  if (result.length < 2) return result
  const random = createRandom(hashSeed(seed))
  const shuffleOnce = () => {
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const tmp = result[i]!
      result[i] = result[j]!
      result[j] = tmp
    }
  }
  shuffleOnce()
  const identical = result.every((item, i) => Object.is(item, items[i]))
  const allEqual = items.every((item) => Object.is(item, items[0]))
  if (identical && !allEqual) shuffleOnce()
  if (result.every((item, i) => Object.is(item, items[i])) && !allEqual) {
    // Extremely unlikely twice in a row; rotate as a last resort.
    result.push(result.shift()!)
  }
  return result
}

/** Indices 0..n-1 in seeded shuffled order. */
export function shuffledIndices(length: number, seed: string): number[] {
  return seededShuffle(
    Array.from({ length }, (_, i) => i),
    seed,
  )
}
