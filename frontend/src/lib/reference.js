// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { pct, pctSpan } from './format.js';

/** "Sun 72.7 % · Earth 51.9 %" from metrics.reference_long_term (NASA PGDA), or '—'. */
export const longTermLine = (t, lt) => (lt?.available ? `${t('common.sun')} ${pct(lt.sun_avg)} · ${t('common.earth')} ${pct(lt.earth_avg)}` : '—');

/** P10–P90 within 300 m for Sun and Earth, or '—'. */
export const longTermSpread = (t, lt) => (lt?.available ? `${t('common.sun')} ${pctSpan(...lt.sun_p10_p90_300m)} · ${t('common.earth')} ${pctSpan(...lt.earth_p10_p90_300m)}` : '—');

/** Permanent shadow nearby: shown only when there is some within 300 m. */
export const showPsr = (lt) => !!(lt?.available && lt.psr_fraction_300m > 0);
