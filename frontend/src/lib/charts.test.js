// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeT } from './i18n.js';
import {
  CHART_SITES, batteryRows, daylightBeforeNight, delayRows, monthlyLines, pgdaRows, siteBars, spreadLabels, sunHistogram, whereVsWhen, yearMean,
} from './charts.js';

const T0 = 1909094400; // 2030-07-01T00:00Z
const H = 3600;
const block = (f, lo, hi) => ({ fraction: f, disc_range: { full_disc: { fraction: lo }, centre: { fraction: f }, first_limb: { fraction: hi } } });
const result = (id, o = {}) => ({
  site: { id, name: `${id} name` },
  provenance: { horizon: { mode: o.mode ?? 'terrain' }, source: 'JPL Horizons API' },
  metrics: {
    period: { start: T0, end: T0 + 30 * 86400 },
    sun: { ...block(0.998, 0.943, 1), spans: o.sunSpans ?? [[T0, T0 + 100 * H]], first_set: T0 + 100 * H },
    earth: block(0.425, 0.383, 0.467),
    comm: { ...block(0.421, 0.38, 0.462), fraction: o.comm ?? 0.421 },
    power: { battery_kwh: o.kwh ?? 10, lower_bound: !!o.lb, longest_night_h: 300 },
  },
  position_spread: o.noSpread ? { available: false } : {
    available: true, radius_m: 300,
    sun: { p10: 0.481, median: 0.566, p90: 0.733 }, earth: { p10: 0, median: 0.26, p90: 0.426 }, comm: { p10: 0, median: 0.26, p90: 0.422 },
    battery_kwh: { p10: o.p10 ?? 8, p90: o.p90 ?? 20, lower_bound: { p10: false, p90: true } },
  },
});

