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
