// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import DATA from './data/kids-data.json';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import { makeT } from './lib/lang.js';
import {
  EMPTY, MISSIONS, PHASES, PROGRESS_KEY, certificateReady, clearProgress, loadProgress, phaseComplete, phaseUnlocked,
  sanitize, saveProgress, withQuizPassed, withStars,
} from './lib/progress.js';
import { BATTERIES, CENTRE, GRID_N, cellAt, gridCells, iceResult, landingFrom, planStars, targetStars } from './lib/missions.js';

const LOCALES = { en, es, pt };
const half = (v, lb) => (lb ? Math.floor(v * 2) / 2 : Math.round(v * 2) / 2);

/** A tiny in-memory localStorage. */
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => Object.fromEntries(m) };
}

describe('new data match the API export', () => {
  it('Mission 4: Mons Mouton (IM-2) — 0 h of daylight before the first night on 1 July, 250.79 h (about 10 days) on 11 July', () => {
    const [jul1, jul11] = DATA.plans.im2_athena;
    expect([jul1.date, jul11.date]).toEqual(['2030-07-01', '2030-07-11']);
    expect(jul1.raw.daylight_before_first_night_h).toBe(0);
    expect(jul1.kids.daylight_before_night_hours).toBe(0);
    expect(jul11.raw.daylight_before_first_night_h).toBeCloseTo(250.79, 2);
    expect(jul11.kids.daylight_before_night_days).toBe(Math.round(250.79 / 24));
    expect(jul11.kids.daylight_before_night_days).toBe(10);
    // the original date is the same answer as the main /metrics export
    for (const id of Object.keys(DATA.plans)) {
      expect(DATA.plans[id][0].raw.sun_hours, id).toBeCloseTo(DATA.sites[id].raw.sun_hours, 2);
      expect(DATA.plans[id][0].raw.battery_kwh, id).toBeCloseTo(DATA.sites[id].raw.battery_kwh, 3);
      for (const p of DATA.plans[id]) {
        expect(p.kids.sun_percent, id).toBe(Math.round(100 * p.raw.sun_fraction));
        expect(p.kids.longest_no_call_days, id).toBe(half(p.raw.longest_no_contact_h / 24, p.raw.longest_no_contact_lower_bound));
      }
    }
  });
  it('Missions 5 and 7: grids of 121 points every 100 m; 300 m summary = the position spread (48.06–73.33 % → 14 to 22 days)', () => {
    for (const id of ['shackleton_ridge', 'malapert_m1']) {
      const g = DATA.grids[id];
      expect(g.points, id).toHaveLength(121);
      expect(g.spacing_m, id).toBe(100);
      expect(g.radius_300m.sun_p10, id).toBe(DATA.sites[id].raw.sun_p10_300m);
      expect(g.radius_300m.sun_p90, id).toBe(DATA.sites[id].raw.sun_p90_300m);
      for (const [, , f, days] of g.points) expect(days).toBe(Math.round(f * 30));
      expect(Math.abs(g.centre_sun_fraction - g.site_sun_fraction), id).toBeLessThan(0.005); // 2° grid masks vs 0.5° site mask
    }
    const sh = DATA.grids.shackleton_ridge.radius_300m;
    expect([Math.round(sh.sun_p10 * 30), Math.round(sh.sun_p90 * 30)]).toEqual([14, 22]);
    expect(Object.keys(gridCells('shackleton_ridge'))).toHaveLength(GRID_N * GRID_N);
  });
  it('Mission 6: twelve months of 2030 per site; Malapert has no Sun from January to June (and in December)', () => {
    for (const [id, months] of Object.entries(DATA.year.sites)) {
      expect(months, id).toHaveLength(12);
      for (const m of months) {
        expect(m.days_in_month).toBe(new Date(Date.UTC(2030, m.month, 0)).getUTCDate());
        expect(m.sun_days).toBe(Math.round(m.sun_fraction * m.days_in_month));
      }
    }
    const mal = DATA.year.sites.malapert_m1;
    expect(mal.slice(0, 6).map((m) => m.sun_days)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(mal[11].sun_days).toBe(0);
    expect(mal[6].sun_days).toBeGreaterThan(0);
  });
  it('Mission 7: NASA PGDA — 20 % of the spots within 300 m of Malapert are permanent shadow; the grid has dark squares', () => {
    expect(DATA.psr.malapert_m1.fraction_300m).toBe(0.2);
    expect(DATA.psr.malapert_m1.percent_300m).toBe(20);
    expect(DATA.grids.malapert_m1.points.filter((p) => p[3] === 0).length).toBeGreaterThan(0);
    for (const l of [en, es, pt]) expect(l.m7.note).toMatch(/may be|podría|pode haver/); // never an amount of ice
  });
  it('Mission 8: Apollo 11 Earth 59.6–71.7° (always up) vs Shackleton −7.31° to 6.15°', () => {
    expect(DATA.apollo11.earth_fraction).toBe(1);
    expect(DATA.apollo11.earth_elevation.min).toBeCloseTo(59.554, 3);
    expect(DATA.apollo11.earth_elevation.max).toBeCloseTo(71.661, 3);
    expect(DATA.sites.shackleton_ridge.raw.earth_elevation.min).toBeCloseTo(-7.308, 3);
    expect(DATA.sites.shackleton_ridge.raw.earth_elevation.max).toBeCloseTo(6.149, 3);
  });
});

describe('Mission 9: stars for a plan (rule of the API: battery = 60 W × longest night ÷ 0.8)', () => {
  it('each star has its rule', () => {
    const best = planStars('im2_athena', 1, 'large');
    expect(best).toMatchObject({ sun: true, call: true, battery: true, total: 3 });
    expect(planStars('im2_athena', 0, 'large')).toMatchObject({ sun: false, call: true, battery: true, total: 2 }); // 49 % of the time
    expect(planStars('im2_athena', 1, 'medium').battery).toBe(false); // needs about 26 kWh
    expect(planStars('shackleton_ridge', 0, 'small')).toMatchObject({ sun: true, call: false, battery: true, total: 2 }); // 14½ days without a call
    expect(planStars('malapert_m1', 0, 'large').battery).toBe(false); // the night is only a lower bound
    expect(planStars('malapert_m1', 1, 'large').battery).toBe(true);
    // IM-2 on 1 July misses the Sun star because Lumi waits about 6 days in the dark (API: 5.76 days).
    expect(DATA.plans.im2_athena[0].sun_spans_days[0][0]).toBeCloseTo(5.76, 2);
    expect(Math.round(planStars('im2_athena', 0, 'large').dark_wait_days)).toBe(6);
    expect(planStars('im2_athena', 1, 'large').dark_wait_days).toBeNull();
    // Landing on 11 July the night is a little shorter: about 26 kWh instead of Mission 3's about 27.
    expect(planStars('im2_athena', 1, 'large').shorter_night).toBe(true);
    expect(Math.round(planStars('im2_athena', 1, 'large').need_kwh)).toBe(26);
    expect(DATA.sites.im2_athena.kids.battery_kwh).toBe(27);
    expect(planStars('im2_athena', 0, 'large').shorter_night).toBe(false);
    expect(planStars('malapert_m1', 1, 'large').shorter_night).toBe(false); // 1 July night is only a lower bound
    expect(planStars('shackleton_ridge', 1, 'large').shorter_night).toBe(false);
  });
  it('the battery star follows the API need exactly', () => {
    const pm = DATA.about.power_model;
    for (const [id, plans] of Object.entries(DATA.plans)) {
      plans.forEach((p, i) => {
        expect(p.raw.battery_kwh, id).toBeCloseTo((pm.survival_w * p.raw.longest_night_h) / pm.dod / 1000, 2);
        for (const [k, kwh] of Object.entries(BATTERIES)) {
          expect(planStars(id, i, k).battery, `${id} ${i} ${k}`).toBe(kwh >= p.raw.battery_kwh && !p.raw.longest_night_lower_bound);
        }
      });
    }
  });
});

describe('Missions 5 and 7: the map games', () => {
  it('a landing lands at most 2 squares (200 m) away and inside the map', () => {
    let s = 1;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 500; i++) {
      const l = landingFrom(CENTRE, CENTRE, rng);
      expect(Math.abs(l.col - CENTRE)).toBeLessThanOrEqual(2);
      expect(Math.abs(l.row - CENTRE)).toBeLessThanOrEqual(2);
      const e = landingFrom(0, GRID_N - 1, rng);
      expect(e.col).toBeGreaterThanOrEqual(0); expect(e.row).toBeLessThanOrEqual(GRID_N - 1);
    }
    expect([targetStars(30), targetStars(22), targetStars(21), targetStars(15), targetStars(14), targetStars(0)]).toEqual([3, 3, 2, 2, 1, 1]);
  });
  it('ice hunt: dark square → 1 star, sunny next to dark → 3, sunny far away → 2', () => {
    const cells = gridCells('malapert_m1');
    const all = Object.values(cells);
    const dark = all.find((c) => c.days === 0);
    expect(iceResult(cells, dark.col, dark.row)).toEqual({ kind: 'dark', stars: 1 });
    const edge = all.find((c) => c.days > 0 && [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => (dr || dc) && cellAt(cells, c.col + dc, c.row + dr)?.days === 0)));
    expect(iceResult(cells, edge.col, edge.row)).toEqual({ kind: 'edge', stars: 3 });
    const far = all.find((c) => c.days > 0 && ![-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => (dr || dc) && cellAt(cells, c.col + dc, c.row + dr)?.days === 0)));
    expect(iceResult(cells, far.col, far.row)).toEqual({ kind: 'far', stars: 2 });
  });
  it('the map is playable by keyboard (arrows + Enter) and announces the result', () => {
    const src = readFileSync(new URL('./components/GridMap.jsx', import.meta.url), 'utf8');
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', "'Enter'"]) expect(src).toContain(k);
    expect(src).toMatch(/tabIndex=\{0\}/);
    for (const f of ['TargetMission.jsx', 'IceMission.jsx']) expect(readFileSync(new URL(`./missions/${f}`, import.meta.url), 'utf8')).toMatch(/aria-live="polite"|role="status"/);
  });
});