describe('charts data', () => {
  it('lists the terrain sites plus Chandrayaan-3 in geometric mode', () => {
    expect(CHART_SITES.map(([id]) => id)).toEqual(['shackleton_ridge', 'im2_athena', 'malapert_m1', 'im1_odysseus', 'chandrayaan3']);
    expect(CHART_SITES.find(([id]) => id === 'chandrayaan3')[1]).toBe('geometric');
  });

  it('1 · bars carry the value, the disc range (low → high) and the ±300 m P10–P90', () => {
    const [s, c] = siteBars([result('shackleton_ridge'), result('chandrayaan3', { mode: 'geometric', noSpread: true })]);
    expect(s.bars.map((b) => b.key)).toEqual(['sun', 'earth', 'comm']);
    expect(s.bars[0]).toEqual({ key: 'sun', value: 0.998, disc: [0.943, 1], pos: [0.481, 0.733] });
    expect(s.bars[2].pos).toEqual([0, 0.422]);
    expect(c.mode).toBe('geometric');
    expect(c.bars.every((b) => b.pos === null)).toBe(true);
  });

  it('2 · monthly lines keep 12 points per site, and the weighted mean is the year value', () => {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sun_fraction: i < 6 ? 0 : 1, earth_fraction: 0.5 }));
    const [l] = monthlyLines({ year: 2030, sites: [{ site: 'x', name: 'X', mode: 'terrain', available: true, horizon: { mode: 'terrain' }, months }, { site: 'y', available: false }] });
    expect(l.sun).toHaveLength(12);
    expect(l.earth).toHaveLength(12);
    expect(yearMean(l.sun, 2030)).toBeCloseTo(184 / 365, 10); // July–December = 184 days
    expect(yearMean(l.earth, 2030)).toBeCloseTo(0.5, 10);
  });

  it('3 · PGDA rows from the real validation file: same ranking, Δ in points, Malapert −10.7', () => {
    const v = JSON.parse(readFileSync(new URL('../../../api/data/validation.json', import.meta.url), 'utf8'));
    const p = pgdaRows(v);
    expect(p.sameRanking).toBe(true);
    expect(p.ranking).toEqual(['shackleton_ridge', 'chandrayaan3', 'im2_athena', 'im1_odysseus', 'malapert_m1']);
    const mal = p.rows.find((r) => r.id === 'malapert_m1');
    expect(mal.sunDelta).toBeCloseTo(-10.7, 1);
    expect(p.rows.every((r) => r.sunOurs >= 0 && r.sunOurs <= 1 && r.sunPgda >= 0 && r.sunPgda <= 1)).toBe(true);
  });

  it('4 · battery rows and the "where vs when" check use the data, not a fixed claim', () => {
    const rows = batteryRows([result('a', { kwh: 27.25, p10: 14.26, p90: 27.97 }), result('b', { kwh: 5, noSpread: true, lb: true })]);
    expect(rows[0]).toMatchObject({ kwh: 27.25, pos: [14.26, 27.97], posLowerBound: [false, true] });
    expect(rows[1]).toMatchObject({ pos: null, lowerBound: true });
    const delays = [{ scenarios: [{ site: { id: 'a' } }], delta: { battery_kwh: -1.01 } }];
    expect(whereVsWhen(rows, delays)).toMatchObject({ holds: true, maxWidth: 27.97 - 14.26, maxDelayChange: 1.01 });
    const no = whereVsWhen(rows, [{ scenarios: [{ site: { id: 'a' } }], delta: { battery_kwh: 20 } }]);
    expect(no.holds).toBe(false);
    expect(no.holdsAt).toEqual([]);
    expect(no.exceptions.map((r) => r.id)).toEqual(['a']);
  });

  it('5 · daylight before the first night: 0 h when dark at landing; lower bound when the Sun never sets', () => {
    const m = (spans) => ({ period: { start: T0, end: T0 + 30 * 86400 }, sun: { spans } });
    expect(daylightBeforeNight(m([[T0, T0 + 100 * H]]))).toEqual({ hours: 100, lowerBound: false, darkAtLanding: false });
    expect(daylightBeforeNight(m([[T0 + 10 * H, T0 + 50 * H]]))).toEqual({ hours: 0, lowerBound: false, darkAtLanding: true });
    expect(daylightBeforeNight(m([[T0, T0 + 30 * 86400]]))).toEqual({ hours: 720, lowerBound: true, darkAtLanding: false });
    const [r] = delayRows([{ delay_days: 10, scenarios: [result('im2', { sunSpans: [[T0 + 5 * H, T0 + 9 * H]], comm: 0.69 }), result('im2', { comm: 0.79 })] }]);
    expect(r.daylight[0].darkAtLanding).toBe(true);
    expect(r.daylight[1].hours).toBe(100);
    expect(r.comm).toEqual([0.69, 0.79]);
  });

  it('6 · histogram counts only the points within the radius, in 10 bins', () => {
    const pts = [[0, 0, 0.998], [100, 0, 0.45], [0, 200, 0.55], [300, 0, 0.05], [400, 0, 0.9], [-500, -500, 0.2]].map(([dx, dy, f]) => ({ dx_m: dx, dy_m: dy, sun_fraction: f }));
    const h = sunHistogram({ available: true, points: pts, summary: { radius_m: 300, sun: { p10: 0.1, median: 0.5, p90: 0.9 } } });
    expect(h.n).toBe(4);
    expect(h.counts).toEqual([1, 0, 0, 0, 1, 1, 0, 0, 0, 1]);
    expect(h.sitePoint).toBe(0.998);
    expect(sunHistogram({ available: false })).toBeNull();
  });

  it('end-of-line labels never sit closer than the gap', () => {
    const s = spreadLabels([{ id: 'a', y: 50 }, { id: 'b', y: 52 }, { id: 'c', y: 51 }], 13, 0, 200);
    const ys = s.map((x) => x.y).sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(13);
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(13);
  });

  it('every Charts string exists in the three languages, with no-break space before units', () => {
    const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const en = keys(JSON.parse(readFileSync(new URL('../locales/en.json', import.meta.url), 'utf8')).charts).sort();
    for (const l of ['pt', 'es']) {
      const d = JSON.parse(readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
      expect(keys(d.charts).sort(), l).toEqual(en);
      expect(d.nav.charts, l).toBeTruthy();
      expect(d.help.screens.charts.title, l).toBeTruthy();
    }
    for (const l of ['en', 'pt', 'es']) {
      const raw = JSON.stringify(JSON.parse(readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8')).charts);
      expect(raw, l).not.toMatch(/\d (%|h|m|W|kWh)\b/);
    }
    expect(makeT('pt')('charts.c4.headline')).toBe('Onde você pousa importa mais do que quando.');
  });
});
