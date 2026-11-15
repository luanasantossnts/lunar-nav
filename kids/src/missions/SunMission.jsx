// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useMemo, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, SITE_IDS, sample, sampleCount, sunDaysUntil } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import Scene, { sceneScale } from '../components/Scene.jsx';
import { SitePicker, Strip, TimeControl, dayOf } from '../components/Controls.jsx';
import { MissionNav } from '../components/Frame.jsx';

/** Mission 1 — Find the sunniest spot: days of sunshine in July 2030 at three south-pole sites. */
export default function SunMission() {
  const { t, lang } = useKids();
  const [site, setSite] = useState('shackleton_ridge');
  const [index, setIndex] = useState(0);
  const max = sampleCount(site) - 1;
  const s = sample(site, index);
  const scale = useMemo(() => sceneScale(site, 0, 360, DATA.sites[site].samples.map((x) => x[2])), [site]);
  const k = DATA.sites[site].kids;
  const day = dayOf(index);
  const sunnySoFar = Math.round(sunDaysUntil(site, day));
  const state = s.sunUp ? 'shining' : s.sunEl > 0 ? 'mountains' : 'below';
  const dirs = { 0: t('dir.n'), 90: t('dir.e'), 180: t('dir.s'), 270: t('dir.w') };
  const best = DATA.sunniest[0];
  const worst = DATA.sunniest[DATA.sunniest.length - 1];

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 8 }}>
        <p className="kicker">{t('home.missionN', { n: 1 })}</p>
        <h1>{t('m1.title')}</h1>
        <p>{t('m1.intro')}</p>
      </div>

      <section className="card stack" aria-labelledby="m1-pick">
        <h2 id="m1-pick" style={{ fontSize: 24 }}>{t('m1.pick')}</h2>
        <SitePicker value={site} onChange={(id) => { setSite(id); setIndex(0); }} label={t('m1.pick')} />
        <p className="scene-note">{t(`sites.${site}.about`)}</p>

        <Scene siteId={site} body="sun" az={s.sunAz} el={s.sunEl} k={scale.k} dirs={dirs}
          label={t('m1.sceneLabel', { site: t(`sites.${site}.short`), day: Math.floor(day) + 1 })} />
        <p className="scene-note">{t('scene.taller', { n: scale.exaggeration })} {t('scene.sunBigger')}</p>

        <TimeControl index={index} setIndex={setIndex} max={max} label="m1" />
        <p className="status" aria-live="polite">
          {state === 'shining' ? <span className="yes">{t('m1.shining')}</span> : <span className="no">{t(`m1.${state}`)}</span>}
        </p>
        <p>{t('m1.soFar', { n: sunnySoFar, d: Math.min(30, Math.ceil(day) || 0) })}</p>
        <Strip spans={DATA.sites[site].spans.sun} day={day} color="#ffc83d" label={t('m1.stripLabel', { n: k.sun_days })} />
      </section>

      <section className="card stack" aria-labelledby="m1-results">
        <h2 id="m1-results" style={{ fontSize: 24 }}>{t('m1.results')}</h2>
        <div className="bars">
          {SITE_IDS.map((id) => (
            <div key={id} className="bar-row">
              <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{t(`sites.${id}.short`)}</span>
              <div className="bar-track" aria-hidden="true"><div className="bar-fill" style={{ width: `${(100 * DATA.sites[id].kids.sun_days) / 30}%` }} /></div>
              <span className="bar-value">{t('m1.daysOf30', { n: kidNumber(DATA.sites[id].kids.sun_days, lang) })}</span>
            </div>
          ))}
        </div>
        <p style={{ fontWeight: 700 }}>{t('m1.conclusion', { best: t(`sites.${best}.short`), worst: t(`sites.${worst}.short`), bestN: DATA.sites[best].kids.sun_days, worstN: DATA.sites[worst].kids.sun_days })}</p>
        <p className="scene-note">{t('m1.why')}</p>
      </section>

      <MissionNav next="/call" nextLabel={t('m2.title')} />
    </div>
  );
}
