// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Language, as in the main Lunar Nav app: the first visit is in English; a choice in the selector
 * is remembered (localStorage "lunarnav.lang" — the only thing this site stores); ?lang=en|es|pt in
 * a link wins, is saved, and is then removed from the address.
 */
import en from '../locales/en.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';

export const LOCALES = { en, es, pt };
export const LANG_CODES = ['en', 'es', 'pt'];
export const STORAGE_KEY = 'lunarnav.lang';

/** ?lang= from the query string or the hash query; anything else → null. */
export function urlLang(loc = typeof location !== 'undefined' ? location : null) {
  if (!loc) return null;
  const a = new URLSearchParams(loc.search || '').get('lang');
  const b = new URLSearchParams(String(loc.hash || '').split('?')[1] || '').get('lang');
  const v = String(a || b || '').toLowerCase();
  return LANG_CODES.includes(v) ? v : null;
}

/** URL first, then the saved choice, then English (never the browser's language). */
export function initialLang(saved, fromUrl = null) {
  if (LANG_CODES.includes(fromUrl)) return fromUrl;
  if (LANG_CODES.includes(saved)) return saved;
  return 'en';
}

/** The address without ?lang= (query string and hash query). */
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

export const htmlLang = (lang) => (lang === 'pt' ? 'pt-BR' : LANG_CODES.includes(lang) ? lang : 'en');

/** Saved language, or null; storage may be blocked (private mode). */
export function savedLang() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
export function saveLang(lang) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lang)); } catch { /* blocked */ }
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Translator with {var} interpolation; falls back to English. */
export function makeT(lang) {
  const dict = LOCALES[lang] || en;
  return (key, vars) => {
    let v = get(dict, key);
    if (v === undefined) v = get(en, key);
    if (v === undefined) return key;
    if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
    return v;
  };
}

/** Numbers for children: "14½" for halves, decimal comma in Spanish and Portuguese otherwise. */
export function kidNumber(v, lang) {
  if (v === null || v === undefined) return '—';
  const whole = Math.floor(v);
  if (Math.abs(v - whole - 0.5) < 1e-9) return whole === 0 ? '½' : `${whole}½`;
  const s = (Number.isInteger(v) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const out = lang === 'en' ? s : s.replace('.', ',');
  return v < 0 ? `\u2212${out}` : out;
}
