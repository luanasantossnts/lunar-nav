// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useMemo, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, SITE_IDS, sample, sampleCount, sunDaysUntil } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import Scene, { sceneScale } from '../components/Scene.jsx';
import Mascot from '../components/Mascot.jsx';
import { Strip, TimeControl, dayOf } from '../components/Controls.jsx';
import { MissionBar, NextButton } from '../components/Frame.jsx';

/** Mission 1 — Find the sunniest spot: days of sunshine in July 2030 at three south-pole sites. */
export default function SunMission() {
  const { t, lang } = useKids();
  const [site, setSite] = useState('shackleton_ridge');
  const [index, setIndex] = useState(0);
  const max = sampleCount(site) - 1;
  const s = sample(site, index);
  const scale = useMemo(() => sceneScale(site, 0, 360, DATA.sites[site].samples.map((x) => x[2])), [site]);
  const day = dayOf(index);
  const sunnySoFar = Math.round(sunDaysUntil(site, day));
  const state = s.sunUp ? 'shining' : s.sunEl > 0 ? 'mountains' : 'below';
  const dirs = { 0: t('dir.n'), 90: t('dir.e'), 180: t('dir.s'), 270: t('dir.w') };
  const winner = DATA.sunniest[0];
  const sh = DATA.sites.shackleton_ridge.kids;

  return (
    <div className="stack">
      <MissionBar n={1} />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m1.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m1.intro')}</p>
      </div>

      <section className="panel stack" aria-labelledby="m1-scene" style={{ gap: 14 }}>
        <h2 id="m1-scene" className="sr-only">{t('m1.sceneTitle')}</h2>
        <p className="scene-tag">{t('m1.tag')}</p>
        <Scene siteId={site} body="sun" az={s.sunAz} el={s.sunEl} k={scale.k} dirs={dirs}
          label={t('m1.sceneLabel', { site: t(`sites.${site}.short`), day: Math.floor(day) + 1 })} />
        <p className="scene-note">{t('scene.taller', { n: scale.exaggeration })} {t('scene.sunBigger')}</p>
        <TimeControl index={index} setIndex={setIndex} max={max} label="m1" caption={t('m1.slide', { site: t(`sites.${site}.short`) })} />
        <p className="status" aria-live="polite">
          {state === 'shining' ? <span className="yes-text">{t('m1.shining')}</span> : <span className="no-text">{t(`m1.${state}`)}</span>}
        </p>
        <p>{t('m1.soFar', { n: sunnySoFar, d: Math.min(30, Math.ceil(day) || 0) })}</p>
        <Strip spans={DATA.sites[site].spans.sun} day={day} color="#ffc94a" label={t('m1.stripLabel', { n: DATA.sites[site].kids.sun_days })} />
      </section>

      <section aria-labelledby="m1-pick" className="stack" style={{ gap: 14 }}>
        <h2 id="m1-pick">{t('m1.pick')}</h2>
        <div className="grid3">
          {SITE_IDS.map((id) => {
            const k = DATA.sites[id].kids;
            const exact = k.sun_days === 30;
            return (
              <button key={id} type="button" className={`card ${site === id ? 'selected' : ''}`} aria-pressed={site === id} onClick={() => { setSite(id); setIndex(0); }}>
                <span className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span className="title-font" style={{ fontSize: 26 }}>{t(`sites.${id}.name`)}</span>
                  {id === winner && <span className="badge win">{t('m1.winner')}</span>}
                </span>
                <span style={{ color: 'var(--card-muted)' }}>{t(`sites.${id}.desc`)}</span>
                <span className="sunbar" aria-hidden="true"><span style={{ width: `${(100 * k.sun_days) / 30}%` }} /></span>
                <span className="big-number">{t(exact ? 'm1.daysExact' : 'm1.daysAbout', { n: kidNumber(k.sun_days, lang) })}</span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="tip" aria-label={t('m1.tipLabel')}>
        <Mascot face label={t('home.mascotLabel')} />
        <p><strong>{t('m1.tipTitle')}</strong> {t('m1.tip', { a: kidNumber(sh.sun_days, lang), x: kidNumber(sh.sun_days_p10_300m, lang), y: kidNumber(sh.sun_days_p90_300m, lang) })}</p>
      </aside>

      <NextButton to="/call" label={t('nav.next')} />
    </div>
  );
}
