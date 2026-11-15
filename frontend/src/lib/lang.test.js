// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlLang, initialLang, urlLang, withoutLangParam } from './i18n.js';

const loc = (search = '', hash = '') => ({ search, hash });

describe('starting language', () => {
  it('first visit is always English, whatever the browser language', () => {
    expect(initialLang(null, null)).toBe('en');
    expect(initialLang(undefined)).toBe('en');
    // the browser's language is not read at all
    expect(readFileSync(new URL('./i18n.js', import.meta.url), 'utf8')).not.toMatch(/navigator\.language/);
    expect(readFileSync(new URL('./store.jsx', import.meta.url), 'utf8')).not.toMatch(/navigator\.language|detectLang/);
  });
  it('a language chosen before (lunarnav.lang) is kept', () => {
    expect(initialLang('pt')).toBe('pt');
    expect(initialLang('es', null)).toBe('es');
    expect(initialLang('xx')).toBe('en'); // a broken saved value falls back to English
  });
  it('?lang= in the URL wins over the saved choice', () => {
    expect(initialLang('pt', 'es')).toBe('es');
    expect(initialLang(null, 'pt')).toBe('pt');
  });
});

describe('?lang= in the URL', () => {
  it('is read from the query string or from the hash query, case-insensitive', () => {
    expect(urlLang(loc('?lang=pt'))).toBe('pt');
    expect(urlLang(loc('', '#/planner?a=shackleton_ridge&lang=es'))).toBe('es');
    expect(urlLang(loc('?lang=EN'))).toBe('en');
    expect(urlLang(loc('?lang=pt', '#/help?lang=es'))).toBe('pt'); // query string first
  });
  it('anything other than en, es or pt is ignored', () => {
    expect(urlLang(loc('?lang=fr'))).toBe(null);
    expect(urlLang(loc('?lang='))).toBe(null);
    expect(urlLang(loc())).toBe(null);
    expect(urlLang(null)).toBe(null);
  });
  it('is removed from the URL after use (other parameters stay), so the selector choice survives a reload', () => {
    expect(withoutLangParam('https://lunarnav.space/?lang=pt')).toBe('https://lunarnav.space/');
    expect(withoutLangParam('https://lunarnav.space/?lang=pt#/sky?a=x&b=y')).toBe('https://lunarnav.space/#/sky?a=x&b=y');
    expect(withoutLangParam('https://lunarnav.space/#/planner?a=x&lang=es&days=30')).toBe('https://lunarnav.space/#/planner?a=x&days=30');
    expect(withoutLangParam('https://lunarnav.space/#/help?lang=es')).toBe('https://lunarnav.space/#/help');
  });
});

describe('<html lang>', () => {
  it('follows the language (pt-BR for Portuguese); the page starts in English', () => {
    expect(htmlLang('en')).toBe('en');
    expect(htmlLang('es')).toBe('es');
    expect(htmlLang('pt')).toBe('pt-BR');
    expect(readFileSync(new URL('../../index.html', import.meta.url), 'utf8')).toMatch(/<html lang="en">/);
  });
});
