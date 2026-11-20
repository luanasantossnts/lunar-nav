// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useCallback, useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { phaseOf } from '../lib/progress.js';
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
  const { t, resetProgress } = useKids();
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <footer className="foot">
      <p>{t('footer.privacy')} {t('footer.notEndorsed')}. {t('footer.data')}.</p>
      <div className="row no-print" style={{ marginTop: 10, gap: 10 }}>
        {!asking ? (
          <button type="button" className="btn ghost small" onClick={() => { setAsking(true); setDone(false); }}>{t('progress.erase')}</button>
        ) : (
          <>
            <span style={{ color: 'var(--ink)', fontWeight: 800 }}>{t('progress.confirm')}</span>
            <button type="button" className="btn small" onClick={() => { resetProgress(); setAsking(false); setDone(true); }}>{t('progress.yes')}</button>
            <button type="button" className="btn ghost small" onClick={() => setAsking(false)}>{t('progress.no')}</button>
          </>
        )}
        <span role="status" style={{ color: 'var(--mint)', fontWeight: 800 }}>{done ? t('progress.erased') : ''}</span>
      </div>
      <p style={{ marginTop: 10 }}><a href="https://lunarnav.space/" rel="noopener">{t('footer.grownups')}</a></p>
    </footer>
  );
}

const MISSION_COLORS = ['#ffc94a', '#3ba7ff', '#4fd1a5'];
export const PHASE_COLORS = ['#ffc94a', '#3ba7ff', '#ff7a59'];

/** Top of every mission: "Home" on the left; the phase's three bars and "Phase P · Mission N of 3" on the right. */
export function MissionBar({ id }) {
  const { t, go } = useKids();
  const phase = id ? phaseOf(id) : null;
  const n = phase ? phase.missions.indexOf(id) + 1 : null;
  const color = phase ? PHASE_COLORS[phase.id - 1] : null;
  return (
    <div className="mission-bar no-print">
      <a className="btn ghost small" href="#/" onClick={(e) => { e.preventDefault(); go('/'); }}>← {t('nav.home')}</a>
      {phase && (
        <div className="progress">
          <span className="bars" aria-hidden="true">
            {[0, 1, 2].map((i) => <span key={i} style={i < n ? { background: color, borderColor: color } : undefined} />)}
          </span>
          <span>{t('nav.phaseProgress', { p: phase.id, phase: t(`phase.${phase.key}`), n })}</span>
        </div>
      )}
    </div>
  );
}

/** 0–3 stars, drawn in SVG, with a text alternative. */
export function StarRow({ n, size = 26, label }) {
  const { t } = useKids();
  return (
    <span className="star-row" role="img" aria-label={label || t('progress.stars', { n })}>
      {[0, 1, 2].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill={i < n ? '#ffc94a' : 'none'} stroke={i < n ? '#ffc94a' : '#9e97d6'} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Goals of a mission: each goal reached adds a star (up to 3), saved on this device. Returns
 * `reach(goal)` and the set of goals reached in this visit.
 */
export function useGoals(id) {
  const { award } = useKids();
  const [goals, setGoals] = useState(() => new Set());
  useEffect(() => { if (goals.size) award(id, goals.size); }, [goals, id, award]);
  const reach = useCallback((g) => setGoals((s) => (s.has(g) ? s : new Set([...s, g]))), []);
  return { reach, goals };
}

/** The stars of this mission so far, for the top of the screen. */
export function MissionStars({ id }) {
  const { t, progress } = useKids();
  const n = progress.stars[id] || 0;
  return (
    <p className="row" style={{ gap: 10 }} aria-live="polite">
      <StarRow n={n} />
      <span style={{ color: 'var(--muted)' }}>{t('progress.missionStars', { n })}</span>
    </p>
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
