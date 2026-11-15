// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Read helpers for kids-data.json (exported from the main Lunar Nav API by kids/scripts/export-data).
 * Nothing here computes new science: positions, sunshine and "can call" come from the API.
 */
import DATA from '../data/kids-data.json';

export { DATA };
export const SITE_IDS = ['shackleton_ridge', 'im2_athena', 'malapert_m1'];
const F = Object.fromEntries(DATA.sample_fields.map((k, i) => [k, i]));

/** One animation sample as an object: day, sun/earth azimuth, elevation and flags. */
export function sample(siteId, i) {
  const s = DATA.sites[siteId].samples[Math.max(0, Math.min(i, DATA.sites[siteId].samples.length - 1))];
  return {
    day: s[F.day],
    sunAz: s[F.sun_az], sunEl: s[F.sun_el], sunUp: s[F.sun_up] === 1,
    earthAz: s[F.earth_az], earthEl: s[F.earth_el], earthUp: s[F.earth_up] === 1,
    dsn: s[F.dsn_sees_moon] === 1, canCall: s[F.can_call] === 1,
  };
}
export const sampleCount = (siteId) => DATA.sites[siteId].samples.length;

/** Skyline (terrain horizon) elevation at an azimuth, linear between the 2° points. */
export function skylineAt(siteId, az) {
  const sky = DATA.sites[siteId].skyline;
  const step = 360 / sky.length;
  const x = (((az % 360) + 360) % 360) / step;
  const i = Math.floor(x) % sky.length;
  const f = x - Math.floor(x);
  return sky[i] * (1 - f) + sky[(i + 1) % sky.length] * f;
}

/** Days with the Sun up from day 0 to `day` (from the API's sunshine spans). */
export function sunDaysUntil(siteId, day) {
  return DATA.sites[siteId].spans.sun.reduce((acc, [a, b]) => acc + Math.max(0, Math.min(b, day) - a), 0);
}

/**
 * Why Earth cannot be called at one moment: 'ok' (can call), 'antennas' (Earth is up but no DSN
 * antenna sees the Moon), 'mountains' (Earth above 0° but behind the skyline), 'below' (Earth below the horizon).
 */
export function callReason(siteId, s) {
  if (s.canCall) return 'ok';
  if (s.earthUp) return 'antennas';
  return s.earthEl > 0 && s.earthEl <= skylineAt(siteId, s.earthAz) ? 'mountains' : 'below';
}

/** Azimuth window that holds Earth's whole path (it barely moves in the lunar sky), ±margin. */
export function earthWindow(siteId, margin = 25) {
  const az = DATA.sites[siteId].samples.map((s) => s[F.earth_az]);
  // Earth stays within a small arc; centre it (handles the 0/360 wrap).
  const ref = az[0];
  const rel = az.map((a) => ((a - ref + 540) % 360) - 180);
  const lo = ref + Math.min(...rel) - margin;
  const hi = ref + Math.max(...rel) + margin;
  return { from: lo, to: hi };
}

/** Battery level (%) after `t` days of the longest night: survival load drains it from 100 % to 20 % (depth of discharge 0.8) at the end. */
export function batteryLevel(t, nightDays, sizeFactor = 1) {
  const dod = DATA.about.power_model.dod;
  if (!nightDays) return 100;
  const used = (dod / sizeFactor) * Math.min(1, Math.max(0, t / nightDays)) * 100;
  return Math.max(100 - dod * 100, 100 - used);
}

/** True when a battery of this size runs out before the night ends. */
export const runsOut = (t, nightDays, sizeFactor) => sizeFactor < 1 && t / nightDays >= sizeFactor;
