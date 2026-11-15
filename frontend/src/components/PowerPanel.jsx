// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { POWER_DEFAULTS } from '../lib/api.js';
import { num, numSpan, numSpanBound, pct } from '../lib/format.js';
import { Label } from './HelpLink.jsx';
import Bound from './Bound.jsx';

const FIELDS = [
  ['panel_w', 'power.panel', 10, 1],
  ['load_w', 'power.load', 5, 0],
  ['survival_w', 'power.survival', 5, 0],
  ['dod', 'power.dod', 0.05, 0.1],
  ['wh_per_kg', 'power.whkg', 10, 50],
];

/**
 * Disc range and, in terrain mode with a grid, the ±300 m range, for one power output.
 * disc/pos ends may be lower bounds (night longer than the period): shown with "≥".
 */
function Sub({ t, disc, pos, d = 0, unit = '' }) {
  const posText = pos && (pos.lower_bound
    ? numSpanBound(pos.p10, pos.lower_bound.p10, pos.p90, pos.lower_bound.p90, d, unit)
    : numSpan(pos.p10, pos.p90, d, unit));
  const anyBound = (disc && (disc[2] || disc[3])) || (pos?.lower_bound && (pos.lower_bound.p10 || pos.lower_bound.p90));
  return (
    <span className="block text-[11px] leading-snug text-dim" title={anyBound ? t('common.lowerBound') : undefined}>
      {disc && <span className="block" title={t('common.discTitle')}>{t('common.discRange', { r: numSpanBound(disc[0], disc[2], disc[1], disc[3], d, unit) })}</span>}
      {pos && <span className="block" title={t('common.posTitle', { m: 300 })}>{t('common.posRange', { m: 300, r: posText })}</span>}
    </span>
  );
}

/** Illustrative energy and battery budget for sites A and B, with editable inputs. */
export default function PowerPanel() {
  const { t, results, power, setPower } = useApp();
  const [draft, setDraft] = useState(power);
  useEffect(() => { setDraft(power); }, [power]);
  // Apply edits after a short pause so typing does not fire a request per key.
  useEffect(() => {
    const id = setTimeout(() => {
      if (JSON.stringify(draft) !== JSON.stringify(power)) setPower(draft);
    }, 500);
    return () => clearTimeout(id);
  }, [draft, power, setPower]);

  const cols = ['A', 'B'].map((w) => [w, results[w]]).filter(([, r]) => r?.metrics?.power);
  const spreadOf = (r) => (r.provenance.horizon.mode === 'terrain' && r.position_spread?.available ? r.position_spread : null);
  const fl = (p) => p.disc_range.first_limb;
  const fd = (p) => p.disc_range.full_disc;
  // Average daily balance is followed by Time in deficit, with the same weight.
  const rows = [
    ['power.energy', (p) => num(p.energy_wh_per_day, 0, 'Wh/d'), (p, s) => <Sub t={t} disc={[fd(p).energy_wh_per_day, fl(p).energy_wh_per_day]} pos={s?.energy_wh_per_day} unit="Wh/d" />, 'var(--sun)'],
    ['power.balance', (p) => num(p.balance_wh_per_day, 0, 'Wh/d')],
    ['power.deficit', (p) => pct(p.deficit_fraction)],
    ['power.night', (p) => <Bound flag={p.lower_bound}>{num(p.longest_night_h, 1, 'h')}</Bound>, (p, s) => <Sub t={t} disc={[fl(p).longest_night_h, fd(p).longest_night_h, fl(p).lower_bound, fd(p).lower_bound]} pos={s?.longest_night_h} d={1} unit="h" />],
    ['power.battery', (p) => <Bound flag={p.lower_bound}>{`${num(p.battery_kwh, 2, 'kWh')} · ${num(p.battery_kg, 1, 'kg')}`}</Bound>, (p, s) => <Sub t={t} disc={[fl(p).battery_kwh, fd(p).battery_kwh, fl(p).lower_bound, fd(p).lower_bound]} pos={s?.battery_kwh} d={2} unit="kWh" />],
  ];

  return (
    <section className="px-4 py-4 border-b border-line flex flex-col gap-3" aria-labelledby="power-title">
      <div className="flex justify-between items-baseline gap-2">
        <h2 id="power-title" className="panel-title m-0">{t('power.title')}</h2>
        <button type="button" className="btn-link text-[12px] text-muted underline" onClick={() => setPower({ ...POWER_DEFAULTS })}>{t('power.reset')}</button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
        {FIELDS.map(([k, label, step, min]) => (
          <label key={k} className="flex flex-col gap-0.5">
            <span className="text-muted"><Label k={label} /></span>
            <input className="field !min-h-[30px] !py-1 font-mono text-[13px]" type="number" step={step} min={min} value={draft[k]}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value === '' ? '' : Number(e.target.value) }))} />
          </label>
        ))}
        <label className="flex flex-col gap-0.5">
          <span className="text-muted"><Label k="power.orientation" /></span>
          <select className="field !min-h-[30px] !py-1 text-[13px]" value={draft.orientation} onChange={(e) => setDraft((d) => ({ ...d, orientation: e.target.value }))}>
            <option value="vertical_tracking">{t('power.vertical')}</option>
            <option value="horizontal">{t('power.horizontal')}</option>
          </select>
        </label>
      </div>
      {cols.length > 0 && (
        <dl className="m-0 grid gap-x-3 gap-y-2 text-[13px]" style={{ gridTemplateColumns: `minmax(7.5rem,1fr) repeat(${cols.length}, auto)` }}>
          <div className="contents">
            <dt><span className="sr-only">{t('common.siteA')} / {t('common.siteB')}</span></dt>
            {cols.map(([w]) => <dd key={w} className="m-0 text-xs text-right" style={{ color: w === 'A' ? 'var(--sun)' : 'var(--earth)' }}>{w}</dd>)}
          </div>
          {rows.map(([k, value, sub, color]) => (
            <div key={k} className="contents">
              <dt className="text-text2"><Label k={k} /></dt>
              {cols.map(([w, r]) => (
                <dd key={w} className="m-0 font-mono tabular text-right">
                  <span style={color ? { color } : undefined}>{value(r.metrics.power)}</span>
                  {sub && sub(r.metrics.power, spreadOf(r))}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      )}
      <p className="m-0 text-[11px] text-dim leading-snug">{t('power.note')}</p>
    </section>
  );
}
