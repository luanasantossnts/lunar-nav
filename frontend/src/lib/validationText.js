// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Validation checks store language-neutral params as plain strings ("99.1", "-1.2", "0.005").
 * This turns them into display text with the screen's formatter: the language's decimal
 * separator, a true minus sign (U+2212) and a no-break space before "%". Nothing is recomputed:
 * the number of decimals stored is kept.
 */
import { NBSP, fixed, fx } from './format.js';

const NUMERIC = /^[+−-]?\d+(?:\.\d+)?$/;

/** One stored number as display text ("−1.2" → "−1,2" in pt/es), keeping its decimals and a leading "+". */
export function localNumber(s) {
  const raw = String(s).replace('−', '-');
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  const text = fixed(Number(raw), decimals);
  return raw.startsWith('+') ? `+${text}` : text;
}

/** "DSS-14 43.1% · DSS-43 40.9%" → "DSS-14 43,1 % · DSS-43 40,9 %" (pt/es). */
export const localPercents = (s) => String(s).replace(/(\d+\.\d+)\s?%/g, (_, n) => `${fx(Number(n), n.split('.')[1].length)}${NBSP}%`);

/** Params of one check, ready for the translated template. */
export function localParams(check, siteName = (id) => id, t = null) {
  const out = {};
  for (const [k, v] of Object.entries(check?.params || {})) {
    if (k === 'site') out[k] = siteName(v);
    else if (k === 'stations') out[k] = localPercents(v);
    else if (k === 'same' && t) out[k] = t(v === 'yes' ? 'method.pgda.yes' : 'method.pgda.no');
    else if (typeof v === 'string' && NUMERIC.test(v)) out[k] = localNumber(v);
    else out[k] = v;
  }
  // PGDA: the per-site list is rebuilt from the stored rows, with site names.
  if (check?.key === 'pgda' && Array.isArray(check.detail?.rows)) {
    out.list = check.detail.rows
      .filter((r) => r.delta_points?.sun !== undefined && r.delta_points?.sun !== null)
      .map((r) => `${siteName(r.site)} ${r.delta_points.sun > 0 ? '+' : r.delta_points.sun < 0 ? '−' : '±'}${fixed(Math.abs(r.delta_points.sun), 1)}`)
      .join(' · ');
  }
  return out;
}
