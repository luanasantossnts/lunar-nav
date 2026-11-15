// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Pure helpers for the 3D view's lunar look (no three.js here, so they can be tested):
 * regolith shading, where the Sun and Earth sit in the scene, the distant-skyline ring from the
 * 150 km horizon mask, and the opening camera (low, behind the site, looking towards the Sun).
 *
 * Scene axes (as in Terrain3D): X = east, Y = up, Z = south (north is −Z).
 */
import { direction } from './shadow.js';

/** Light, slightly warm grey regolith (linear RGB). */
export const ALBEDO = [0.43, 0.41, 0.375];
/** Airless Moon: almost no ambient light, so shadows are nearly black. */
export const AMBIENT = 0.006;
/** Display exposure: hard sunlight, grazing light still readable (1 − e^(−k·E)). */
export const EXPOSURE = 6.5;
/** Earthlight: faint and blue (only when Earth is above the skyline and the Sun is not lighting the point). */
export const EARTH_TINT = [0.55, 0.7, 1.0];
export const EARTH_GAIN = 0.05;

/**
 * Colour of one vertex. nx, ny, nz: surface normal (east, north, up); S, E: unit vectors to the
 * Sun and Earth; vis: visible fraction of the solar disc from that vertex (terrain shadow);
 * earthLit: Earth above the site's skyline. Returns linear RGB in [0, 1].
 */
export function regolith(nx, ny, nz, S, E, vis, earthLit, out = [0, 0, 0]) {
  const sunIrr = vis * Math.max(0, nx * S[0] + ny * S[1] + nz * S[2]);
  const earthIrr = earthLit ? Math.max(0, nx * E[0] + ny * E[1] + nz * E[2]) * EARTH_GAIN : 0;
  const slope = Math.max(0, nz); // steeper walls receive less of the faint ambient: relief detail in shadow
  for (let ch = 0; ch < 3; ch++) {
    const e = sunIrr + earthIrr * EARTH_TINT[ch];
    out[ch] = Math.min(1, ALBEDO[ch] * ((1 - Math.exp(-EXPOSURE * e)) + AMBIENT * slope));
  }
  return out;
}

/** Scene position of a body at azimuth/elevation, `R` metres from `target` (the site). */
export function skyPosition(target, azDeg, elDeg, R) {
  const [east, north, up] = direction(azDeg, elDeg);
  return [target[0] + east * R, target[1] + up * R, target[2] - north * R];
}

/** Elevation of the horizon mask at an azimuth (linear between samples, wrapping at 360°). */
export function maskElevation(mask, azDeg) {
  if (!mask?.elevations?.length) return 0;
  const step = mask.az_step_deg;
  const n = mask.elevations.length;
  const x = ((((azDeg % 360) + 360) % 360) / step);
  const i = Math.floor(x) % n;
  const f = x - Math.floor(x);
  return mask.elevations[i] * (1 - f) + mask.elevations[(i + 1) % n] * f;
}

/**
 * The distant skyline as a ring: for each azimuth, the bottom (well below the horizon) and the
 * top (the mask elevation) at radius R around the site. Returns flat arrays of [x, y, z] pairs.
 */
export function ringProfile(mask, target, R, segments = 720, bottomDeg = -20) {
  const top = []; const bottom = [];
  for (let s = 0; s <= segments; s++) {
    const az = (s / segments) * 360;
    top.push(...skyPosition(target, az, maskElevation(mask, az), R / Math.cos((maskElevation(mask, az) * Math.PI) / 180)));
    bottom.push(...skyPosition(target, az, bottomDeg, R / Math.cos((bottomDeg * Math.PI) / 180)));
  }
  return { top, bottom };
}

/**
 * Opening camera: low (about 16° above the horizontal), behind the site and looking towards
 * the Sun's azimuth (30° off it), so the horizon and the sky are in the frame. `d` from the tile size.
 */
export function openingView(sunAzDeg, extent, { elevationDeg = 16, distanceFrac = 0.16, aspect = 2, fovDeg = 45 } = {}) {
  // Turned off the Sun line (up to 30°, less on narrow screens) so the Sun stays in the frame
  // and sunlit slopes show beside it.
  const halfH = (Math.atan(Math.tan((fovDeg / 2) * (Math.PI / 180)) * aspect) * 180) / Math.PI;
  const offsetDeg = Math.max(0, Math.min(30, halfH - 8));
  const az = Number.isFinite(sunAzDeg) ? (sunAzDeg + 180 + offsetDeg) % 360 : 180;
  return { az, el: elevationDeg, d: extent * distanceFrac };
}

