// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Rules for the Phase 2 and 3 missions (pure functions, tested). Every number they use comes from
 * kids-data.json, which is exported from the main Lunar Nav API.
 */
import { DATA } from './data.js';

/* ---------- Grids (missions 5 and 7): 11 × 11 points, every 100 m, ±500 m ---------- */

export const GRID_N = 11;
const HALF = (GRID_N - 1) / 2;

/** The grid of a site as a lookup by cell (col 0 = west, row 0 = north). */
export function gridCells(siteId) {
  const g = DATA.grids[siteId];
  const cells = {};
  for (const [dx, dy, fraction, days] of g.points) {
    const col = Math.round(dx / g.spacing_m) + HALF;
    const row = HALF - Math.round(dy / g.spacing_m);
    cells[`${col},${row}`] = { col, row, dx, dy, fraction, days };
  }
  return cells;
}
export const cellAt = (cells, col, row) => cells[`${col},${row}`];
export const clampCell = (v) => Math.max(0, Math.min(GRID_N - 1, v));
export const CENTRE = HALF;

/**
 * Mission 5 — a landing aimed at (col, row) lands up to `miss` cells away (each cell is 100 m), as
 * real landings can miss by hundreds of metres. `rng` returns numbers in [0, 1).
 */
export function landingFrom(col, row, rng = Math.random, miss = 2) {
  const off = () => Math.floor(rng() * (2 * miss + 1)) - miss;
  return { col: clampCell(col + off()), row: clampCell(row + off()) };
}
/** Stars for a landing: at least 22 sunny days of 30 → 3, at least 15 → 2, any landing → 1. */
export const targetStars = (days) => (days >= 22 ? 3 : days >= 15 ? 2 : 1);

/**
 * Mission 7 — a spot near the dark area: 3 stars for a sunny spot right next to a spot that had no
 * Sun in July 2030 (good for the hunt, safe to land); 2 for a sunny spot farther away; 1 for a dark
 * spot (too dark and cold to land).
 */
export function iceResult(cells, col, row) {
  const c = cellAt(cells, col, row);
  if (!c) return null;
  if (c.days === 0) return { kind: 'dark', stars: 1 };
  let nearDark = false;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const n = cellAt(cells, col + dc, row + dr);
    if (n && n.days === 0 && (dr || dc)) nearDark = true;
  }
  return nearDark ? { kind: 'edge', stars: 3 } : { kind: 'far', stars: 2 };
}

/* ---------- Mission 9 — your plan ---------- */

/** Battery choices (kWh). */
export const BATTERIES = { small: 10, medium: 20, large: 40 };
/** "Enough Sun": the Sun is up at least half of the 30 days. */
export const SUN_ENOUGH = 0.5;
/** "Can call home": the longest wait without contact is at most 7 days. */
export const MAX_WAIT_H = 7 * 24;

/**
 * Stars for a plan (site, date index 0 = 1 July / 1 = 11 July, battery key), with the reason for each:
 *  - sun: the Sun shines at least half the time;
 *  - call: never more than 7 days without a call home (a wait that may be longer does not count);
 *  - battery: the battery is at least the API's need (60 W × longest night ÷ 0.8); a night that may be
 *    longer than the 30 days can show (a lower bound) does not count either.
 */
export function planStars(siteId, dateIndex, batteryKey) {
  const r = DATA.plans[siteId][dateIndex].raw;
  const kwh = BATTERIES[batteryKey];
  const sun = r.sun_fraction >= SUN_ENOUGH;
  const call = r.longest_no_contact_h <= MAX_WAIT_H && !r.longest_no_contact_lower_bound;
  const battery = kwh >= r.battery_kwh && !r.longest_night_lower_bound;
  return {
    sun, call, battery,
    total: Number(sun) + Number(call) + Number(battery),
    need_kwh: r.battery_kwh, night_h: r.longest_night_h, night_lower_bound: r.longest_night_lower_bound,
    wait_h: r.longest_no_contact_h, wait_lower_bound: r.longest_no_contact_lower_bound,
    sun_fraction: r.sun_fraction,
  };
}
