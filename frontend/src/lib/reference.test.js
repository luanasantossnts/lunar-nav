// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeT } from './i18n.js';
import { LABEL_TERMS } from './glossary.js';
import { longTermLine, longTermSpread, showPsr } from './reference.js';

const file = (id) => JSON.parse(readFileSync(new URL(`../../../api/data/pgda/${id}.json`, import.meta.url), 'utf8'));
// The block the API builds from the file (ReferenceStore::longTerm), for display tests.
const block = (r) => ({
  available: true, sun_avg: r.sun.at_site, earth_avg: r.earth.at_site,
  sun_p10_p90_300m: [r.sun.within_300m.p10, r.sun.within_300m.p90], earth_p10_p90_300m: [r.earth.within_300m.p10, r.earth.within_300m.p90],
  psr_fraction_300m: r.psr.fraction_300m,
});

describe('long-term reference (NASA PGDA)', () => {
  it('every prepared site file carries product, version, resolution, period, criterion and citation', () => {
    for (const id of ['shackleton_ridge', 'im2_athena', 'malapert_m1', 'im1_odysseus', 'chandrayaan3']) {
      const r = file(id);
      expect(r.available).toBe(true);
      expect(r.product.version).toMatch(/V1\.05/);
      expect([60, 120, 240]).toContain(r.product.resolution_m);
      expect(r.product.period).toMatch(/18\.6/);
      expect(r.product.criterion.sun).toMatch(/any fraction of the solar disc/);
      expect(r.product.citation).toMatch(/Icarus 211/);
      expect(r.sun.at_site).toBeGreaterThanOrEqual(0);
      expect(r.sun.at_site).toBeLessThanOrEqual(1);
    }
  });

  it('shows the line in each language, and "—" when unavailable', () => {
    const lt = block(file('shackleton_ridge'));
    expect(longTermLine(makeT('en'), lt)).toBe(`Sun ${(lt.sun_avg * 100).toFixed(1)}\u00A0% · Earth ${(lt.earth_avg * 100).toFixed(1)}\u00A0%`);
    expect(longTermLine(makeT('pt'), lt)).toMatch(/^Sol .* · Terra /);
    expect(longTermLine(makeT('es'), lt)).toMatch(/^Sol .* · Tierra /);
    expect(longTermSpread(makeT('en'), lt)).toMatch(/^Sun \d+\.\d–\d+\.\d\u00A0% · Earth /);
    expect(longTermLine(makeT('en'), { available: false, reason: 'x' })).toBe('—');
  });

  it('shows permanent shadow only when there is some within 300 m', () => {
    expect(showPsr(block(file('malapert_m1')))).toBe(true);
    expect(showPsr(block(file('im2_athena')))).toBe(false);
  });

  it('the new labels link to their glossary terms', () => {
    expect(LABEL_TERMS['common.longTerm']).toBe('pgda-average');
    expect(LABEL_TERMS['common.psrNear']).toBe('psr');
  });
});
