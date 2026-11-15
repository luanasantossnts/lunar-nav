// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import en from '../locales/en.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';

export const LANGS = { en, es, pt };
export const LANG_LABEL = { en: 'EN', es: 'ES', pt: 'PT' };

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Translator for a language, falling back to English, with {var} interpolation. */
export function makeT(lang) {
  const dict = LANGS[lang] || en;
  return (key, vars) => {
    let v = get(dict, key);
    if (v === undefined) v = get(en, key);
    if (v === undefined) return key;
    if (typeof v === 'string' && vars) {
      v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
    }
    return v;
  };
}

export const LANG_CODES = ['en', 'es', 'pt'];

/**
 * Language asked for in the URL: ?lang=en|es|pt in the query string (https://lunarnav.space/?lang=pt)
 * or in the hash query (#/planner?lang=es). Anything else → null.
 */
export function urlLang(loc = typeof location !== 'undefined' ? location : null) {
  if (!loc) return null;
  const fromSearch = new URLSearchParams(loc.search || '').get('lang');
  const fromHash = new URLSearchParams(String(loc.hash || '').split('?')[1] || '').get('lang');
  const v = String(fromSearch || fromHash || '').toLowerCase();
  return LANG_CODES.includes(v) ? v : null;
}

/**
 * Starting language: the URL's ?lang= first (it is then saved), else the language the person chose
 * before (lunarnav.lang), else English. The browser's own language is not used: the first visit
 * is always in English.
 */
export function initialLang(saved, fromUrl = null) {
  if (LANG_CODES.includes(fromUrl)) return fromUrl;
  if (LANG_CODES.includes(saved)) return saved;
  return 'en';
}

/** The URL without its ?lang= (query string and hash query), so a reload keeps the saved choice. */
export function withoutLangParam(href) {
  const u = new URL(href);
  u.searchParams.delete('lang');
  const [path, query = ''] = u.hash.replace(/^#/, '').split('?');
  if (query) {
    const q = new URLSearchParams(query);
    q.delete('lang');
    const rest = q.toString();
    u.hash = rest ? `${path}?${rest}` : path;
  }
  return u.toString();
}

/** Value for <html lang>. */
export const htmlLang = (lang) => (lang === 'pt' ? 'pt-BR' : LANG_CODES.includes(lang) ? lang : 'en');
