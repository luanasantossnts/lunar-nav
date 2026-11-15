// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useMemo, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, callReason, earthWindow, sample, sampleCount } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import Scene, { sceneScale } from '../components/Scene.jsx';
import { SitePicker, Strip, TimeControl, dayOf } from '../components/Controls.jsx';
import { MissionNav } from '../components/Frame.jsx';

/** A small "yes / no" light (text, not colour alone). */
function Light({ on, label }) {
  const { t } = useKids();
  return (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <circle cx="14" cy="14" r="11" fill={on ? '#5ee6a0' : '#ff8fa3'} />
        {on ? <path d="M8 14.5l4 4 8-9" stroke="#0b1030" strokeWidth="3" fill="none" strokeLinecap="round" /> : <path d="M9 9l10 10M19 9L9 19" stroke="#0b1030" strokeWidth="3" strokeLinecap="round" />}
      </svg>
      <span><strong style={{ color: 'var(--ink)' }}>{label}</strong> {on ? t('m2.yes') : t('m2.no')}</span>
    </div>
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

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 8 }}>
        <p className="kicker">{t('home.missionN', { n: 2 })}</p>
        <h1>{t('m2.title')}</h1>
        <p>{t('m2.intro')}</p>
      </div>

      <section className="card stack" aria-labelledby="m2-pick">
        <h2 id="m2-pick" style={{ fontSize: 24 }}>{t('m2.pick')}</h2>
        <SitePicker value={site} onChange={(id) => { setSite(id); setIndex(0); }} label={t('m2.pick')} />

        <Scene siteId={site} from={win.from} to={win.to} body="earth" az={s.earthAz} el={s.earthEl} k={scale.k} dirs={dirs}
          label={t('m2.sceneLabel', { site: t(`sites.${site}.short`), day: Math.floor(day) + 1 })} />
        <p className="scene-note">{t('m2.wobble', { lo: kidNumber(Math.round(el.min), lang), hi: kidNumber(Math.round(el.max), lang) })} {t('scene.taller', { n: scale.exaggeration })} {t('scene.earthBigger')}</p>

        <TimeControl index={index} setIndex={setIndex} max={max} label="m2" />
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Light on={s.earthUp} label={t('m2.earthUp')} />
          <Light on={s.dsn} label={t('m2.antennas')} />
        </div>
        <p className="status" aria-live="polite">
          {reason === 'ok' ? <span className="yes">{t('m2.ok')}</span> : <span className="no">{t(`m2.reason.${reason}`)}</span>}
        </p>
        <Strip spans={DATA.sites[site].spans.call} day={day} color="#5ee6a0" label={t('m2.stripLabel', { n: k.call_days })} />
      </section>

      <section className="card stack" aria-labelledby="m2-results">
        <h2 id="m2-results" style={{ fontSize: 24 }}>{t('m2.results')}</h2>
        <p className="big-number">{t('m2.callDays', { n: kidNumber(k.call_days, lang) })}</p>
        <p>{t(k.longest_no_call_at_least ? 'm2.longestAtLeast' : 'm2.longest', { n: kidNumber(k.longest_no_call_days, lang) })}</p>
        <p className="scene-note">{t('m2.why')}</p>
      </section>

      <MissionNav next="/battery" nextLabel={t('m3.title')} />
    </div>
  );
}
