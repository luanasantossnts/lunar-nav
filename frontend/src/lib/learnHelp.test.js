// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';
import { makeT } from './i18n.js';
import { localSiteName, shortSiteName } from './siteNames.js';
import { TERMS, TERM_GROUPS, groupOf } from './glossary.js';

const LOCALES = { en, es, pt };
const SITES = JSON.parse(readFileSync(new URL('../../../api/data/sites.json', import.meta.url), 'utf8')).sites;

describe('site names in the reader\'s language', () => {
  it('English names equal api/data/sites.json; every site has a name in every language', () => {
    SITES.forEach((s) => expect(en.siteNames[s.id], s.id).toBe(s.name));
    for (const d of Object.values(LOCALES)) expect(Object.keys(d.siteNames).sort()).toEqual(SITES.map((s) => s.id).sort());
  });
  it('proper names stay; descriptions are translated', () => {
    expect(pt.siteNames.shackleton_ridge).toBe('Borda de Shackleton na crista de Gerlache');
    expect(pt.siteNames.im2_athena).toBe('IM-2 Athena, região do Mons Mouton');
    expect(es.siteNames.im2_athena).toBe('IM-2 Athena, región del Mons Mouton');
    for (const d of Object.values(LOCALES)) {
      expect(d.siteNames.im2_athena).toContain('IM-2 Athena');
      expect(d.siteNames.malapert_m1).toContain('Malapert');
      expect(d.siteNames.chandrayaan3).toContain('Statio Shiv Shakti');
    }
  });
  it('a custom point keeps its own name; ids and unknown ids pass through', () => {
    const t = makeT('pt');
    expect(localSiteName(t, { id: 'custom', name: 'Personalizado 85.00°, 30.00°E' })).toBe('Personalizado 85.00°, 30.00°E');
    expect(localSiteName(t, 'im2_athena')).toBe('IM-2 Athena, região do Mons Mouton');
    expect(localSiteName(t, 'nowhere', [])).toBe('nowhere');
  });
  it('short labels cut at the comma or the connector in each language', () => {
    expect(shortSiteName(en.siteNames.shackleton_ridge)).toBe('Shackleton rim');
    expect(shortSiteName(pt.siteNames.shackleton_ridge)).toBe('Borda de Shackleton');
    expect(shortSiteName(es.siteNames.shackleton_ridge)).toBe('Borde de Shackleton');
    expect(shortSiteName(pt.siteNames.im2_athena)).toBe('IM-2 Athena');
  });
  it('the Analyst scenario and suggested questions do not use translated names (cache keys unchanged)', () => {
    const analyst = readFileSync(new URL('../pages/Analyst.jsx', import.meta.url), 'utf8');
    expect(analyst).toMatch(/const scenario = \{ a: siteA, b: siteB,/);
    expect(analyst).toMatch(/mode: analystLevel === 'learn' \? 'learn' : 'technical'/);
  });
});

describe('Technical / Learn', () => {
  it('mode notice, Analyst level and the new Learn notes exist in every language', () => {
    for (const [l, d] of Object.entries(LOCALES)) {
      expect(d.top.modeNotice.learn, l).toBeTruthy();
      expect(d.top.modeNotice.technical, l).toBeTruthy();
      for (const k of ['levelTechnical', 'levelClassroom', 'levelFollows']) expect(d.analyst[k], `${l} ${k}`).toBeTruthy();
      for (const k of ['delay', 'spread', 'charts', 'seasons']) expect(d.learn[k], `${l} ${k}`).toBeTruthy();
    }
  });
});

describe('Help layout', () => {
  it('every glossary term is in exactly one theme group', () => {
    const all = TERM_GROUPS.flatMap(([, ids]) => ids);
    expect(all.slice().sort()).toEqual([...TERMS].sort());
    expect(new Set(all).size).toBe(all.length);
    expect(groupOf('dsn')).toBe('comm');
    expect(groupOf('p10-p90')).toBe('uncertainty');
  });
  it('table of contents, "Start here" and group titles exist in every language', () => {
    for (const [l, d] of Object.entries(LOCALES)) {
      for (const k of ['title', 'who', 'how', 'glossary', 'faq', 'refs']) expect(d.help.toc[k], `${l} ${k}`).toBeTruthy();
      expect(d.help.start.steps, l).toHaveLength(3);
      TERM_GROUPS.forEach(([k]) => expect(d.help.groups[k], `${l} ${k}`).toBeTruthy());
    }
  });
});

describe('Help text checked against the API (default scenario, terrain)', () => {
  it('longest gap without Earth at Shackleton: 347.37 h (≈ 14.5 days), not "12 days"', () => {
    expect(en.help.terms['longest-gap'].example).toContain('14.5 days');
    expect(en.help.terms['longest-gap'].example).toContain('347.4 h');
    expect(pt.help.terms['longest-gap'].example).toContain('14,5 dias');
    expect(es.help.terms['longest-gap'].example).toContain('14,5 días');
    for (const d of Object.values(LOCALES)) expect(d.help.terms['longest-gap'].example).not.toMatch(/\b12 (days|dias|días)/);
  });
  it('PT says "locais", not "sites", in the Charts description', () => {
    expect(pt.help.screens.charts.text).not.toMatch(/\bsites?\b/);
  });
});
