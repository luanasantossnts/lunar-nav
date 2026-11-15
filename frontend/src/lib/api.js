// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
// Thin client for the Lunar Nav PHP API. Same-origin by default (/api).
const BASE = (import.meta.env.VITE_API_BASE || './api').replace(/\/$/, '');

const memo = new Map();

async function request(path, { method = 'GET', body, signal, cache = true } = {}) {
  const url = `${BASE}${path}`;
  const key = method === 'GET' ? url : null;
  if (cache && key && memo.has(key)) return memo.get(key);
  const p = (async () => {
    const res = await fetch(url, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) || res.statusText }; }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = data.code; // stable code for a polite, translated message (limits.*)
      throw err;
    }
    return data;
  })();
  if (key && cache) {
    memo.set(key, p);
    p.then((d) => { if (d && d.available === false) memo.delete(key); }).catch(() => memo.delete(key));
  }
  return p;
}

export const siteParams = (site) =>
  site.id && site.id !== 'custom'
    ? { site: site.id }
    : { lat: site.lat, lon: site.lon, alt_km: site.alt_km ?? 0 };

/** Power-model defaults (same as the API); only values that differ are sent, as pw_*. */
export const POWER_DEFAULTS = { panel_w: 400, orientation: 'vertical_tracking', load_w: 150, survival_w: 60, dod: 0.8, wh_per_kg: 150 };
export const pwParams = (p) => Object.fromEntries(Object.entries(p || {})
  .filter(([k, v]) => k in POWER_DEFAULTS && v !== '' && v !== null && v !== undefined && String(v) !== String(POWER_DEFAULTS[k]))
  .map(([k, v]) => [`pw_${k}`, v]));

const qs = (o) =>
  '?' + Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export const api = {
  health: () => request('/health'),
  sites: () => request('/sites'),
  terrain: (site) => request('/terrain' + qs(siteParams(site))),
  metrics: (site, o) => request('/metrics' + qs({ ...siteParams(site), start: o.start, days: o.days, mode: o.mode, step: o.step, earth_margin: o.earthMargin, series: o.series ? 1 : undefined, spread: o.spread ? 1 : undefined, ...pwParams(o.power) })),
  delay: (site, o) => request('/delay' + qs({ ...siteParams(site), start: o.start, days: o.days, delay_days: o.delayDays, mode: o.mode, earth_margin: o.earthMargin, ...pwParams(o.power) })),
  windows: (site, o) => request('/windows' + qs({ ...siteParams(site), from: o.from, to: o.to, duration_days: o.durationDays, min_sun_fraction: o.minSun, min_earth_hours_per_day: o.minEarthHours, min_comm_hours_per_day: o.minCommHours, max_dark_hours: o.maxDark, max_battery_kwh: o.maxBattery, mode: o.mode, ...pwParams(o.power) })),
  sensitivity: (site, o) => request('/sensitivity' + qs({ ...siteParams(site), start: o.start, days: o.days, ...pwParams(o.power) })),
  validation: () => request('/validation'),
  /** Month-by-month Sun/Earth visibility over a year, read from the cache only (Charts tab). */
  chartsYear: (year = 2030) => request('/charts/year' + qs({ year })),
  svs: () => request('/svs'),
  analyst: (body) => request('/analyst', { method: 'POST', body, cache: false }),
  terrainAsset: (siteId, name) => `${BASE}/terrain/asset?site=${encodeURIComponent(siteId)}&name=${encodeURIComponent(name)}`,
  /**
   * Read aloud with ElevenLabs. part = 'summary' (Conclusion + Trade-off, ≤ 900 characters, decided
   * by the server) or 'full' (≤ 2 500). Returns the URL of the cached MP3 (the browser may cache it).
   */
  async tts(text, lang, part = 'summary') {
    const r = await request('/tts', { method: 'POST', body: { text, lang, part }, cache: false });
    return { url: `${BASE}/tts/file?h=${encodeURIComponent(r.h)}`, cached: r.cached };
  },
  /** Speech input (ElevenLabs). duration in seconds; the server refuses clips over 30 s / 2 MB. */
  async stt(blob, lang, duration) {
    const fd = new FormData();
    fd.append('audio', blob, 'speech.webm');
    fd.append('lang', lang);
    fd.append('duration', String(duration));
    const res = await fetch(`${BASE}/stt`, { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'Transcription failed'); e.status = res.status; e.code = data.code; throw e; }
    return data.text || '';
  },
};
