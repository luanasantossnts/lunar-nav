// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useKids } from '../App.jsx';
import { LANG_CODES } from '../lib/lang.js';

/** Small logo: the mascot's helmet. */
function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="22" fill="#e9e6ff" />
      <rect x="17" y="23" width="30" height="18" rx="9" fill="#1d2a6b" />
      <circle cx="26" cy="32" r="3.2" fill="#7fe3ff" />
      <circle cx="38" cy="32" r="3.2" fill="#7fe3ff" />
      <line x1="32" y1="10" x2="32" y2="4" stroke="#e9e6ff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="4" r="3.5" fill="#ffc83d" />
    </svg>
  );
}

export function Header() {
  const { t, lang, setLang, go } = useKids();
  return (
    <header className="top">
      <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go('/'); }}>
        <Logo />
        <span>Lunar Nav<small>{t('app.kids')}</small></span>
      </a>
      <div role="group" aria-label={t('app.language')} className="lang">
        {LANG_CODES.map((l) => (
          <button key={l} type="button" className="btn ghost small" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
            <span className="sr-only"> {t(`app.langName.${l}`)}</span>
          </button>
        ))}
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useKids();
  return (
    <footer className="foot">
      <p>{t('footer.notEndorsed')}</p>
      <p>{t('footer.data')}</p>
      <p><a href="https://lunarnav.space/" rel="noopener">{t('footer.grownups')}</a></p>
    </footer>
  );
}

/** Back to the start, and on to the next step. */
export function MissionNav({ next, nextLabel }) {
  const { t, go } = useKids();
  return (
    <nav className="no-print" aria-label={t('nav.label')} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <a className="btn ghost" href="#/" onClick={(e) => { e.preventDefault(); go('/'); }}>← {t('nav.home')}</a>
      {next && <a className="btn" href={`#${next}`} onClick={(e) => { e.preventDefault(); go(next); }}>{nextLabel} →</a>}
    </nav>
  );
}