describe('progress: only on this device, saved and erased', () => {
  it('stars are saved, only go up, and can be erased', () => {
    const st = fakeStorage();
    let p = loadProgress(st);
    expect(p).toEqual({ v: 1, stars: {}, quiz: false });
    p = withStars(p, 'target', 2); saveProgress(p, st);
    p = withStars(p, 'target', 1); // a worse result does not replace a better one
    expect(p.stars.target).toBe(2);
    p = withQuizPassed(p); saveProgress(p, st);
    expect(loadProgress(st)).toEqual({ v: 1, stars: { target: 2 }, quiz: true });
    expect(Object.keys(st.dump())).toEqual([PROGRESS_KEY]);
    clearProgress(st);
    expect(st.dump()).toEqual({});
    expect(loadProgress(st)).toEqual({ v: 1, stars: {}, quiz: false });
  });
  it('only stars and the quiz flag are kept (nothing personal); broken or blocked storage is harmless', () => {
    expect(sanitize({ stars: { sun: 5, call: 'x', nope: 3, plan: 2 }, quiz: 'yes', name: 'Ana' })).toEqual({ v: 1, stars: { sun: 3, plan: 2 }, quiz: false });
    const broken = { getItem: () => '{not json', setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadProgress(broken)).toEqual({ v: 1, stars: {}, quiz: false });
    expect(() => saveProgress(EMPTY, broken)).not.toThrow();
    expect(() => clearProgress(broken)).not.toThrow();
  });
  it('phases open in order; certificates: Cadet with the quiz, the others when their phase is done', () => {
    expect(MISSIONS).toHaveLength(9);
    let p = { v: 1, stars: {}, quiz: false };
    expect([1, 2, 3].map((n) => phaseUnlocked(p, n))).toEqual([true, false, false]);
    for (const m of PHASES[0].missions) p = withStars(p, m, 1);
    expect(phaseComplete(p, 1)).toBe(true);
    expect(phaseUnlocked(p, 2)).toBe(true);
    expect(phaseUnlocked(p, 3)).toBe(false);
    expect(certificateReady(p, 1)).toBe(false);
    p = withQuizPassed(p);
    expect(certificateReady(p, 1)).toBe(true);
    for (const m of PHASES[1].missions) p = withStars(p, m, 2);
    expect(certificateReady(p, 2)).toBe(true);
    expect(certificateReady(p, 3)).toBe(false);
  });
});

