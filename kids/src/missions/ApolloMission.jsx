// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { MissionBar, MissionStars, NextButton, useGoals } from '../components/Frame.jsx';

/**
 * The sky as a half dome: the horizon at the bottom, 90° (straight up) at the top. Earth's band is
 * its real range of height over 30 days from 1 July 2030 (the API); below 0° is under the horizon.
 */
function SkyDome({ min, max, label, hills }) {
  const cx = 360; const cy = 300; const R = 250;
  const y = (el) => cy - (Math.max(-15, el) / 90) * R;
  const mid = (min + max) / 2;
  return (
    <svg className="dome" viewBox="0 0 720 360" role="img" aria-label={label}>
      <rect width="720" height="360" fill="#14123a" />
      <path d={`M${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy} Z`} fill="#1e1b52" />
      {[30, 60].map((a) => <line key={a} x1={cx - R} x2={cx + R} y1={y(a)} y2={y(a)} stroke="#6e66b8" strokeDasharray="6 8" />)}
      {[30, 60].map((a) => <text key={`t${a}`} x={cx + R + 10} y={y(a) + 6} fontSize="20" fontWeight="800" fill="#c9c3e6">{a}°</text>)}
      <text x={cx + R + 10} y={cy + 6} fontSize="20" fontWeight="800" fill="#c9c3e6">0°</text>
      {/* Earth's range of height */}
      <rect x={cx - 40} y={y(max)} width="80" height={Math.max(4, y(min) - y(max))} rx="14" fill="#3ba7ff" opacity="0.25" />
      <circle cx={cx} cy={y(mid)} r="30" fill="#3ba7ff" />
      <path transform={`translate(${cx} ${y(mid)}) scale(1.15)`} d="M-15,-8 q8,-12 17,-4 q5,8 -4,13 q-9,4 -13,-9z M5,8 q10,-3 13,5 q-6,8 -14,3z" fill="#7fe0b8" />
      {/* the ground (and the hills at the pole) */}
      <path d={hills ? `M0 360 L0 ${cy - 10} Q 120 ${cy - 34} 230 ${cy - 6} T 470 ${cy - 16} T 720 ${cy - 4} L720 360 Z` : `M0 360 L0 ${cy} L720 ${cy} L720 360 Z`} fill="#6e66b8" />
      <path d={`M0 360 L0 ${cy + 22} Q 200 ${cy + 8} 380 ${cy + 26} T 720 ${cy + 14} L720 360 Z`} fill="#9e97d6" />
    </svg>
  );
}

/** Mission 8 — Time travel: Apollo 11 (Earth high in the sky) vs the Shackleton ridge (Earth on the horizon). */
export default function ApolloMission() {
  const { t, lang } = useKids();
  const [where, setWhere] = useState('apollo');
  const [answer, setAnswer] = useState(null);
  const { reach } = useGoals('apollo');
  useEffect(() => { reach(where); }, [where, reach]);
  const a = DATA.apollo11.earth_elevation;
  const s = DATA.sites.shackleton_ridge.raw.earth_elevation;
  const deg = (v) => kidNumber(Math.round(v), lang);
  const range = where === 'apollo' ? a : s;

  return (
    <div className="stack">
      <MissionBar id="apollo" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m8.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m8.intro')}</p>
        <MissionStars id="apollo" />
        <p className="scene-note">{t('m8.goals')}</p>
      </div>

      <section className="panel stack" aria-labelledby="m8-sky" style={{ gap: 14 }}>
        <h2 id="m8-sky" style={{ fontSize: 26 }}>{t('m8.skyTitle')}</h2>
        <div className="pills" role="group" aria-label={t('m8.skyTitle')}>
          <button type="button" className="btn ghost" aria-pressed={where === 'apollo'} onClick={() => setWhere('apollo')}>{t('m8.apollo')}</button>
          <button type="button" className="btn ghost" aria-pressed={where === 'shackleton'} onClick={() => setWhere('shackleton')}>{t('sites.shackleton_ridge.name')}</button>
        </div>
        <SkyDome min={range.min} max={range.max} hills={where === 'shackleton'}
          label={t('m8.domeLabel', { where: where === 'apollo' ? t('m8.apollo') : t('sites.shackleton_ridge.name'), lo: deg(range.min), hi: deg(range.max) })} />
        <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }} aria-live="polite">
          {where === 'apollo' ? t('m8.apolloText', { lo: deg(a.min), hi: deg(a.max) }) : t('m8.shackletonText', { lo: deg(s.min), hi: deg(s.max) })}
        </p>
        <p className="scene-note">{t('m8.note')}</p>
      </section>

      <section className="card stack" aria-labelledby="m8-q" style={{ gap: 12 }}>
        <h2 id="m8-q" style={{ fontSize: 26 }}>{t('m8.question')}</h2>
        <div className="pills" role="group" aria-labelledby="m8-q">
          <button type="button" className="btn" aria-pressed={answer === 'apollo'} onClick={() => { setAnswer('apollo'); reach('answer'); }}>{t('m8.apollo')}</button>
          <button type="button" className="btn" aria-pressed={answer === 'shackleton'} onClick={() => setAnswer('shackleton')}>{t('sites.shackleton_ridge.name')}</button>
        </div>
        <p className="explain" role="status">
          {answer && (answer === 'apollo'
            ? <><strong className="yes">{t('quiz.right')}</strong> {t('m8.why')}</>
            : <><strong className="no">{t('quiz.wrong')}</strong> {t('m8.why')}</>)}
        </p>
      </section>

      <NextButton to="/plan" label={t('nav.next')} />
    </div>
  );
}
