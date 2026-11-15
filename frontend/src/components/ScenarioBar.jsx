// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { dateInput, fx, parseDateInput } from '../lib/format.js';

function SiteSelect({ label, value, onChange, accent }) {
  const { sites, t, siteName } = useApp();
  const groups = ['south_pole', 'south_high_latitude', 'near_side'].map((g) => [g, t(`common.regions.${g}`)]);
  return (
    <label className="flex flex-col gap-1">
      <span className="label-row label"><span style={{ color: accent }}>●</span> {label}</span>
      <select className="field min-w-[220px]" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {groups.map(([g, name]) => (
          <optgroup key={g} label={name}>
            {sites.filter((s) => s.region === g).map((s) => <option key={s.id} value={s.id}>{siteName(s)}</option>)}
          </optgroup>
        ))}
        <option value="custom">{t('common.custom')}…</option>
      </select>
    </label>
  );
}

function CustomForm({ onDone }) {
  const { t, setCustom } = useApp();
  const [lat, setLat] = useState('-85.0');
  const [lon, setLon] = useState('30.0');
  const ok = !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon)) && Math.abs(Number(lat)) <= 90;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (!ok) return;
      setCustom({ id: 'custom', name: `${t('common.custom')} ${fx(Number(lat), 2)}°, ${fx(Number(lon), 2)}°E`, lat: Number(lat), lon: Number(lon), alt_km: 0, source: 'User input', terrain: { mask: false } });
      onDone();
    }}>
      <label className="flex flex-col gap-1"><span className="label-row label">{t('common.lat')}</span><input className="field w-28 font-mono" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" /></label>
      <label className="flex flex-col gap-1"><span className="label-row label">{t('common.lon')}</span><input className="field w-28 font-mono" value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" /></label>
      <button className="btn" type="submit" disabled={!ok}>{t('common.apply')}</button>
    </form>
  );
}

export default function ScenarioBar({ showDelay = false }) {
  const { t, siteA, siteB, setSiteA, setSiteB, start, setStart, days, setDays, horizonMode, setHorizonMode, earthMargin, setEarthMargin, delayDays, setDelayDays } = useApp();
  const [customFor, setCustomFor] = useState(null);
  const pick = (which) => (v) => {
    if (v === 'custom') { setCustomFor(which); }
    (which === 'A' ? setSiteA : setSiteB)(v);
  };
  return (
    <section aria-label={t('top.scenario')} className="no-print flex flex-wrap items-end gap-x-5 gap-y-3 px-4 py-3 border-b border-line">
      <SiteSelect label={t('common.siteA')} value={siteA} onChange={pick('A')} accent="var(--sun)" />
      <SiteSelect label={t('common.siteB')} value={siteB} onChange={pick('B')} accent="var(--earth)" />
      <label className="flex flex-col gap-1">
        {/* The ISO date sits on the label line (the native picker shows the browser's own format). */}
        <span className="label-row"><span className="label">{t('common.landing')} (UTC)</span><span className="label-hint" aria-hidden="true">· {dateInput(start)} 00:00Z</span></span>
        <input type="date" className="field font-mono" value={dateInput(start)} onChange={(e) => e.target.value && setStart(parseDateInput(e.target.value))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-row label">{t('common.days')}</span>
        <input type="number" min="1" max="60" className="field w-20 font-mono" value={days} onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
      </label>
      {showDelay && (
        <label className="flex flex-col gap-1">
          <span className="label-row label">{t('compare.delayDays')}</span>
          <input type="number" min="-60" max="60" className="field w-20 font-mono" value={delayDays} onChange={(e) => setDelayDays(Number(e.target.value) || 0)} />
        </label>
      )}
      <div className="flex flex-col gap-1">
        <span className="label-row label">{t('common.horizon')}</span>
        <div className="seg" role="group" aria-label={t('common.horizon')}>
          <button type="button" aria-pressed={horizonMode === 'geometric'} onClick={() => setHorizonMode('geometric')}>{t('common.geometric')}</button>
          <button type="button" aria-pressed={horizonMode === 'terrain'} onClick={() => setHorizonMode('terrain')}>{t('common.terrain')}</button>
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className="label-row label">{t('common.antennaMargin')}</span>
        <input type="number" step="0.5" min="0" max="20" className="field w-20 font-mono" value={earthMargin} onChange={(e) => setEarthMargin(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} />
      </label>
      {customFor && <CustomForm onDone={() => setCustomFor(null)} />}
      {/* Same site in A and B (dates are shared) compares a scenario with itself: say so, do not block. */}
      {siteA && siteA === siteB && <p role="status" className="m-0 w-full text-xs text-warntext">{t('common.sameScenario')}</p>}
    </section>
  );
}
