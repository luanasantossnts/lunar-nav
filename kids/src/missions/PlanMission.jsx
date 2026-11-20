// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, SITE_IDS } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { BATTERIES, planStars } from '../lib/missions.js';
import { MissionBar, MissionStars, NextButton, StarRow } from '../components/Frame.jsx';

/** A ✓ / ✗ mark drawn in SVG (the text next to it says the same). */
const Mark = ({ ok }) => (
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
    <circle cx="15" cy="15" r="14" fill={ok ? '#4fd1a5' : '#ff7a59'} />
    {ok ? <path d="M8 15.5l4.5 4.5 9-10" stroke="#14123a" strokeWidth="3.5" fill="none" strokeLinecap="round" /> : <path d="M10 10l10 10M20 10L10 20" stroke="#14123a" strokeWidth="3.5" strokeLinecap="round" />}
  </svg>
);

/** Mission 9 — Final mission: your plan. Site × date × battery, three stars, each with its reason. */
export default function PlanMission() {
  const { t, lang, award } = useKids();
  const [site, setSite] = useState('shackleton_ridge');
  const [date, setDate] = useState(0);
  const [battery, setBattery] = useState('small');
  const r = planStars(site, date, battery);
  useEffect(() => { award('plan', r.total); }, [r.total, award]);
  const fmt = (iso) => new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  const days = (h) => kidNumber(Math.round((h / 24) * 2) / 2, lang);
  const night = r.night_h >= 24 ? t('m9.nightDays', { n: days(r.night_h) }) : t('m9.nightHours', { n: kidNumber(Math.round(r.night_h), lang) });
  const need = r.need_kwh >= 1 ? t('m9.aboutKwh', { n: kidNumber(Math.round(r.need_kwh), lang) }) : t('m9.lessThan1');

  const group = (label, options, value, set) => (
    <div className="stack" style={{ gap: 8 }}>
      <p style={{ fontWeight: 800, color: 'var(--ink)' }} id={`m9-${label}`}>{t(`m9.${label}`)}</p>
      <div className="pills" role="group" aria-labelledby={`m9-${label}`}>
        {options.map(([v, text]) => <button key={v} type="button" className="btn ghost small" aria-pressed={value === v} onClick={() => set(v)}>{text}</button>)}
      </div>
    </div>
  );

  return (
    <div className="stack">
      <MissionBar id="plan" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m9.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m9.intro')}</p>
        <MissionStars id="plan" />
      </div>

      <div className="grid2">
        <section className="panel stack" aria-labelledby="m9-choose" style={{ gap: 16 }}>
          <h2 id="m9-choose" style={{ fontSize: 26 }}>{t('m9.choose')}</h2>
          {group('site', SITE_IDS.map((id) => [id, t(`sites.${id}.name`)]), site, setSite)}
          {group('date', DATA.plans[site].map((p, i) => [i, fmt(p.date)]), date, setDate)}
          {group('battery', Object.entries(BATTERIES).map(([k, v]) => [k, t(`m9.bat.${k}`, { kwh: v })]), battery, setBattery)}
        </section>

        <section className="card stack" aria-labelledby="m9-result" style={{ gap: 14 }}>
          <h2 id="m9-result" style={{ fontSize: 26 }}>{t('m9.resultTitle')}</h2>
          <div aria-live="polite" className="stack" style={{ gap: 14 }}>
            <p className="row" style={{ gap: 12 }}><StarRow n={r.total} size={34} /><span className="big-number" style={{ fontSize: 30 }}>{t('m9.total', { n: r.total })}</span></p>
            <p className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}><Mark ok={r.sun} /><span>{t(r.sun ? 'm9.sunYes' : 'm9.sunNo', { p: Math.round(100 * r.sun_fraction) })}</span></p>
            <p className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}><Mark ok={r.call} /><span>{t(r.wait_lower_bound ? 'm9.callUnknown' : r.call ? 'm9.callYes' : 'm9.callNo', { n: days(r.wait_h) })}</span></p>
            <p className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}><Mark ok={r.battery} /><span>{t(r.night_lower_bound ? 'm9.batUnknown' : r.battery ? 'm9.batYes' : 'm9.batNo', { need, night, kwh: BATTERIES[battery] })}</span></p>
          </div>
          <p className="scene-note" style={{ color: 'var(--card-muted)' }}>{t('m9.rules')}</p>
        </section>
      </div>

      <NextButton to="/certificates" label={t('nav.certificates')} />
    </div>
  );
}
