// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useMemo, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, callReason, earthWindow, sample, sampleCount } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import Scene, { sceneScale } from '../components/Scene.jsx';
import { SitePicker, Strip, TimeControl, dayOf } from '../components/Controls.jsx';
import { MissionBar, NextButton } from '../components/Frame.jsx';

/** A big dish antenna (DSN-style), drawn for this site. */
function Antenna() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="23" fill="#e8f4ff" />
      <path d="M10 22 Q24 38 38 22 Z" fill="#3ba7ff" />
      <line x1="24" y1="30" x2="31" y2="13" stroke="#14123a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="31" cy="12" r="3" fill="#ff7a59" />
      <path d="M24 30 L18 42 M24 30 L30 42 M16 42 H32" stroke="#14123a" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Mission 2 — When can we call home? Earth rocks up and down (libration) and hides behind the terrain. */
export default function CallMission() {
  const { t, lang } = useKids();
  const [site, setSite] = useState('shackleton_ridge');
  const [index, setIndex] = useState(0);
  const max = sampleCount(site) - 1;
  const s = sample(site, index);
  const win = useMemo(() => earthWindow(site), [site]);
  const scale = useMemo(() => sceneScale(site, win.from, win.to, DATA.sites[site].samples.map((x) => x[5])), [site, win]);
  const k = DATA.sites[site].kids;
  const day = dayOf(index);
  const reason = callReason(site, s);
  const dirs = { 0: t('dir.n'), 90: t('dir.e'), 180: t('dir.s'), 270: t('dir.w') };
  const el = DATA.sites[site].raw.earth_elevation;
  const siteName = t(`sites.${site}.short`);

  return (
    <div className="stack">
      <MissionBar n={2} />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m2.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m2.intro')}</p>
        <SitePicker value={site} onChange={(id) => { setSite(id); setIndex(0); }} label={t('m2.pick')} />
      </div>

      <div className="grid2">
        <section className="panel stack" aria-labelledby="m2-scene" style={{ gap: 14 }}>
          <h2 id="m2-scene" className="sr-only">{t('m2.sceneTitle')}</h2>
          <p aria-live="polite">
            <span className={`status-badge ${reason === 'ok' ? 'yes' : 'no'}`}>{t(`m2.badge.${reason}`)}</span>
          </p>
          <Scene siteId={site} from={win.from} to={win.to} body="earth" az={s.earthAz} el={s.earthEl} k={scale.k} dirs={dirs}
            label={t('m2.sceneLabel', { site: siteName, day: Math.floor(day) + 1 })} />
          <p className="scene-note">{t('m2.wobble', { lo: kidNumber(Math.round(el.min), lang), hi: kidNumber(Math.round(el.max), lang) })} {t('scene.taller', { n: scale.exaggeration })} {t('scene.earthBigger')}</p>
        </section>

        <section className="card stack" aria-labelledby="m2-who" style={{ gap: 14 }}>
          <h2 id="m2-who" style={{ fontSize: 28 }}>{t('m2.whoTitle')}</h2>
          <p>{t('m2.whoText')}</p>
          <ul className="antennas">
            {['goldstone', 'madrid', 'canberra'].map((a) => <li key={a}><Antenna />{t(`m2.station.${a}`)}</li>)}
          </ul>
        </section>
      </div>

      <section className="panel deep stack" aria-labelledby="m2-month" style={{ gap: 14 }}>
        <h2 id="m2-month" className="sr-only">{t('m2.monthTitle')}</h2>
        <TimeControl index={index} setIndex={setIndex} max={max} label="m2" caption={t('m2.slide', { site: siteName })} />
        <Strip spans={DATA.sites[site].spans.earth} day={day} color="#3ba7ff" label={t('m2.stripLabel', { n: k.earth_days })} />
        <div className="row" style={{ gap: 22 }}>
          <span className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'baseline' }}><span aria-hidden="true" style={{ width: 22, height: 14, borderRadius: 4, background: '#3ba7ff', display: 'inline-block', flex: 'none' }} />{t('m2.earthInSky', { n: kidNumber(k.earth_days, lang) })}</span>
          <span className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'baseline' }}><span aria-hidden="true" style={{ width: 22, height: 14, borderRadius: 4, background: '#14123a', border: '2px solid #6e66b8', display: 'inline-block', flex: 'none' }} />{t(k.longest_no_earth_at_least ? 'm2.hidingAtLeast' : 'm2.hiding', { n: kidNumber(k.longest_no_earth_days, lang) })}</span>
        </div>
        <p className="scene-note">{t('m2.callDays', { n: kidNumber(k.call_days, lang) })} {t('m2.why')}</p>
      </section>

      <NextButton to="/battery" label={t('nav.next')} />
    </div>
  );
}
