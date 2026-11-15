// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
// Client-side helpers on API results. Rows are [unix, azimuth°, elevation°].

/** True when t falls inside one of the visible spans [[start, end], ...]. */
export function inSpans(spans, t) {
  if (!spans) return false;
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = spans[mid];
    if (t < s) hi = mid - 1;
    else if (t > e) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Azimuth/elevation at time t, interpolated between samples (azimuth wraps). */
export function positionAt(rows, t) {
  if (!rows || rows.length === 0) return null;
  if (t <= rows[0][0]) return { az: rows[0][1], el: rows[0][2] };
  const last = rows[rows.length - 1];
  if (t >= last[0]) return { az: last[1], el: last[2] };
  let lo = 0;
  let hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= t) lo = mid; else hi = mid;
  }
  const a = rows[lo];
  const b = rows[hi];
  const f = (t - a[0]) / (b[0] - a[0]);
  let daz = b[1] - a[1];
  if (daz > 180) daz -= 360;
  if (daz < -180) daz += 360;
  return { az: (((a[1] + daz * f) % 360) + 360) % 360, el: a[2] + (b[2] - a[2]) * f };
}

/** Skyline elevation from a mask {az_step_deg, elevations} at an azimuth; 0 when no mask. */
export function horizonAt(mask, az) {
  if (!mask) return 0;
  const n = mask.elevations.length;
  const x = ((((az % 360) + 360) % 360) / mask.az_step_deg);
  const i = Math.floor(x);
  const f = x - i;
  const a = mask.elevations[i % n];
  const b = mask.elevations[(i + 1) % n];
  return a + (b - a) * f;
}

/**
 * Status of a body at time t, using the same rule as the API (el − skyline − margin > 0):
 *   'visible'  above the skyline by more than the antenna margin;
 *   'margin'   above the skyline (or the 0° horizon) but within the antenna margin;
 *   'terrain'  above the 0° smooth-sphere horizon but behind terrain;
 *   'below'    below the 0° smooth-sphere horizon (and the skyline).
 */
export function bodyStatus(rows, mask, t, margin = 0) {
  const p = positionAt(rows, t);
  if (!p) return null;
  const sky = horizonAt(mask, p.az);
  const base = { ...p, sky, margin };
  if (p.el - sky - margin > 0) return { ...base, status: 'visible' };
  if (p.el - sky > 0) return { ...base, status: 'margin' };
  if (p.el > 0) return { ...base, status: 'terrain' };
  return { ...base, status: 'below' };
}

/** Fraction-of-period position of t. */
export const fracOf = (t, start, end) => Math.min(1, Math.max(0, (t - start) / (end - start)));
