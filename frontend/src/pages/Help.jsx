// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { TERMS, TERM_GROUPS, groupOf } from '../lib/glossary.js';

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

/** Where each persona's "Open →" goes (same order as help.who.people). */
const PERSONA_SCREENS = [['compare', '/compare'], ['sky', '/sky'], ['methodology', '/methodology']];

/** Sections of this page, in order (ids are also the table-of-contents targets). */
const SECTIONS = ['who', 'how', 'glossary', 'faq', 'refs'];
const sectionId = (k) => `help-${k}`;

/** Simple line icons (24 × 24, currentColor), one per screen. */
const ICON_PATHS = {
  briefing: 'M4 11 12 4l8 7M6 10v10h12V10',
  explorer: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4v2',
  compare: 'M5 20V10M10 20V5M15 20v-8M20 20V8M3 20h18',
  sky: 'M3 17h18M7 17a5 5 0 0 1 10 0M12 6v2M5.5 9.5 7 11M18.5 9.5 17 11',
  charts: 'M4 4v16h16M8 16v-5M12 16V8M16 16v-7',
  analyst: 'M4 5h16v11H9l-5 4V5ZM8 9h8M8 12h5',
  report: 'M6 3h9l4 4v14H6V3Zm9 0v4h4M9 12h7M9 16h7',
  methodology: 'M9 3h6M10 3v6l-5 10h14L14 9V3M7.5 15h9',
};
function ScreenIcon({ k }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted">
      <path d={ICON_PATHS[k]} />
    </svg>
  );
}

/** Disclosure arrow for <summary> (the flex summary hides the native marker); turns when open. */
const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted transition-transform motion-reduce:transition-none group-open:rotate-90">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

/** The ?term= parameter of the current hash, if any. */
const hashTerm = () => new URLSearchParams((location.hash.split('?')[1]) || '').get('term');

/** Scrolls to a section of this page (the app uses the hash for routing, so no #id links). */
const scrollToSection = (k) => {
  const el = document.getElementById(sectionId(k));
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  el.focus({ preventScroll: true });
};

/** Table of contents: a sticky column on desktop, a row of buttons that scrolls sideways on phones. */
function Toc({ current, vertical, onJump }) {
  const { t } = useApp();
  return (
    <nav aria-label={t('help.toc.title')} className={vertical ? 'flex flex-col gap-0.5' : 'flex gap-2 overflow-x-auto pb-1 -mx-1 px-1'}>
      {vertical && <p className="m-0 mb-2 text-[13px] font-semibold text-muted">{t('help.toc.title')}</p>}
      {SECTIONS.map((k) => {
        const on = current === k;
        return (
          <a key={k} href={`#/help?section=${k}`} aria-current={on ? 'location' : undefined}
            onClick={(e) => { e.preventDefault(); onJump(k); }}
            className={vertical
              ? `tap flex items-center min-h-[36px] pl-3 border-l-2 no-underline text-[14px] ${on ? 'border-ink text-ink font-medium' : 'border-line text-text2 hover:text-ink'}`
              : `tap shrink-0 inline-flex items-center min-h-[40px] px-3.5 border no-underline text-[13px] whitespace-nowrap ${on ? 'border-ink bg-raise text-ink font-medium' : 'border-line text-text2'}`}>
            {t(`help.toc.${k}`)}
          </a>
        );
      })}
    </nav>
  );
}

