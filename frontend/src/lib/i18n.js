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

export function detectLang() {
  const n = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  if (n.startsWith('pt')) return 'pt';
  if (n.startsWith('es')) return 'es';
  return 'en';
}
