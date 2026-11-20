// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, SITE_IDS } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { MissionBar, MissionStars, NextButton, useGoals } from '../components/Frame.jsx';

/** Mission 6 — Moon seasons: sunny days in each month of 2030 at the three spots (the API's year data). */
export default function SeasonsMission() {
  const { t, lang } = useKids();
  const [month, setMonth] = useState(7);
  const [seen, setSeen] = useState(() => new Set([7]));
  const { reach } = useGoals('seasons');
  const months = DATA.year.sites;
  const name = (m) => new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2030, m - 1, 1)));
  const mal = months.malapert_m1;
  useEffect(() => { setSeen((s) => (s.has(month) ? s : new Set([...s, month]))); }, [month]);
  useEffect(() => {
    if (mal[month - 1].sun_days === 0) reach('dark');
    if (mal[month - 1].sun_days > 0 && month !== 7) reach('sunny');
    if (seen.size === 12) reach('all');
  }, [month, seen, mal, reach]);

  return (
    <div className="stack">
      <MissionBar id="seasons" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m6.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m6.intro')}</p>
        <MissionStars id="seasons" />
        <p className="scene-note">{t('m6.goals')}</p>
      </div>

      <section className="panel stack" aria-labelledby="m6-month" style={{ gap: 16 }}>
        <h2 id="m6-month" className="sr-only">{t('m6.monthTitle')}</h2>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <label htmlFor="m6-slider" style={{ fontWeight: 800, color: 'var(--ink)' }}>{t('m6.slide')}</label>
            <span className="day-label" aria-hidden="true" style={{ textTransform: 'capitalize' }}>{name(month)} 2030</span>
          </div>
          <input id="m6-slider" type="range" min="1" max="12" step="1" value={month} aria-valuetext={`${name(month)} 2030`} onChange={(e) => setMonth(Number(e.target.value))} />
        </div>
        <div className="grid3" aria-live="polite">
          {SITE_IDS.map((id) => {
            const m = months[id][month - 1];
            return (
              <div key={id} className="card stack" style={{ gap: 10 }}>
                <span className="title-font" style={{ fontSize: 24 }}>{t(`sites.${id}.name`)}</span>
                <span className="sunbar" aria-hidden="true"><span style={{ width: `${(100 * m.sun_days) / m.days_in_month}%` }} /></span>
                <span className="big-number" style={{ fontSize: 30 }}>{t('m6.days', { n: kidNumber(m.sun_days, lang), of: m.days_in_month })}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stack" aria-labelledby="m6-mal" style={{ gap: 12 }}>
        <h2 id="m6-mal" style={{ fontSize: 26 }}>{t('m6.malTitle')}</h2>
        <p style={{ fontSize: 20 }}>{t('m6.highlight')}</p>
        <svg viewBox="0 0 720 170" style={{ width: '100%', height: 'auto' }} role="img" aria-label={t('m6.chartLabel', { list: mal.map((m) => `${name(m.month)} ${m.sun_days}`).join(', ') })}>
          {mal.map((m, i) => {
            const h = (m.sun_days / 31) * 110;
            return (
              <g key={m.month}>
                <rect x={i * 60 + 8} y={130 - h} width="44" height={Math.max(2, h)} rx="6" fill={m.sun_days === 0 ? '#c9c3e6' : '#ffc94a'} stroke={m.month === month ? '#14123a' : 'none'} strokeWidth="4" />
                <text x={i * 60 + 30} y="158" textAnchor="middle" fontSize="18" fontWeight="800" fill="#4a4570">{name(m.month).slice(0, 3)}</text>
                <text x={i * 60 + 30} y={122 - h} textAnchor="middle" fontSize="18" fontWeight="800" fill="#14123a">{m.sun_days}</text>
              </g>
            );
          })}
        </svg>
        <p>{t('m6.why')}</p>
      </section>

      <NextButton to="/ice" label={t('nav.next')} />
    </div>
  );
}