export default function Help() {
  const { t, lang, go, goWith } = useApp();
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(hashTerm);
  const [current, setCurrent] = useState('who');
  const [openGroups, setOpenGroups] = useState(() => new Set(hashTerm() ? [groupOf(hashTerm())] : []));

  useEffect(() => {
    const on = () => setActive(hashTerm());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // A "?" link opens the term's group, then scrolls to it.
  useEffect(() => {
    if (!active) return;
    setFilter('');
    setOpenGroups((s) => new Set([...s, groupOf(active)]));
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`term-${active}`)?.scrollIntoView({ block: 'center' })));
  }, [active]);
  // Highlight the section being read: the last one whose top has passed the reading line (30 % of
  // the window). IntersectionObserver tells when a section crosses the window; the choice is made from
  // the positions. A click in the table of contents holds its section while the page scrolls there.
  const hold = useRef(0);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const pick = () => {
      if (Date.now() < hold.current) return;
      const line = window.innerHeight * 0.3;
      let cur = SECTIONS[0];
      SECTIONS.forEach((k) => { const el = document.getElementById(sectionId(k)); if (el && el.getBoundingClientRect().top <= line) cur = k; });
      setCurrent(cur);
    };
    const io = new IntersectionObserver(pick, { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '0px 0px -70% 0px' });
    SECTIONS.forEach((k) => { const el = document.getElementById(sectionId(k)); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  const jump = (k) => { hold.current = Date.now() + 1200; setCurrent(k); scrollToSection(k); };

  const terms = useMemo(() => TERMS
    .map((id) => ({ id, ...t(`help.terms.${id}`) }))
    .sort((a, b) => a.title.localeCompare(b.title, lang, { sensitivity: 'base' })), [t, lang]);
  const q = filter.trim().toLowerCase();
  const shown = q ? terms.filter((x) => `${x.title} ${x.def} ${x.example || ''}`.toLowerCase().includes(q)) : terms;
  // While filtering, the groups with results are open (and the others hidden).
  const groups = TERM_GROUPS.map(([key, ids]) => [key, shown.filter((x) => ids.includes(x.id))]).filter(([, list]) => !q || list.length > 0);
  const isOpen = (key) => (q ? true : openGroups.has(key));
  const toggle = (key, open) => {
    if (q) return;
    setOpenGroups((s) => { const n = new Set(s); if (open) n.add(key); else n.delete(key); return n; });
  };

  const sectionTitle = 'm-0 text-[13px] font-semibold text-muted';
  const openLink = (route, name) => (
    <a href={`#${route}`} onClick={(e) => { e.preventDefault(); go(route); }} aria-label={`${t('help.open')}: ${name}`} className="tap inline-flex items-center text-[13px]">{t('help.open')} →</a>
  );

  return (
    <div className="w-full max-w-[1180px] mx-auto px-6 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-12">
      <div className="min-w-0 flex flex-col gap-10">
        <div>
          <h1 className="m-0 text-[32px] font-semibold tracking-tight">{t('help.title')}</h1>
          <p className="m-0 mt-2.5 text-base leading-relaxed text-text2 max-w-[70ch]">{t('help.intro')}</p>
          <div className="mt-5 lg:hidden"><Toc current={current} onJump={jump} /></div>
        </div>

        {/* Start here: three steps and the guided tour. */}
        <section aria-labelledby="help-start-title" className="border border-line bg-bg2 p-5 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1 min-w-0">
            <h2 id="help-start-title" className="m-0 text-[15px] font-semibold">{t('help.start.title')}</h2>
            <ol className="m-0 mt-3 p-0 list-none grid grid-cols-1 sm:grid-cols-3 gap-3">
              {t('help.start.steps').map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span aria-hidden="true" className="shrink-0 w-7 h-7 grid place-items-center border border-line2 font-mono text-[13px] text-ink">{i + 1}</span>
                  <span className="flex flex-col gap-0.5"><span className="font-medium text-[14px]">{title}</span><span className="text-[13px] leading-snug text-text2">{text}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <button type="button" className="btn btn-primary text-[13px] self-start md:self-center shrink-0" onClick={() => go('/tour/1')}>{t('help.tour')}</button>
        </section>

        {/* Who it's for: three fictional people (labelled as such), one problem and one remedy each. */}
        <section id={sectionId('who')} tabIndex={-1} aria-labelledby="who-title" className="scroll-mt-6 focus:outline-none">
          <h2 id="who-title" className={sectionTitle}>{t('help.who.title')}</h2>
          <p className="m-0 mt-1 mb-3 text-xs text-dim">{t('help.who.note')}</p>
          <ul className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-3 gap-3">
            {t('help.who.people').map(([who, pain, fix], i) => (
              <li key={who} className="border border-line bg-bg2 p-4 flex flex-col gap-2">
                <span className="font-medium">{who}</span>
                <p className="m-0 text-sm leading-relaxed text-text2"><span className="text-muted">{t('help.who.painLabel')}: </span>{pain}</p>
                <p className="m-0 text-sm leading-relaxed text-text2"><span className="text-muted">{t('help.who.fixLabel')}: </span>{fix}</p>
                <span className="mt-auto pt-1">{openLink(PERSONA_SCREENS[i][1], t(`help.screens.${PERSONA_SCREENS[i][0]}.title`))}</span>
              </li>
            ))}
          </ul>
          <h3 className="m-0 mt-5 text-[15px] font-semibold">{t('help.who.answersTitle')}</h3>
          <p className="m-0 mt-1.5 text-[15px] leading-relaxed text-text2 max-w-[70ch]">{t('help.who.answers')}</p>
        </section>

        <section id={sectionId('how')} tabIndex={-1} aria-labelledby="how-title" className="scroll-mt-6 focus:outline-none">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
            <h2 id="how-title" className={sectionTitle}>1 · {t('help.howTitle')}</h2>
            <button type="button" className="btn btn-primary text-[13px]" onClick={() => go('/tour/1')}>{t('help.tour')}</button>
          </div>
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {SCREENS.map(([k, route]) => (
              <li key={k} className="border border-line bg-bg2 p-4 flex flex-col gap-2">
                <span className="flex items-center gap-2.5"><ScreenIcon k={k} /><span className="font-medium">{t(`help.screens.${k}.title`)}</span></span>
                <span className="text-[14px] leading-relaxed text-text2">{t(`help.screens.${k}.text`)}</span>
                <span className="mt-auto pt-1">{openLink(route, t(`help.screens.${k}.title`))}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id={sectionId('glossary')} tabIndex={-1} aria-labelledby="glossary-title" className="scroll-mt-6 focus:outline-none">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
            <h2 id="glossary-title" className={sectionTitle}>2 · {t('help.glossaryTitle')}</h2>
            <label className="flex items-center gap-2 text-[13px]">
              <span className="sr-only">{t('help.filter')}</span>
              <input type="search" className="field w-56" placeholder={t('help.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
            </label>
          </div>
          {shown.length === 0 && <p className="m-0 text-sm text-muted">{t('help.noMatch')}</p>}
          <div className="border-t border-line2">
            {groups.map(([key, list]) => (
              <details key={key} open={isOpen(key)} onToggle={(e) => toggle(key, e.currentTarget.open)} className="border-b border-hair group">
                <summary className="tap cursor-pointer min-h-[44px] flex items-center justify-between gap-3 py-2 font-medium list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><Chevron />{t(`help.groups.${key}`)}</span>
                  <span className="font-mono text-xs text-dim">{list.length}</span>
                </summary>
                <dl className="m-0 pb-2">
                  {list.map((x) => (
                    <div key={x.id} id={`term-${x.id}`} className={`py-3 border-t border-hair scroll-mt-24 ${active === x.id ? 'bg-raise -mx-3 px-3' : ''}`}>
                      <dt className="font-medium">
                        <a href={`#/help?term=${x.id}`} onClick={(e) => { e.preventDefault(); goWith('/help', { term: x.id }); }} className="tap inline-flex items-center no-underline text-ink">{x.title}</a>
                      </dt>
                      <dd className="m-0 mt-1 max-w-[70ch] text-[15px] leading-relaxed text-text2">
                        {x.def}
                        {x.example && (
                          <span className="block mt-2 px-3 py-2 border-l-2 border-line2 bg-bg2 text-[13px] text-text2">
                            <span className="font-medium text-muted">{t('help.example')}:</span> {x.example}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
          </div>
        </section>

        <section id={sectionId('faq')} tabIndex={-1} aria-labelledby="faq-title" className="scroll-mt-6 focus:outline-none">
          <h2 id="faq-title" className={`${sectionTitle} mb-3`}>3 · {t('help.faqTitle')}</h2>
          <div className="border-t border-line2">
            {t('help.faq').map(([qq, a], i) => (
              <details key={qq} className="border-b border-hair group">
                <summary className="tap cursor-pointer min-h-[44px] flex items-center gap-2 py-2 font-medium max-w-[70ch] list-none [&::-webkit-details-marker]:hidden"><Chevron /><span>{qq}</span></summary>
                <p className="m-0 pb-3 max-w-[70ch] text-[15px] leading-relaxed text-text2">
                  {a}
                  {i === 4 && <> <a href="#/methodology" onClick={(e) => { e.preventDefault(); go('/methodology'); }}>{t('help.faqMethod')} →</a></>}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section id={sectionId('refs')} tabIndex={-1} aria-labelledby="refs-title" className="scroll-mt-6 focus:outline-none">
          <h2 id="refs-title" className={`${sectionTitle} mb-3`}>4 · {t('help.refsTitle')}</h2>
          <p className="m-0 max-w-[70ch] text-[15px] leading-relaxed text-text2">
            {t('help.refsText')}{' '}
            <a href="#/methodology?section=sources" onClick={(e) => { e.preventDefault(); goWith('/methodology', { section: 'sources' }); }}>{t('help.refsLink')}</a>
          </p>
        </section>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-6"><Toc current={current} vertical onJump={jump} /></div>
      </aside>
    </div>
  );
}
