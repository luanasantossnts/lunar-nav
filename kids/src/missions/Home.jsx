// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useKids } from '../App.jsx';
import Mascot from '../components/Mascot.jsx';
import { PHASE_COLORS, StarRow } from '../components/Frame.jsx';
import { PHASES, certificateReady, phaseComplete, phaseStars, phaseUnlocked } from '../lib/progress.js';

/** Mission id → its text key (m1 … m9). */
export const MISSION_KEY = { sun: 'm1', call: 'm2', battery: 'm3', slipped: 'm4', target: 'm5', seasons: 'm6', ice: 'm7', apollo: 'm8', plan: 'm9' };

/** The three phases as planets on a dotted trail (decorative; the cards below carry the content). */
function PhaseTrail({ progress }) {
  const xs = [110, 360, 610];
  return (
    <svg className="phase-map" viewBox="0 0 720 150" aria-hidden="true" focusable="false">
      <path d="M110 80 C 200 20, 270 140, 360 80 S 520 20, 610 80" fill="none" stroke="#6e66b8" strokeWidth="5" strokeDasharray="4 14" strokeLinecap="round" />
      {PHASES.map((p, i) => {
        const open = phaseUnlocked(progress, p.id);
        const done = phaseComplete(progress, p.id);
        return (
          <g key={p.id} opacity={open ? 1 : 0.55}>
            <circle cx={xs[i]} cy="80" r="44" fill={PHASE_COLORS[i]} />
            <ellipse cx={xs[i]} cy="80" rx="66" ry="14" fill="none" stroke="#c9c3e6" strokeWidth="5" transform={`rotate(-14 ${xs[i]} 80)`} />
            <circle cx={xs[i] - 14} cy="68" r="9" fill="#ffffff" opacity="0.35" />
            <text x={xs[i]} y="94" textAnchor="middle" fontSize="40" fontWeight="800" fill="#14123a" fontFamily="'Baloo 2', sans-serif">{p.id}</text>
            {done && <path d={`M${xs[i] + 30} 40 l9 9 16 -18`} stroke="#4fd1a5" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        );
      })}
    </svg>
  );
}

function PlanetIcon({ color }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="20" fill={color} />
      <ellipse cx="32" cy="32" rx="30" ry="7" fill="none" stroke="#9e97d6" strokeWidth="4" transform="rotate(-14 32 32)" />
    </svg>
  );
}

export default function Home() {
  const { t, go, progress, opened, openPhase } = useKids();
  const link = (route) => (e) => { e.preventDefault(); go(route); };
  return (
    <div className="stack" style={{ gap: 34 }}>
      <section className="hero" aria-labelledby="hello-title">
        <div className="stack" style={{ gap: 18 }}>
          <h1 id="hello-title">{t('home.title')}</h1>
          <p className="lead">{t('home.lead')}</p>
          <p><a className="btn big" href="#/sun" onClick={link('/sun')}>{t('home.start')}</a></p>
        </div>
        <div className="lumi-side">
          <p className="speech">{t('home.hello')}</p>
          <div style={{ width: 'min(300px, 70vw)' }}><Mascot label={t('home.mascotLabel')} /></div>
        </div>
      </section>

      <section aria-labelledby="phases-title" className="stack" style={{ gap: 16 }}>
        <h2 id="phases-title">{t('home.phases')}</h2>
        <p style={{ color: 'var(--muted)' }}>{t('home.phasesNote')}</p>
        <PhaseTrail progress={progress} />
        <ul className="grid3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {PHASES.map((p, i) => {
            const unlocked = phaseUnlocked(progress, p.id);
            const show = unlocked || opened.has(p.id);
            const stars = phaseStars(progress, p.id);
            return (
              <li key={p.id} className="card phase-card">
                <div className="phase-head">
                  <PlanetIcon color={PHASE_COLORS[i]} />
                  <div>
                    <h3 id={`phase-${p.id}`} style={{ fontSize: 24 }}>{t('home.phaseN', { n: p.id, phase: t(`phase.${p.key}`) })}</h3>
                    <p>{t('home.phaseStars', { n: stars, max: 9 })}</p>
                  </div>
                </div>
                {show ? (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                    {p.missions.map((m, j) => (
                      <li key={m}>
                        <a className="mission-row" href={`#/${m}`} onClick={link(`/${m}`)}>
                          <span>{3 * i + j + 1}. {t(`${MISSION_KEY[m]}.title`)}</span>
                          <StarRow n={progress.stars[m] || 0} size={20} />
                        </a>
                      </li>
                    ))}
                    {p.id === 1 && (
                      <li><a className="mission-row" href="#/quiz" onClick={link('/quiz')}><span>{t('home.quiz')}</span><span aria-hidden="true">→</span></a></li>
                    )}
                  </ul>
                ) : (
                  <div className="stack" style={{ gap: 10 }}>
                    <p className="lock-note">{t('home.locked', { prev: t(`phase.${PHASES[i - 1].key}`) })}</p>
                    <p><button type="button" className="btn" onClick={() => openPhase(p.id)}>{t('home.playAnyway')}</button></p>
                  </div>
                )}
                <p style={{ marginTop: 'auto' }}>
                  <a className="btn ghost small" style={{ color: 'var(--card-ink)', borderColor: 'var(--rock-back)' }} href="#/certificates" onClick={link('/certificates')}>
                    {certificateReady(progress, p.id) ? t('home.certReady') : t('home.certLocked')}
                  </a>
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
