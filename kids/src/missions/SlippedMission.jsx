// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import Mascot from '../components/Mascot.jsx';
import { Strip } from '../components/Controls.jsx';
import { MissionBar, MissionStars, NextButton, useGoals } from '../components/Frame.jsx';

/** Mission 4 — The landing slipped! Mons Mouton (IM-2): landing on 1 July vs 11 July 2030. */
export default function SlippedMission() {
  const { t, lang } = useKids();
  const [pick, setPick] = useState(null); // 0 = 1 July, 1 = 11 July
  const [answer, setAnswer] = useState(null);
  const { reach } = useGoals('slipped');
  const plans = DATA.plans.im2_athena;
  const fmt = (iso) => new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  useEffect(() => { if (pick === 0) reach('jul1'); if (pick === 1) reach('jul11'); }, [pick, reach]);
  const both = useBothSeen(pick);
  const p = pick === null ? null : plans[pick];
  const dark = p && p.raw.daylight_before_first_night_h === 0;
  const daylight = p ? (p.kids.daylight_before_night_days !== null ? t('m4.aboutDays', { n: kidNumber(p.kids.daylight_before_night_days, lang) }) : (p.kids.daylight_before_night_hours === 0 ? t('m4.none') : t('m4.hours', { n: p.kids.daylight_before_night_hours }))) : '';

  return (
    <div className="stack">
      <MissionBar id="slipped" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m4.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m4.intro')}</p>
        <MissionStars id="slipped" />
        <p className="scene-note">{t('m4.goals')}</p>
      </div>

      <section className="panel stack" aria-labelledby="m4-pick" style={{ gap: 16 }}>
        <h2 id="m4-pick" style={{ fontSize: 26 }}>{t('m4.pick')}</h2>
        <div className="pills" role="group" aria-label={t('m4.pick')}>
          {plans.map((pl, i) => (
            <button key={pl.date} type="button" className="btn ghost" aria-pressed={pick === i} onClick={() => setPick(i)}>{fmt(pl.date)}</button>
          ))}
        </div>
        {p && (
          <div className="grid2 even" style={{ alignItems: 'center' }}>
            <div className="stack" style={{ gap: 12 }}>
              <p style={{ color: 'var(--muted)', fontWeight: 800 }}>{t('m4.daylightLabel')}</p>
              <p className="big-number" aria-live="polite">{daylight}</p>
              <Strip spans={p.sun_spans_days} day={0} color="#ffc94a" label={t('m4.stripLabel', { date: fmt(p.date) })} />
              <p className="scene-note">{t('m4.stripNote')}</p>
            </div>
            <div className="lumi-side">
              <p className="speech" aria-live="polite">{dark ? t('m4.lumiDark', { n: kidNumber(Math.round(p.sun_spans_days[0][0]), lang) }) : t('m4.lumiSun', { n: kidNumber(p.kids.daylight_before_night_days, lang) })}</p>
              <div style={{ width: 'min(220px, 60vw)' }}><Mascot asleep={dark} label={t(dark ? 'm3.sleeping' : 'home.mascotLabel')} /></div>
            </div>
          </div>
        )}
      </section>

      {both && (
        <section className="card stack" aria-labelledby="m4-q" style={{ gap: 12 }}>
          <h2 id="m4-q" style={{ fontSize: 26 }}>{t('m4.question')}</h2>
          <div className="pills" role="group" aria-labelledby="m4-q">
            {plans.map((pl, i) => (
              <button key={pl.date} type="button" className="btn" aria-pressed={answer === i} onClick={() => { setAnswer(i); if (i === 1) reach('better'); }}>{fmt(pl.date)}</button>
            ))}
          </div>
          <p className="explain" role="status">
            {answer !== null && (answer === 1
              ? <><strong className="yes">{t('quiz.right')}</strong> {t('m4.why', { n: kidNumber(plans[1].kids.daylight_before_night_days, lang) })}</>
              : <><strong className="no">{t('quiz.wrong')}</strong> {t('m4.why', { n: kidNumber(plans[1].kids.daylight_before_night_days, lang) })}</>)}
          </p>
        </section>
      )}

      <NextButton to="/target" label={t('nav.next')} />
    </div>
  );
}

/** True once both dates have been looked at in this visit. */
function useBothSeen(pick) {
  const [seen, setSeen] = useState(() => new Set());
  useEffect(() => { if (pick !== null) setSeen((s) => (s.has(pick) ? s : new Set([...s, pick]))); }, [pick]);
  return seen.size === 2;
}
