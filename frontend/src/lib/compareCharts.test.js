// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deltaQualifier, deltaRows, divergingMax, groupedBars, matchingSpread } from './compareCharts.js';

const T0 = 1909094400;
const blk = (f, lo, hi) => ({ fraction: f, disc_range: { full_disc: { fraction: lo }, centre: { fraction: f }, first_limb: { fraction: hi } } });
const scen = (id, start, o = {}) => ({
  site: { id, name: `${id} name, region` },
  provenance: { horizon: { mode: o.mode ?? 'terrain' } },
  metrics: { period: { start, end: start + 30 * 86400 }, sun: blk(o.sun ?? 0.5, 0.45, 0.55), earth: blk(0.4, 0.35, 0.45), comm: blk(0.39, 0.34, 0.44), power: { lower_bound: !!o.lb } },
});
const delay = (id, o = {}) => ({
  delay_days: 10,
  scenarios: [scen(id, T0, o.orig), scen(id, T0 + 10 * 86400, o.del)],
  delta: { sun_hours: 17.46, earth_hours: -21.08, comm_hours: 18.85, battery_kwh: -1.008, ...o.delta },
});
const result = (id, o = {}) => ({ ...scen(id, T0, o), position_spread: { available: true, sun: { p10: 0.48, p90: 0.73 }, earth: { p10: 0, p90: 0.43 }, comm: { p10: 0, p90: 0.42 } } });

describe('Compare charts data', () => {
  it('1 · four bars per metric (A orig, A delayed, B orig, B delayed), with disc range', () => {
    const g = groupedBars(delay('a'), delay('b'), result('a'), result('b'));
    expect(g.map((x) => x.key)).toEqual(['sun', 'earth', 'comm']);
    expect(g[0].bars.map((b) => `${b.who}${b.when}`)).toEqual(['Aoriginal', 'Adelayed', 'Boriginal', 'Bdelayed']);
    expect(g[0].bars[0]).toMatchObject({ value: 0.5, disc: [0.45, 0.55] });
  });
  it('1 · the ±300 m box only on the original bars, and only when the loaded result is the same scenario', () => {
    const g = groupedBars(delay('a'), delay('b'), result('a'), result('b', { mode: 'geometric' }));
    expect(g[0].bars[0].pos).toEqual([0.48, 0.73]); // A original: same site, period, horizon
    expect(g[0].bars[1].pos).toBeNull(); // delayed: the delay endpoint has no spread (no new request)
    expect(g[0].bars[2].pos).toBeNull(); // B: loaded result has another horizon mode → not used
    expect(matchingSpread(result('x'), scen('y', T0))).toBeNull();
  });
  it('2 · signed changes for A and B; battery qualifier follows which side is a minimum', () => {
    const [ra] = deltaRows(delay('a'), null);
    expect(ra.hours).toEqual({ sun: 17.46, earth: -21.08, comm: 18.85 });
    expect(ra.battery).toEqual({ value: -1.008, qualifier: '' });
    expect(deltaQualifier(false, true)).toBe('≥'); // only the delayed night is a minimum: change is at least this
    expect(deltaQualifier(true, false)).toBe('≤'); // only the original is a minimum: change is at most this
    expect(deltaQualifier(true, true)).toBe('≈');
    expect(deltaRows(delay('m', { del: { lb: true } }), null)[0].battery.qualifier).toBe('≥');
  });
  it('2 · common hours scale and separate battery scale are symmetric and never zero', () => {
    expect(divergingMax([17.46, -21.08, 18.85])).toBeCloseTo(21.08 * 1.1, 6);
    expect(divergingMax([0, null])).toBe(1);
  });
  it('the charts are not drawn when A = B, and every string exists in three languages', () => {
    expect(readFileSync(new URL('../pages/Compare.jsx', import.meta.url), 'utf8')).toMatch(/siteA !== siteB && a\.data && b\.data && <CompareCharts/);
    const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const en = keys(JSON.parse(readFileSync(new URL('../locales/en.json', import.meta.url), 'utf8')).compare.charts).sort();
    for (const l of ['pt', 'es']) expect(keys(JSON.parse(readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8')).compare.charts).sort(), l).toEqual(en);
  });
});
