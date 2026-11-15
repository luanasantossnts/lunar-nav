// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/** No-break space between a number and its unit, so "50.8 %" never wraps as "50.8 / %". */
export const NBSP = '\u00A0';

/* Decimal separator for display: "." in English, "," in Portuguese and Spanish. The store sets
   it when the language changes; CSV/JSON exports run inside withPoint() and keep ".". */
let SEP = '.';
export const setNumberLang = (lang) => { SEP = lang === 'pt' || lang === 'es' ? ',' : '.'; };
export const decimalSep = () => SEP;
export const withPoint = (fn) => { const prev = SEP; SEP = '.'; try { return fn(); } finally { SEP = prev; } };
/** A number as written (no rounding) with the display decimal separator, e.g. 0.8 → "0,8". */
export const plain = (v) => (v === null || v === undefined ? '—' : SEP === '.' ? String(v) : String(v).replace('.', SEP));
/** toFixed with the display decimal separator. */
export const fx = (v, d = 0) => { const t = Number(v).toFixed(d); return SEP === '.' ? t : t.replace('.', SEP); };
const unitSep = (unit) => (unit ? `${NBSP}${String(unit).replace(/^\s+/, '')}` : '');
export const pct = (f, d = 1) => (f === null || f === undefined || Number.isNaN(f) ? '—' : `${fx(f * 100, d)}${NBSP}%`);
/** Range of two fractions as "a–b %", lower first. */
export const pctSpan = (a, b, d = 1) => {
  if (a === null || a === undefined || b === null || b === undefined) return '—';
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return `${fx(lo * 100, d)}–${fx(hi * 100, d)}${NBSP}%`;
};
/** Disc range of one body: full disc (lower) to first limb (upper). */
export const discSpan = (dr) => (dr ? pctSpan(dr.full_disc.fraction, dr.first_limb.fraction) : '—');
/** Position spread of one body: P10–P90. */
export const spreadSpan = (ps, body) => (ps?.available && ps[body] ? pctSpan(ps[body].p10, ps[body].p90) : '—');
/** Number with narrow no-break-space thousands and a unit, e.g. "6 712 Wh/d" (never wraps). */
export const num = (v, d = 0, unit = '') => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const [int, frac] = Math.abs(v).toFixed(d).split('.');
  const s = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F') + (frac ? SEP + frac : '');
  return `${v < 0 ? '−' : ''}${s}${unitSep(unit)}`;
};
/** Range of two numbers, lower first, e.g. "5 900–7 100 Wh/d". */
export const numSpan = (a, b, d = 0, unit = '') => {
  if (a === null || a === undefined || b === null || b === undefined) return '—';
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return `${num(lo, d)}–${num(hi, d)}${unitSep(unit)}`;
};
/** Text form of a possibly lower-bound value (exports): "≥ 349.9 h". */
export const ge = (text, flag) => (flag ? `≥${NBSP}${text}` : text);
/** Numeric range whose ends may be lower bounds, lower first: "≥14.26–≥27.81 kWh". */
export const numSpanBound = (a, fa, b, fb, d = 0, unit = '') => {
  if (a === null || a === undefined || b === null || b === undefined) return '—';
  const [[lo, flo], [hi, fhi]] = a <= b ? [[a, fa], [b, fb]] : [[b, fb], [a, fa]];
  return `${flo ? '≥' : ''}${num(lo, d)}–${fhi ? '≥' : ''}${num(hi, d)}${unitSep(unit)}`;
};
export const hrs = (h, d = 1) => (h === null || h === undefined ? '—' : `${fx(h, d)}${NBSP}h`);
export const deg = (v, d = 2) => (v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}${fx(Math.abs(v), d)}°`);
export const degRange = (a, b, d = 2) => `${deg(a, d)} – ${deg(b, d)}`;
/** A number for display with a true minus sign (U+2212), never a hyphen. */
export const fixed = (v, d = 0) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${Number(v) < 0 && Number(Number(v).toFixed(d)) !== 0 ? '\u2212' : ''}${fx(Math.abs(Number(v)), d)}`);
/** Replaces hyphen-minus before a digit with U+2212 in free text (validation results, labels). */
export const minus = (s) => (typeof s === 'string' ? s.replace(/(^|[\s(\[=:≥≤<>~,;/|·])-(?=\.?\d)/g, '$1\u2212') : s);
/** Angles (elevation/azimuth) rounded to two decimals, for exports; objects and arrays are mapped. */
export const round2 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : Array.isArray(v) ? v.map(round2) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round2(x)])) : v);

const pad = (n) => String(n).padStart(2, '0');
export const isoMin = (t) => {
  if (t === null || t === undefined) return '—';
  const d = new Date(t * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
};
export const shortDate = (t) => {
  const d = new Date(t * 1000);
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const dateInput = (t) => {
  const d = new Date(t * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const parseDateInput = (s) => Math.floor(Date.parse(`${s}T00:00:00Z`) / 1000);
export const coord = (lat, lon) => `${fx(Math.abs(lat), 2)}°${lat < 0 ? 'S' : 'N'} ${fx(((lon % 360) + 360) % 360, 2)}°E`;
export const signed = (v, d = 1, unit = 'h') => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fx(Math.abs(v), d)}${unitSep(unit)}`);
