// ── Pure utility functions ───────────────────────────────────────────────
// Zero DOM dependency, zero state mutation.
// Extracted from game.js for reuse across Web and Mini Program targets.

/** Fisher-Yates sample: pick n random items from arr (no repeats). */
export function sample(arr, n) {
  const a = arr.slice();
  const out = [];
  while (out.length < n && a.length) {
    const i = Math.floor(Math.random() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Gacha draw: pick n talents with rarity weighting + pity rule.
 * @param {Array} talents - full talent pool
 * @param {number} n - how many to draw
 * @returns {Array} chosen talents
 */
export function gachaDraw(talents, n) {
  const pools = [[], [], [], []];
  for (const t of talents) pools[t.grade]?.push(t);

  function rollGrade() {
    const r = Math.random() * 100;
    if (r < 7) return 3;   // orange
    if (r < 20) return 2;  // purple
    if (r < 50) return 1;  // blue
    return 0;               // white
  }

  function pickFrom(pool, seen) {
    const available = pool.filter(t => !seen.has(t.id));
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  const chosen = [];
  const seen = new Set();
  let gotRare = false;

  for (let i = 0; i < n; i++) {
    let grade = rollGrade();
    if (grade >= 2) gotRare = true;

    // Pity: if this is the last slot and no rare yet, force purple or orange
    if (i === n - 1 && !gotRare) {
      grade = Math.random() < 0.2 ? 3 : 2;
    }

    let t = pickFrom(pools[grade], seen);
    // Fallback: if pool exhausted, try adjacent grades
    if (!t) {
      for (const fallback of [grade - 1, grade + 1, 0, 1, 2, 3]) {
        if (fallback >= 0 && fallback <= 3) {
          t = pickFrom(pools[fallback], seen);
          if (t) break;
        }
      }
    }
    if (t) { seen.add(t.id); chosen.push(t); }
  }
  return chosen;
}
