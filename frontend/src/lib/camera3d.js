// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Initial framing of the 3D terrain: an oblique view from above, centred on the site, where
 * the whole frame is filled with terrain from the tile (no tile edge, no empty space).
 *
 * Scene coordinates (as in Terrain3D): X = east, Y = up, Z = south; the tile spans
 * ±ext/2 in X and Z; heights are (z − min) × exag, so the lowest point is at Y = 0.
 * Each candidate view is tested by ray-marching rays through the frame border over the
 * heightmap: a view "fits" when every ray hits terrain within the safe radius.
 */

const RAD = Math.PI / 180;

/** Scene height (Y) at scene (X, Z), bilinear on the heightmap; null outside the tile. */
export function sceneHeight(hm, X, Z) {
  const { z, n, ext, min, exag } = hm;
  const c = (X / ext + 0.5) * (n - 1);
  const r = (Z / ext + 0.5) * (n - 1); // row 0 = north edge = −Z
  if (c < 0 || r < 0 || c > n - 1 || r > n - 1) return null;
  const c0 = Math.min(n - 2, Math.floor(c)); const r0 = Math.min(n - 2, Math.floor(r));
  const fc = c - c0; const fr = r - r0;
  const h = (i, j) => z[i * n + j];
  const v = (h(r0, c0) * (1 - fc) + h(r0, c0 + 1) * fc) * (1 - fr) + (h(r0 + 1, c0) * (1 - fc) + h(r0 + 1, c0 + 1) * fc) * fr;
  return (v - min) * exag;
}

/** Camera position for a compass azimuth (from the site towards the camera), elevation and distance. */
export function cameraPosition(target, azDeg, elDeg, d) {
  const a = azDeg * RAD; const e = elDeg * RAD;
  return [target[0] + d * Math.cos(e) * Math.sin(a), target[1] + d * Math.sin(e), target[2] - d * Math.cos(e) * Math.cos(a)];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/** Rays through the border of the frame (and its centre), as unit directions. */
export function borderRays(pos, target, fovDeg, aspect, k = 5) {
  const f = norm(sub(target, pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const tv = Math.tan((fovDeg / 2) * RAD); const th = tv * aspect;
  const pts = [[0, 0]];
  for (let i = 0; i < k; i++) {
    const s = -1 + (2 * i) / (k - 1);
    pts.push([s, 1], [s, -1], [1, s], [-1, s]);
  }
  return pts.map(([sx, sy]) => norm([f[0] + r[0] * sx * th + u[0] * sy * tv, f[1] + r[1] * sx * th + u[1] * sy * tv, f[2] + r[2] * sx * th + u[2] * sy * tv]));
}

/** True when the ray from pos hits terrain inside the safe radius. */
function rayHits(hm, pos, dir, radius, step) {
  let p = pos;
  for (let i = 0; i < 4000; i++) {
    p = [p[0] + dir[0] * step, p[1] + dir[1] * step, p[2] + dir[2] * step];
    if (Math.hypot(p[0], p[2]) > radius) return false;
    const h = sceneHeight(hm, p[0], p[2]);
    if (h === null) return false;
    if (p[1] <= h) return true;
    if (p[1] < 0) return true;
  }
  return false;
}

/** Does the whole frame show terrain from the tile, for this camera? */
export function viewFits(hm, target, azDeg, elDeg, d, fovDeg, aspect, radius) {
  const pos = cameraPosition(target, azDeg, elDeg, d);
  const ground = sceneHeight(hm, pos[0], pos[2]);
  if (ground === null || pos[1] < ground + hm.ext * 0.01) return false; // camera inside the relief
  const step = (hm.ext / (hm.n - 1)) * 0.75;
  return borderRays(pos, target, fovDeg, aspect).every((dir) => rayHits(hm, pos, dir, radius, step));
}

/** Largest distance (within [dMin, dMax]) at which the view fits; 0 if none does. */
export function fitDistance(hm, target, azDeg, elDeg, fovDeg, aspect, radius, dMin, dMax) {
  // Scan from far to near (fit is not strictly monotonic over relief), then refine.
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const d = dMax - ((dMax - dMin) * i) / N;
    if (viewFits(hm, target, azDeg, elDeg, d, fovDeg, aspect, radius)) {
      let lo = d; let hi = Math.min(dMax, d + (dMax - dMin) / N);
      for (let j = 0; j < 8; j++) { const m = (lo + hi) / 2; if (viewFits(hm, target, azDeg, elDeg, m, fovDeg, aspect, radius)) lo = m; else hi = m; }
      return lo;
    }
  }
  return 0;
}

/**
 * Best opening view: an elevation of 40° or 45° and the compass direction that allow the
 * widest view (largest distance) with the frame filled by the tile; steeper only if neither fits.
 */
export function initialView(hm, target, { fovDeg = 45, aspect = 2, fade = 0.07, groups = [[40, 45], [55], [65], [75]] } = {}) {
  const radius = (hm.ext / 2) * (1 - fade) * 0.98;
  const dMin = hm.ext * 0.04; const dMax = hm.ext * 0.6;
  for (const els of groups) {
    let best = null;
    for (const el of els) {
      for (let az = 0; az < 360; az += 22.5) {
        const d = fitDistance(hm, target, az, el, fovDeg, aspect, radius, dMin, dMax);
        if (d > 0 && (!best || d > best.d)) best = { az, el, d };
      }
    }
    if (best) return { ...best, fits: true };
  }
  return { az: 135, el: 45, d: dMin * 2, fits: false };
}
