// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';
import { coord, hrs, num, pct, plain, setNumberLang, signed, withPoint } from './format.js';
import { localNumber, localParams, localPercents } from './validationText.js';
import { makeT } from './i18n.js';

const LOCALES = { en, es, pt };
const NB = ' ';
afterEach(() => setNumberLang('en'));

describe('decimal separator follows the language', () => {
  it('English keeps "."; Portuguese and Spanish use ","', () => {
    setNumberLang('en');
    expect(pct(0.9976)).toBe(`99.8${NB}%`);
    for (const l of ['pt', 'es']) {
      setNumberLang(l);
      expect(pct(0.9976)).toBe(`99,8${NB}%`);
      expect(hrs(250.79)).toBe(`250,8${NB}h`);
      expect(num(27.251, 2, 'kWh')).toBe(`27,25${NB}kWh`);
      expect(num(140616.9, 1)).toBe('140 616,9');
      expect(signed(-5.6, 1, '')).toBe('−5,6');
      expect(coord(-89.684, 196.739)).toBe('89,68°S 196,74°E');
      expect(plain(0.8)).toBe('0,8');
    }
  });
  it('CSV exports keep "." in every language', () => {
    setNumberLang('pt');
    expect(withPoint(() => pct(0.9976))).toBe(`99.8${NB}%`);
    expect(pct(0.9976)).toBe(`99,8${NB}%`); // restored afterwards
  });
});

describe('validation results are formatted on screen', () => {
  const pgda = { key: 'pgda', params: { year: '2030', same: 'yes', max40: '10.7', list: 'raw' }, detail: { rows: [{ site: 'malapert_m1', delta_points: { sun: -10.7 } }, { site: 'shackleton_ridge', delta_points: { sun: 9.3 } }] } };
  it('stored numbers keep their decimals, with a true minus sign', () => {
    setNumberLang('pt');
    expect(localNumber('99.1')).toBe('99,1');
    expect(localNumber('-8.3')).toBe('−8,3');
    expect(localNumber('+9.3')).toBe('+9,3');
    expect(localNumber('0.005')).toBe('0,005');
    expect(localPercents('DSS-14 43.1% · DSS-43 40.9%')).toBe(`DSS-14 43,1${NB}% · DSS-43 40,9${NB}%`);
  });
  it('the PGDA list is rebuilt from the rows, with site names', () => {
    setNumberLang('es');
    const t = makeT('es');
    const p = localParams(pgda, (id) => ({ malapert_m1: 'Malapert', shackleton_ridge: 'Shackleton' }[id]), t);
    expect(p.list).toBe('Malapert −10,7 · Shackleton +9,3');
    expect(p.max40).toBe('10,7');
    expect(p.same).toBe(t('method.pgda.yes'));
  });
  it('the DEM resolution check has a name and a result in every language', () => {
    for (const [l, d] of Object.entries(LOCALES)) {
      expect(d.validation.names.dem_resolution, l).toContain('{site}');
      for (const k of ['sun40', 'sun60', 'delta', 'earth40', 'earth60']) expect(d.validation.results.dem_resolution, `${l} ${k}`).toContain(`{${k}}`);
      expect(d.validation.status.informative, l).toBeTruthy();
    }
  });
  it('validation.json carries the 60 m check, and the Known limits text quotes its values', () => {
    const v = JSON.parse(readFileSync(new URL('../../../api/data/validation.json', import.meta.url), 'utf8'));
    const c = v.checks.find((x) => x.key === 'dem_resolution');
    expect(c.status).toBe('informative');
    expect(c.detail.dem60.product).toMatch(/LDEM_75S_60M/);
    expect(en.method.limits.join(' ')).toContain(`${c.params.sun40}${NB}% with LOLA 40${NB}m/px vs ${c.params.sun60}${NB}%`);
    const comma = (s) => s.replace('.', ',');
    expect(pt.method.limits.join(' ')).toContain(`${comma(c.params.sun40)}${NB}% com LOLA 40${NB}m/px contra ${comma(c.params.sun60)}${NB}%`);
    for (const d of Object.values(LOCALES)) expect(d.method.limits.join(' ')).not.toMatch(/29[.,]8/);
  });
});

describe('labels in every language', () => {
  it('provenance, panorama axes and the off-map note exist in all languages', () => {
    for (const [l, d] of Object.entries(LOCALES)) {
      for (const k of ['source', 'method', 'bodies', 'ephemeris', 'nights', 'horizon', 'visibility', 'margins', 'DSN', 'dsnCoords', 'power', 'powerModel', 'computed']) expect(d.prov.labels[k], `${l} ${k}`).toBeTruthy();
      expect(Object.keys(d.sky.axis), l).toEqual(['n', 'e', 's', 'w']);
      expect(d.planner.outsideMap, l).toContain('{list}');
    }
    expect([pt.sky.axis.e, pt.sky.axis.w]).toEqual(['L', 'O']);
    expect([es.sky.axis.e, es.sky.axis.w]).toEqual(['E', 'O']);
  });
  it('"Who it\'s for": three fictional people, marked as such, in every language', () => {
    for (const [l, d] of Object.entries(LOCALES)) {
      expect(d.help.who.people, l).toHaveLength(3);
      d.help.who.people.forEach((p) => expect(p, l).toHaveLength(3));
      expect(d.help.who.note, l).toMatch(/fictional|fictícios|ficticios/);
    }
  });
});

describe('no-break space before units in the locale files', () => {
  it('no plain space between a number and %, m, min, W, h, km, kWh', () => {
    const units = /(\d|\})[ ](%|min|kWh|Wh|km|kg|m|W|h)(?![A-Za-zÀ-ÿ])|(\d|\})%/;
    const walk = (o, path, out) => {
      // The Analyst suggested questions are cache keys (api/data/suggested.json): kept as they are.
      if (/^\w+\.analyst\.ex[123]$/.test(path)) return out;
      if (typeof o === 'string') { if (units.test(o)) out.push(`${path}: ${o.slice(0, 60)}`); } else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, `${path}.${k}`, out));
      return out;
    };
    for (const [l, d] of Object.entries(LOCALES)) expect(walk(d, l, []), l).toEqual([]);
  });
  it('the Sun elevation range in Help is the measured one (two decimals)', () => {
    expect(en.help.terms.elevation.example).toContain('0.58° and 1.53°');
    expect(pt.help.terms.elevation.example).toContain('0,58° e 1,53°');
    expect(es.help.terms.elevation.example).toContain('0,58° y 1,53°');
  });
});
