// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, batteryLevel, runsOut } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { SitePicker, useReducedMotion } from '../components/Controls.jsx';
import { MissionNav } from '../components/Frame.jsx';

const STEPS = 20; // the night in 20 steps

/** The battery picture: level in %, green → yellow → red, a snowflake when it has run out. */
function Battery({ level, frozen, label }) {
  const h = 170;
  const fillH = Math.max(0, ((level - 0) / 100) * h);
  const color = frozen ? '#ff8fa3' : level > 55 ? '#5ee6a0' : '#ffc83d';
  return (
    <svg className="battery" viewBox="0 0 120 220" role="img" aria-label={label}>
      <rect x="44" y="4" width="32" height="16" rx="5" fill="#b9b3d6" />
      <rect x="10" y="20" width="100" height="196" rx="18" fill="#0d1138" stroke="#b9b3d6" strokeWidth="6" />
      <rect x="23" y={33 + (h - fillH)} width="74" height={fillH} rx="8" fill={color} />
      {/* the 20 % that always stays in the battery (keeps it healthy) */}
      <line x1="18" x2="102" y1={33 + h * 0.8} y2={33 + h * 0.8} stroke="#fbf8ff" strokeWidth="3" strokeDasharray="6 6" />
      {frozen && (
        <g stroke="#7fe3ff" strokeWidth="5" strokeLinecap="round" aria-hidden="true">
          {[0, 60, 120].map((a) => <line key={a} x1="60" y1="88" x2="60" y2="152" transform={`rotate(${a} 60 120)`} />)}
          {[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M60 96 l-9 -9 M60 96 l9 -9" fill="none" transform={`rotate(${a} 60 120)`} />)}
        </g>
      )}
    </svg>
  );
}

/** Mission 3 — Charge for the long night: why the battery must be big. */
export default function BatteryMission() {
  const { t, lang } = useKids();
  const reduced = useReducedMotion();
  const [site, setSite] = useState('im2_athena');
  const [step, setStep] = useState(0);
  const [small, setSmall] = useState(false);
  const [running, setRunning] = useState(false);
  // "Run the night": one step every 160 ms (stopped when leaving the screen).
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setStep((i) => { if (i + 1 >= STEPS) { setRunning(false); return STEPS; } return i + 1; }), 160);
    return () => clearInterval(id);
  }, [running]);
  const k = DATA.sites[site].kids;
  const raw = DATA.sites[site].raw;
  const pm = DATA.about.power_model;
  const nightDays = raw.longest_night_h / 24;
  const t01 = step / STEPS;
  const size = small ? 0.5 : 1;
  const level = Math.round(batteryLevel(t01 * nightDays, nightDays, size));
  const frozen = runsOut(t01 * nightDays, nightDays, size);
  const nightText = k.night_days !== null
    ? t(k.night_at_least ? 'm3.nightDaysAtLeast' : 'm3.nightDays', { n: kidNumber(k.night_days, lang) })
    : t('m3.nightHours', { n: kidNumber(k.night_hours, lang) });
  const now = k.night_days !== null ? t('m3.nowDays', { n: kidNumber(Math.round(t01 * nightDays * 2) / 2, lang) }) : t('m3.nowHours', { n: kidNumber(Math.round(t01 * raw.longest_night_h), lang) });
  const batteryText = k.battery_under_1_kwh ? t('m3.batteryTiny') : t(k.battery_at_least ? 'm3.batteryAtLeast' : 'm3.battery', { kwh: kidNumber(k.battery_kwh, lang), kg: kidNumber(k.battery_kg, lang) });

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 8 }}>
        <p className="kicker">{t('home.missionN', { n: 3 })}</p>
        <h1>{t('m3.title')}</h1>
        <p>{t('m3.intro', { load: pm.survival_w })}</p>
      </div>

      <section className="card stack" aria-labelledby="m3-pick">
        <h2 id="m3-pick" style={{ fontSize: 24 }}>{t('m3.pick')}</h2>
        <SitePicker value={site} onChange={(id) => { setSite(id); setStep(0); }} label={t('m3.pick')} />
        <p className="big-number">{nightText}</p>

        <div className="battery-wrap">
          <Battery level={level} frozen={frozen} label={t('m3.batteryLabel', { p: level })} />
          <div className="stack" style={{ gap: 12, flex: '1 1 260px' }}>
            <p><strong style={{ color: 'var(--ink)' }}>{t('m3.day')}</strong> {t('m3.dayText')}</p>
            <p><strong style={{ color: 'var(--ink)' }}>{t('m3.night')}</strong> {t('m3.nightText', { load: pm.survival_w })}</p>
            <div className="timebar">
              <label htmlFor="m3-night">{now}</label>
              <input id="m3-night" type="range" min="0" max={STEPS} step="1" value={step}
                aria-valuetext={`${now}. ${t('m3.batteryLabel', { p: level })}`}
                onChange={(e) => { setRunning(false); setStep(Number(e.target.value)); }} />
            </div>
            <div className="lang" role="group" aria-label={t('m3.sizeLabel')} style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost small" aria-pressed={!small} onClick={() => { setSmall(false); }}>{t('m3.rightSize')}</button>
              <button type="button" className="btn ghost small" aria-pressed={small} onClick={() => { setSmall(true); }}>{t('m3.halfSize')}</button>
            </div>
            <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }}
              onClick={() => { if (reduced) { setStep(STEPS); return; } setStep(0); setRunning(true); }}>
              {t('m3.runNight')}
            </button>
          </div>
        </div>
        <p className="status" aria-live="polite">
          {frozen ? <span className="no">{t('m3.ranOut')}</span> : step >= STEPS ? <span className="yes">{t('m3.madeIt')}</span> : t('m3.level', { p: level })}
        </p>
      </section>

      <section className="card stack" aria-labelledby="m3-results">
        <h2 id="m3-results" style={{ fontSize: 24 }}>{t('m3.results')}</h2>
        <p className="big-number" style={{ fontSize: 'clamp(24px, 5vw, 34px)' }}>{batteryText}</p>
        <p>{t('m3.rule', { load: pm.survival_w, dod: Math.round(pm.dod * 100) })}</p>
        <div className="bars">
          {['shackleton_ridge', 'im2_athena', 'malapert_m1'].map((id) => {
            const kk = DATA.sites[id].kids;
            const v = DATA.sites[id].raw.battery_kwh;
            const maxV = Math.max(...Object.values(DATA.sites).map((x) => x.raw.battery_kwh));
            return (
              <div key={id} className="bar-row">
                <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{t(`sites.${id}.short`)}</span>
                <div className="bar-track" aria-hidden="true"><div className="bar-fill" style={{ width: `${Math.max(1.5, (100 * v) / maxV)}%` }} /></div>
                <span className="bar-value">{kk.battery_under_1_kwh ? t('m3.under1') : t(kk.battery_at_least ? 'm3.kwhAtLeast' : 'm3.kwh', { n: kidNumber(kk.battery_kwh, lang) })}</span>
              </div>
            );
          })}
        </div>
      </section>

      <MissionNav next="/quiz" nextLabel={t('quiz.title')} />
    </div>
  );
}