/* ---------- Side-light framing ---------- */

const RAD = Math.PI / 180;

/** Camera position for an azimuth (from the site towards the camera), elevation and distance. */
const camAt = (target, azDeg, elDeg, d) => [
  target[0] + d * Math.cos(elDeg * RAD) * Math.sin(azDeg * RAD),
  target[1] + d * Math.sin(elDeg * RAD),
  target[2] - d * Math.cos(elDeg * RAD) * Math.cos(azDeg * RAD),
];

/**
 * Share of the vertices in the camera's frame (and facing it) that the Sun lights: visible
 * disc > 50 % and the surface turned towards the Sun. hm: {z, n, ext, min, exag}; normals: the
 * mesh normals (east, north, up per vertex); vis: visible fraction of the solar disc per vertex.
 * Every `step`-th vertex is used (fast enough to compare two candidate views).
 */
export function litFractionInView(hm, normals, vis, S, cam, target, fovDeg, aspect, step = 4) {
  const { z, n, ext, min, exag } = hm;
  const f = [target[0] - cam[0], target[1] - cam[1], target[2] - cam[2]];
  const fl = Math.hypot(...f); f[0] /= fl; f[1] /= fl; f[2] /= fl;
  const r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; // f × up
  const rl = Math.hypot(...r); r[0] /= rl; r[1] /= rl; r[2] /= rl;
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const tv = Math.tan((fovDeg / 2) * RAD); const th = tv * aspect;
  let inView = 0; let lit = 0;
  for (let row = 0; row < n; row += step) {
    for (let col = 0; col < n; col += step) {
      const i = row * n + col;
      const p = [-ext / 2 + (col * ext) / (n - 1), (z[i] - min) * exag, -(ext / 2 - (row * ext) / (n - 1))];
      const v = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]];
      const depth = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
      if (depth <= 0) continue;
      const x = (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (depth * th);
      const y = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (depth * tv);
      if (Math.abs(x) > 1 || Math.abs(y) > 1) continue;
      const nE = normals[i * 3]; const nN = normals[i * 3 + 1]; const nU = normals[i * 3 + 2];
      const ns = [nE, nU, -nN]; // to scene axes
      if (ns[0] * -v[0] + ns[1] * -v[1] + ns[2] * -v[2] <= 0) continue; // faces away from the camera
      inView++;
      if (vis[i] > 0.5 && nE * S[0] + nN * S[1] + nU * S[2] > 0.02) lit++;
    }
  }
  return inView ? lit / inView : 0;
}

/**
 * Side-light opening view: the camera at the Sun's azimuth ± 90°, ~30° up, centred on the site;
 * the side whose frame shows more sunlit terrain wins. The Sun is then at the frame edge or just outside.
 */
export function sideView(hm, normals, vis, S, sunAzDeg, target, { fovDeg = 45, aspect = 2, elevationDeg = 30, distanceFrac = 0.16 } = {}) {
  const d = hm.ext * distanceFrac;
  const options = [90, -90].map((off) => {
    const az = (((sunAzDeg + off) % 360) + 360) % 360;
    return { az, el: elevationDeg, d, lit: litFractionInView(hm, normals, vis, S, camAt(target, az, elevationDeg, d), target, fovDeg, aspect) };
  });
  return options[0].lit >= options[1].lit ? options[0] : options[1];
}

/** Share of near-black pixels in an RGBA buffer (sampled every `step`-th pixel). */
export function darkFraction(rgba, step = 7, threshold = 14) {
  let dark = 0; let all = 0;
  for (let p = 0; p < rgba.length; p += 4 * step) {
    all++;
    if (Math.max(rgba[p], rgba[p + 1], rgba[p + 2]) < threshold) dark++;
  }
  return all ? dark / all : 0;
}

/** The 3D framing chosen in this browser session: 'side' (default) or 'sun'. */
export const VIEW_KEY = 'lunarnav.view3d';
export function loadViewMode(store) {
  try { return (store ?? window.sessionStorage).getItem(VIEW_KEY) === 'sun' ? 'sun' : 'side'; } catch { return 'side'; }
}
export function saveViewMode(mode, store) {
  try { (store ?? window.sessionStorage).setItem(VIEW_KEY, mode === 'sun' ? 'sun' : 'side'); } catch { /* storage blocked */ }
}
