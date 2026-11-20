// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, batteryLevel, runsOut } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import Mascot from '../components/Mascot.jsx';
import { SitePicker, useReducedMotion } from '../components/Controls.jsx';
import { MissionBar, MissionStars, NextButton, useGoals } from '../components/Frame.jsx';

const STEPS = 20; // the night in 20 steps
const MINT = '#4fd1a5';
const SUN = '#ffc94a';
const CORAL = '#ff7a59';

/** A big battery. `fillUp` animates it filling (daytime); otherwise it shows `level` %. */
function Battery({ level = 100, frozen = false, fillUp = false, label, dark = false }) {
  const h = 170;
  const fillH = Math.max(0, (level / 100) * h);
  const color = fillUp ? MINT : frozen ? CORAL : level > 55 ? MINT : level > 22 ? SUN : CORAL;
  const shell = dark ? '#c9c3e6' : '#14123a';
  return (
    <svg className="battery" viewBox="0 0 120 220" role="img" aria-label={label}>
      <rect x="44" y="4" width="32" height="16" rx="5" fill={shell} />
      <rect x="10" y="20" width="100" height="196" rx="20" fill={dark ? '#14123a' : '#ffffff'} stroke={shell} strokeWidth="6" />
      <rect className={fillUp ? 'fill-up' : undefined} x="23" y={33 + (h - fillH)} width="74" height={fillH} rx="10" fill={color} />
      {/* the 20 % that always stays in the battery (keeps it healthy) */}
      {!fillUp && <line x1="18" x2="102" y1={33 + h * 0.8} y2={33 + h * 0.8} stroke={dark ? '#ffffff' : '#14123a'} strokeWidth="3" strokeDasharray="6 6" />}
      {frozen && (
        <g stroke="#9bdcff" strokeWidth="5" strokeLinecap="round" aria-hidden="true">
          {[0, 60, 120].map((a) => <line key={a} x1="60" y1="88" x2="60" y2="152" transform={`rotate(${a} 60 120)`} />)}
          {[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M60 96 l-9 -9 M60 96 l9 -9" fill="none" transform={`rotate(${a} 60 120)`} />)}
        </g>
      )}
    </svg>
  );
}

/** Small drawings: the Sun (day card), a lilac crescent Moon (night card), a phone (highlight). */
const SunIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="26" fill={SUN} opacity="0.35" />
    <circle cx="32" cy="32" r="16" fill={SUN} />
  </svg>
);
const MoonIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path d="M40 8 A24 24 0 1 0 56 44 A20 20 0 1 1 40 8 Z" fill="#c9c3e6" />
  </svg>
);
const PhoneIcon = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
    <rect x="18" y="4" width="36" height="64" rx="9" fill="#14123a" />
    <rect x="23" y="12" width="26" height="44" rx="4" fill="#3ba7ff" />
    <rect x="28" y="22" width="16" height="26" rx="3" fill="none" stroke="#ffffff" strokeWidth="3" />
    <rect x="31" y="18" width="10" height="4" rx="2" fill="#ffffff" />
    <rect x="31" y="34" width="10" height="11" rx="1.5" fill={MINT} />
    <circle cx="36" cy="62" r="2.5" fill="#c9c3e6" />
  </svg>
);

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

  // Stars: get through the night, see a half-size battery run out, look at all three spots.
  const { reach } = useGoals('battery');
  const [seen, setSeen] = useState(() => new Set(['im2_athena']));
  useEffect(() => { setSeen((x) => (x.has(site) ? x : new Set([...x, site]))); }, [site]);
  useEffect(() => { if (seen.size >= 3) reach('three'); }, [seen, reach]);
  const k = DATA.sites[site].kids;
  const raw = DATA.sites[site].raw;
  const pm = DATA.about.power_model;
  const siteName = t(`sites.${site}.name`);
  const nightDays = raw.longest_night_h / 24;
  const t01 = step / STEPS;
  const size = small ? 0.5 : 1;
  const level = Math.round(batteryLevel(t01 * nightDays, nightDays, size));
  const frozen = runsOut(t01 * nightDays, nightDays, size);
  useEffect(() => { if (frozen) reach('ranOut'); if (!small && step >= STEPS) reach('madeIt'); }, [frozen, small, step, reach]);
  const nightLen = k.night_days !== null
    ? t(k.night_at_least ? 'm3.lenDaysAtLeast' : 'm3.lenDays', { n: kidNumber(k.night_days, lang) })
    : t('m3.lenHours', { n: kidNumber(k.night_hours, lang) });
  const now = k.night_days !== null ? t('m3.nowDays', { n: kidNumber(Math.round(t01 * nightDays * 2) / 2, lang) }) : t('m3.nowHours', { n: kidNumber(Math.round(t01 * raw.longest_night_h), lang) });
  const phones = k.phone_batteries >= 1000 ? k.phone_batteries.toLocaleString(lang === 'pt' ? 'pt-BR' : lang) : String(k.phone_batteries);
  const sizeLine = k.battery_under_1_kwh
    ? t('m3.sizeTiny')
    : t(k.battery_at_least ? 'm3.sizeAtLeast' : (k.battery_kg >= 150 && k.battery_kg <= 190 ? 'm3.sizeGrownups' : 'm3.size'), { kwh: kidNumber(k.battery_kwh, lang), kg: kidNumber(k.battery_kg, lang) });

  return (
    <div className="stack">
      <MissionBar id="battery" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m3.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m3.intro', { site: siteName, len: nightLen })}</p>
        <MissionStars id="battery" />
        <p className="scene-note">{t('m3.goals')}</p>
        <SitePicker value={site} onChange={(id) => { setSite(id); setStep(0); setRunning(false); }} label={t('m3.pick')} />
      </div>

      <div className="grid2 even">
        <section className="card cream stack" aria-labelledby="m3-day" style={{ gap: 14 }}>
          <div className="row"><SunIcon /><h2 id="m3-day" style={{ fontSize: 30 }}>{t('m3.dayTitle')}</h2></div>
          <div className="row" style={{ gap: 22, alignItems: 'center' }}>
            <Battery fillUp label={t('m3.full')} />
            <div className="stack" style={{ gap: 10, flex: '1 1 160px' }}>
              <p>{t('m3.dayText')}</p>
              <p className="big-number" style={{ fontSize: 30 }}>{t('m3.full')}</p>
            </div>
          </div>
        </section>

        <section className="card night stack" aria-labelledby="m3-night" style={{ gap: 14 }}>
          <div className="row"><MoonIcon /><h2 id="m3-night" style={{ fontSize: 30 }}>{t('m3.nightTitle', { len: nightLen })}</h2></div>
          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            <Battery dark level={level} frozen={frozen} label={t('m3.batteryLabel', { p: level })} />
            <div style={{ width: 140 }}><Mascot asleep label={t('m3.sleeping')} /></div>
          </div>
          <p>{t('m3.nightText', { load: pm.survival_w })}</p>
          <div className="timebar">
            <label htmlFor="m3-time">{now}</label>
            <input id="m3-time" type="range" min="0" max={STEPS} step="1" value={step}
              aria-valuetext={`${now}. ${t('m3.batteryLabel', { p: level })}`}
              onChange={(e) => { setRunning(false); setStep(Number(e.target.value)); }} />
          </div>
          <div className="pills" role="group" aria-label={t('m3.sizeLabel')}>
            <button type="button" className="btn ghost small" aria-pressed={!small} onClick={() => setSmall(false)}>{t('m3.rightSize')}</button>
            <button type="button" className="btn ghost small" aria-pressed={small} onClick={() => setSmall(true)}>{t('m3.halfSize')}</button>
          </div>
          <p><button type="button" className="btn" onClick={() => { if (reduced) { setStep(STEPS); return; } setStep(0); setRunning(true); }}>{t('m3.runNight')}</button></p>
          <p className="status" aria-live="polite">
            {frozen ? <span className="no-text">{t('m3.ranOut')}</span> : step >= STEPS ? <span className="yes-text">{t('m3.madeIt')}</span> : t('m3.level', { p: level })}
          </p>
        </section>
      </div>

      <section className="card row" aria-labelledby="m3-phones" style={{ gap: 18, flexWrap: 'nowrap', alignItems: 'center' }}>
        <PhoneIcon />
        <div className="stack" style={{ gap: 6 }}>
          <h2 id="m3-phones" style={{ fontSize: 'clamp(22px, 3.6vw, 30px)' }}>{t('m3.phones', { n: phones })}</h2>
          <p>{sizeLine}</p>
          <p style={{ fontSize: 15 }}>{t('m3.rule', { load: pm.survival_w, dod: Math.round(pm.dod * 100), wh: DATA.about.phone_battery_wh })}</p>
        </div>
      </section>

      <NextButton to="/quiz" label={t('nav.quiz')} />
    </div>
  );
}
