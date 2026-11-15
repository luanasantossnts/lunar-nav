// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { termFor } from '../lib/glossary.js';

/** Discreet 16 px "?" next to a metric label (i18n key k); opens its glossary entry in Help. */
export default function HelpLink({ k }) {
  const { t, goWith } = useApp();
  const term = termFor(k);
  if (!term) return null;
  return (
    <a href={`#/help?term=${term}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); goWith('/help', { term }); }}
      aria-label={t('common.whatIs', { term: t(`help.terms.${term}.title`) })} title={t(`help.terms.${term}.title`)}
      data-hit="44" className="hit44 no-print inline-flex items-center justify-center w-4 h-4 ml-1 align-[-2px] rounded-full border border-line2 text-[10px] leading-none text-dim no-underline hover:text-ink hover:border-ink">
      ?
    </a>
  );
}

/**
 * A label with its "?" link: <Label k="common.sunlight" />. The last word and the "?"
 * sit in one non-breaking run, so the icon never wraps onto a line of its own.
 */
export function Label({ k, vars }) {
  const { t } = useApp();
  const text = String(t(k, vars));
  const cut = text.lastIndexOf(' ');
  const head = cut >= 0 ? text.slice(0, cut + 1) : '';
  const last = cut >= 0 ? text.slice(cut + 1) : text;
  return <>{head}<span className="whitespace-nowrap">{last}<HelpLink k={k} /></span></>;
}
