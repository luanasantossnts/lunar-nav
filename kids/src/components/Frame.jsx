// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useKids } from '../App.jsx';
import { LANG_CODES } from '../lib/lang.js';

/** The Lunar Nav Kids logo: the Sun, Earth and the arc of the lunar horizon. */
export function Logo({ className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="#1e1b52" />
      <circle cx="22" cy="24" r="12" fill="#ffc94a" opacity="0.35" />
      <circle cx="22" cy="24" r="8" fill="#ffc94a" />
      <circle cx="44" cy="20" r="7" fill="#3ba7ff" />
      <path d="M40 18 q3 -4 6 -1 q1 3 -2 4z" fill="#7fe0b8" />
      <path d="M6 46 Q32 30 58 46" fill="none" stroke="#9e97d6" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Header() {
  const { t, lang, setLang, go } = useKids();
  return (
    <header className="top">
      <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go('/'); }}>
        <Logo />
        <span>Lunar Nav <span className="kids">Kids</span></span>
      </a>
      <div role="group" aria-label={t('app.language')} className="pills">
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
      <p>{t('footer.privacy')} {t('footer.notEndorsed')}. {t('footer.data')}.</p>
      <p style={{ marginTop: 8 }}><a href="https://lunarnav.space/" rel="noopener">{t('footer.grownups')}</a></p>
    </footer>
  );
}

const MISSION_COLORS = ['#ffc94a', '#3ba7ff', '#4fd1a5'];

/** Top of every mission: "Home" on the left; three coloured bars and "Mission N of 3" on the right. */
export function MissionBar({ n }) {
  const { t, go } = useKids();
  return (
    <div className="mission-bar no-print">
      <a className="btn ghost small" href="#/" onClick={(e) => { e.preventDefault(); go('/'); }}>← {t('nav.home')}</a>
      {n && (
        <div className="progress">
          <span className="bars" aria-hidden="true">
            {MISSION_COLORS.map((c, i) => <span key={c} style={i < n ? { background: c, borderColor: c } : undefined} />)}
          </span>
          <span>{t('nav.progress', { n })}</span>
        </div>
      )}
    </div>
  );
}

/** Big yellow button to the next step. */
export function NextButton({ to, label }) {
  const { go } = useKids();
  return (
    <p className="no-print">
      <a className="btn big" href={`#${to}`} onClick={(e) => { e.preventDefault(); go(to); }}>{label} →</a>
    </p>
  );
}

export { MISSION_COLORS };
