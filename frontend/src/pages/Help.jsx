// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { TERMS } from '../lib/glossary.js';

const SCREENS = [
  ['briefing', '/'],
  ['explorer', '/planner'],
  ['compare', '/compare'],
  ['sky', '/sky'],
  ['charts', '/charts'],
  ['analyst', '/analyst'],
  ['report', '/report'],
  ['methodology', '/methodology'],
];

/** The ?term= parameter of the current hash, if any. */
const hashTerm = () => new URLSearchParams((location.hash.split('?')[1]) || '').get('term');

export default function Help() {
  const { t, lang, go, goWith } = useApp();
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(hashTerm);

  useEffect(() => {
    const on = () => setActive(hashTerm());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (!active) return;
    setFilter('');
    requestAnimationFrame(() => document.getElementById(`term-${active}`)?.scrollIntoView({ block: 'center' }));
  }, [active]);

  const terms = useMemo(() => TERMS
    .map((id) => ({ id, ...t(`help.terms.${id}`) }))
    .sort((a, b) => a.title.localeCompare(b.title, lang, { sensitivity: 'base' })), [t, lang]);
  const q = filter.trim().toLowerCase();
  const shown = q ? terms.filter((x) => `${x.title} ${x.def} ${x.example || ''}`.toLowerCase().includes(q)) : terms;

  return (
    <div className="w-full max-w-[980px] mx-auto px-6 py-10 flex flex-col gap-10">
      <div>
        <h1 className="m-0 text-[32px] font-semibold tracking-tight">{t('help.title')}</h1>
        <p className="m-0 mt-2.5 text-base leading-relaxed text-text2 max-w-[70ch]">{t('help.intro')}</p>
      </div>

      {/* Who it's for: three fictional people (labelled as such), one problem and one remedy each. */}
      <section aria-labelledby="who-title">
        <h2 id="who-title" className="m-0 text-[13px] font-semibold text-muted">{t('help.who.title')}</h2>
        <p className="m-0 mt-1 mb-3 text-xs text-dim">{t('help.who.note')}</p>
        <ul className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-3 gap-3">
          {t('help.who.people').map(([who, pain, fix]) => (
            <li key={who} className="border border-line bg-bg2 p-4 flex flex-col gap-2">
              <span className="font-medium">{who}</span>
              <p className="m-0 text-sm leading-relaxed text-text2"><span className="text-muted">{t('help.who.painLabel')}: </span>{pain}</p>
              <p className="m-0 text-sm leading-relaxed text-text2"><span className="text-muted">{t('help.who.fixLabel')}: </span>{fix}</p>
            </li>
          ))}
        </ul>
        <h3 className="m-0 mt-5 text-[15px] font-semibold">{t('help.who.answersTitle')}</h3>
        <p className="m-0 mt-1.5 text-[15px] leading-relaxed text-text2 max-w-[70ch]">{t('help.who.answers')}</p>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
          <h2 className="m-0 text-[13px] font-semibold text-muted">1 · {t('help.howTitle')}</h2>
          <button type="button" className="btn btn-primary text-[13px]" onClick={() => go('/tour/1')}>{t('help.tour')}</button>
        </div>
        <ul className="m-0 p-0 list-none border-t border-line2">
          {SCREENS.map(([k, route]) => (
            <li key={k} className="py-3 border-b border-hair flex flex-wrap gap-x-6 gap-y-1 items-baseline">
              <span className="w-[140px] font-medium">{t(`help.screens.${k}.title`)}</span>
              <span className="flex-1 min-w-[240px] max-w-[70ch] text-[15px] leading-relaxed text-text2">{t(`help.screens.${k}.text`)}</span>
              <a href={`#${route}`} onClick={(e) => { e.preventDefault(); go(route); }} className="text-[13px]">{t('help.open')} →</a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="glossary-title">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
          <h2 id="glossary-title" className="m-0 text-[13px] font-semibold text-muted">2 · {t('help.glossaryTitle')}</h2>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="sr-only">{t('help.filter')}</span>
            <input type="search" className="field w-56" placeholder={t('help.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
        </div>
        {shown.length === 0 && <p className="m-0 text-sm text-muted">{t('help.noMatch')}</p>}
        <dl className="m-0 border-t border-line2">
          {shown.map((x) => (
            <div key={x.id} id={`term-${x.id}`} className={`py-3 border-b border-hair scroll-mt-24 ${active === x.id ? 'bg-raise -mx-3 px-3' : ''}`}>
              <dt className="font-medium">
                <a href={`#/help?term=${x.id}`} onClick={(e) => { e.preventDefault(); goWith('/help', { term: x.id }); }} className="tap inline-flex items-center no-underline text-ink">{x.title}</a>
              </dt>
              <dd className="m-0 mt-1 max-w-[70ch] text-[15px] leading-relaxed text-text2">
                {x.def}
                {x.example && <span className="block mt-1 text-[13px] text-muted"><span className="text-dim">{t('help.example')}:</span> {x.example}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">3 · {t('help.faqTitle')}</h2>
        <dl className="m-0 border-t border-line2">
          {t('help.faq').map(([qq, a], i) => (
            <div key={qq} className="py-3 border-b border-hair">
              <dt className="font-medium max-w-[70ch]">{qq}</dt>
              <dd className="m-0 mt-1 max-w-[70ch] text-[15px] leading-relaxed text-text2">
                {a}
                {i === 4 && <> <a href="#/methodology" onClick={(e) => { e.preventDefault(); go('/methodology'); }}>{t('help.faqMethod')} →</a></>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">4 · {t('help.refsTitle')}</h2>
        <p className="m-0 max-w-[70ch] text-[15px] leading-relaxed text-text2">
          {t('help.refsText')}{' '}
          <a href="#/methodology?section=sources" onClick={(e) => { e.preventDefault(); goWith('/methodology', { section: 'sources' }); }}>{t('help.refsLink')}</a>
        </p>
      </section>
    </div>
  );
}