describe('quiz and texts', () => {
  it('every question has exactly one right answer, the same in every language', () => {
    for (const [l, d] of Object.entries(LOCALES)) {
      for (const [i, q] of d.quiz.questions.entries()) {
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${l} ${i}`).toBe(true);
        expect(new Set(q.options).size, `${l} ${i}`).toBe(q.options.length); // no repeated option
        expect(q.answer).toBe(en.quiz.questions[i].answer);
      }
    }
  });
  it('the keys built in the code exist in all three languages', () => {
    const keys = [
      ...PHASES.map((p) => `phase.${p.key}`),
      ...['m4', 'm5', 'm6', 'm7', 'm8', 'm9'].map((m) => `${m}.title`),
      'm5.stars1', 'm5.stars2', 'm5.stars3', 'm7.result.dark', 'm7.result.edge', 'm7.result.far',
      'm9.site', 'm9.date', 'm9.battery', ...Object.keys(BATTERIES).map((k) => `m9.bat.${k}`),
      'cert.text1', 'cert.text2', 'cert.text3', 'cert.lockedPhase', 'cert.locked',
      'grid.east_m', 'grid.west_m', 'grid.north_m', 'grid.south_m', 'grid.atTarget',
    ];
    for (const l of Object.keys(LOCALES)) {
      const t = makeT(l);
      for (const k of keys) expect(t(k), `${l} ${k}`).not.toBe(k);
    }
  });
});
