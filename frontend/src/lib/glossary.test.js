// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';
import { LABEL_TERMS, TERMS } from './glossary.js';

const LOCALES = { en, es, pt };
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

describe('glossary anchors', () => {
  it.each(Object.keys(LOCALES))('every term exists in %s, with a title and a definition', (lang) => {
    const terms = LOCALES[lang].help.terms;
    expect(Object.keys(terms).sort()).toEqual([...TERMS].sort());
    TERMS.forEach((id) => {
      expect(terms[id].title, `${lang} ${id} title`).toBeTruthy();
      expect(terms[id].def, `${lang} ${id} def`).toBeTruthy();
    });
  });

  it('anchor ids are URL-safe', () => {
    TERMS.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it('every help page section exists in all languages', () => {
    Object.values(LOCALES).forEach((d) => {
      expect(d.help.faq).toHaveLength(5);
      expect(Object.keys(d.help.screens)).toEqual(['briefing', 'explorer', 'compare', 'sky', 'analyst', 'report', 'methodology', 'charts']);
    });
  });

  it('the Analyst glossary (api/data/glossary.json) matches the English Help text', () => {
    const g = JSON.parse(readFileSync(new URL('../../../api/data/glossary.json', import.meta.url), 'utf8'));
    expect(g.terms.map((x) => x.id).sort()).toEqual([...TERMS].sort());
    g.terms.forEach((x) => {
      expect(x.title).toBe(en.help.terms[x.id].title);
      expect(x.def).toBe(en.help.terms[x.id].def);
    });
  });
});

describe('"?" links', () => {
  it('every mapped label points to an existing term and is a real i18n key in all languages', () => {
    Object.entries(LABEL_TERMS).forEach(([k, term]) => {
      expect(TERMS, `${k} → ${term}`).toContain(term);
      Object.entries(LOCALES).forEach(([lang, d]) => expect(get(d, k), `${lang} ${k}`).toBeTypeOf('string'));
    });
  });

  const files = import.meta.glob('../**/*.jsx', { query: '?raw', import: 'default', eager: true });

  it('every literal "?" in the source points to a mapped label', () => {
    const used = [];
    Object.entries(files).forEach(([file, src]) => {
      for (const m of src.matchAll(/<(?:Label|HelpLink) k="([^"]+)"/g)) used.push([file, m[1]]);
    });
    expect(used.length).toBeGreaterThan(10);
    used.forEach(([file, k]) => expect(LABEL_TERMS[k], `${file}: ${k}`).toBeTruthy());
  });

  it('every mapped label is used in the source (rows and fields pass keys dynamically)', () => {
    const all = Object.values(files).join('\n');
    Object.keys(LABEL_TERMS).forEach((k) => expect(all.includes(`'${k}'`) || all.includes(`"${k}"`), k).toBe(true));
  });

  it('gaps without Earth and without contact link to their own term', () => {
    expect(LABEL_TERMS['common.longestEarthGap']).toBe('longest-gap');
    expect(LABEL_TERMS['common.longestCommGap']).toBe('longest-gap');
    Object.values(LOCALES).forEach((d) => expect(d.help.terms['longest-gap'].title).toBeTruthy());
  });

  it('an unmapped key renders no "?", so a link can never point to a missing term', async () => {
    const { termFor } = await import('./glossary.js');
    expect(termFor('common.never')).toBeNull();
  });
});
