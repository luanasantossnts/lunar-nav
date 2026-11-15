// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { NBSP, dateInput, fixed, hrs, isoMin, num, parseDateInput, pct, signed, spreadSpan } from '../lib/format.js';
import ScenarioBar from '../components/ScenarioBar.jsx';
import { Label } from '../components/HelpLink.jsx';
import Bound from '../components/Bound.jsx';
import { longTermLine } from '../lib/reference.js';
import { ErrorBox, HorizonNote, LearnNotes, Loading } from '../components/States.jsx';
import CompareCharts from '../components/CompareCharts.jsx';

function useDelay(site) {
  const { start, days, delayDays, horizonMode, earthMargin, power, siteName } = useApp();
  const [s, set] = useState({ data: null, error: null, loading: false });
  useEffect(() => {
    if (!site) return;
    let live = true;
    set({ data: null, error: null, loading: true });
    api.delay(site, { start: dateInput(start), days, delayDays, mode: horizonMode, earthMargin, power })
      .then((d) => live && set({ data: d, error: null, loading: false }))
      .catch((e) => live && set({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [site, start, days, delayDays, horizonMode, earthMargin, power]);
  return s;
}

function DelayTable({ a, b }) {
  const { t, delayDays, siteName } = useApp();
  // Rows are [label key, formatter, data colour]; the key also gives the "?" glossary link.
  const rows = [
    ['common.sunlight', (m) => pct(m.sun.fraction), 'var(--sun)'],
    ['common.earthInView', (m) => pct(m.earth.fraction), 'var(--earth)'],
    ['common.both', (m) => pct(m.both.fraction)],
    ['common.comm', (m) => (m.comm ? `${pct(m.comm.fraction)} · ${hrs(m.comm.hours_per_day)}/d` : '—'), 'var(--earth)'],
    ['common.longestDark', (m) => <Bound flag={m.sun.longest_hidden_lower_bound}>{hrs(m.sun.longest_hidden_h)}</Bound>],
    ['common.longestEarthGap', (m) => <Bound flag={m.earth.longest_hidden_lower_bound} gap>{hrs(m.earth.longest_hidden_h)}</Bound>],
    ['common.longestCommGap', (m) => (m.comm ? <Bound flag={m.comm.longest_gap_lower_bound} gap>{hrs(m.comm.longest_gap_h)}</Bound> : '—')],
    ['power.energy', (m) => num(m.power?.energy_wh_per_day, 0, 'Wh/d'), 'var(--sun)'],
    ['power.battery', (m) => (m.power ? <Bound flag={m.power.lower_bound}>{`${num(m.power.battery_kwh, 2, 'kWh')} · ${num(m.power.battery_kg, 1, 'kg')}`}</Bound> : '—')],
    ['common.longTerm', (m) => longTermLine(t, m.reference_long_term)],
    ['common.psrNear', (m) => (m.reference_long_term?.available ? pct(m.reference_long_term.psr_fraction_300m) : '—')],
    ['common.nextSunset', (m) => (m.sun.first_set ? isoMin(m.sun.first_set) : t('common.never'))],
    ['common.nextEarthset', (m) => (m.earth.first_set ? isoMin(m.earth.first_set) : t('common.never'))],
  ];
  const cols = [[a, 'A', 'var(--sun)'], [b, 'B', 'var(--earth)']].filter(([d]) => d?.data);
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('compare.title', { n: delayDays })}>
      <table className="w-full min-w-[760px] border-collapse text-sm border-t border-line2">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-3 pr-3 font-medium border-b border-line">{t('compare.metric')}</th>
            {cols.map(([d, w, c]) => (
              <th key={w} scope="col" colSpan={2} className="p-3 font-medium border-b border-l border-line"><span style={{ color: c }}>{w}</span> {siteName(d.data.scenarios[0].site)}</th>
            ))}
          </tr>
          <tr className="text-right text-[11px] text-dim">
            <th className="border-b border-line"><span className="sr-only">{t('compare.metric')}</span></th>
            {cols.map(([, w]) => (
              <th key={w} colSpan={2} className="border-b border-l border-line p-0">
                <div className="grid grid-cols-2"><span className="p-2">{t('compare.original')}</span><span className="p-2" style={{ color: 'var(--alert)' }}>{t('compare.delayed', { n: delayDays })}</span></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular text-right">
          {rows.map(([k, f, color]) => (
            <tr key={k}>
              <th scope="row" className="py-3 pr-3 text-left font-sans font-normal border-b border-hair"><Label k={k} /></th>
              {cols.map(([d, w]) => (
                <td key={w} colSpan={2} className="p-0 border-b border-l border-hair border-l-line">
                  <div className="grid grid-cols-2">
                    <span className="p-3" style={color ? { color } : undefined}>{f(d.data.scenarios[0].metrics)}</span>
                    <span className="p-3" style={color ? { color } : undefined}>{f(d.data.scenarios[1].metrics)}</span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WindowSearch() {
  const { t, A, start, horizonMode, earthMargin, power, siteName } = useApp();
  const [form, setForm] = useState({ from: dateInput(start), to: dateInput(start + 60 * 86400), duration: 14, minSun: 90, minEarth: '', minComm: '', maxDark: '', maxBattery: '' });
  const [res, setRes] = useState({ data: null, error: null, loading: false });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const run = async (e) => {
    e.preventDefault();
    setRes({ data: null, error: null, loading: true });
    try {
      const d = await api.windows(A, { from: form.from, to: form.to, durationDays: form.duration, minSun: form.minSun === '' ? undefined : Number(form.minSun) / 100, minEarthHours: form.minEarth, minCommHours: form.minComm, maxDark: form.maxDark, maxBattery: form.maxBattery, power, mode: horizonMode, earthMargin });
      setRes({ data: d, error: null, loading: false });
    } catch (err) {
      setRes({ data: null, error: err.message, loading: false });
    }
  };
  const field = (k, label, type = 'number') => (
    <label className="flex flex-col gap-1">
      {/* The native picker shows the browser's own date format: the ISO date, on the label line, removes any doubt. */}
      <span className="label-row"><span className="label">{label}</span>{type === 'date' && <span className="label-hint" aria-hidden="true">· {form[k] || '—'}</span>}</span>
      <input className="field w-36 font-mono" type={type} value={form[k]} onChange={set(k)} />
    </label>
  );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold m-0">{t('compare.search')} · <span style={{ color: 'var(--sun)' }}>A</span> {A ? siteName(A) : ''}</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={run}>
        {field('from', `${t('compare.from')} (UTC)`, 'date')}
        {field('to', `${t('compare.to')} (UTC)`, 'date')}
        {field('duration', t('compare.duration'))}
        {field('minSun', t('compare.minSun'))}
        {field('minEarth', t('compare.minEarth'))}
        {field('minComm', t('compare.minComm'))}
        {field('maxDark', t('compare.maxDark'))}
        {field('maxBattery', t('compare.maxBattery'))}
        <button className="btn btn-primary !min-h-[36px] h-9" type="submit" disabled={res.loading || !A}>{t('compare.run')}</button>
      </form>
      {res.loading && <Loading />}
      {res.error && <ErrorBox message={res.error} />}
      {res.data && (
        <div className="text-sm flex flex-col gap-2">
          <p className="m-0 text-muted">{t('compare.scanned', { n: res.data.scanned.length })} · <HorizonNote provenance={res.data.provenance} /></p>
          {res.data.first_match
            ? <p className="m-0"><span className="text-muted">{t('compare.firstMatch')}:</span> <span className="font-mono">{isoMin(res.data.first_match.start)}</span> · <span style={{ color: 'var(--sun)' }}>{pct(res.data.first_match.sun_fraction)}</span> · <span style={{ color: 'var(--earth)' }}>{hrs(res.data.first_match.earth_hours_per_day)} {t('common.perDay')}</span></p>
            : <p className="m-0 text-warntext">{t('compare.noMatch')}</p>}
          <div className="flex items-end gap-px h-16" aria-hidden="true">
            {res.data.scanned.map((r) => (
              <div key={r.start} title={`${isoMin(r.start)} · ${pct(r.sun_fraction)}`} className="flex-1" style={{ height: `${Math.max(4, r.sun_fraction * 100)}%`, background: r.meets ? 'var(--sun)' : 'var(--line2)' }} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Colour on the sequential scale (--seq0 → --seq1 → --seq2) for a sunlight fraction 0…1. */
export function seqColor(f) {
  const x = Math.max(0, Math.min(1, f));
  return x <= 0.5
    ? `color-mix(in srgb, var(--seq1) ${Math.round(200 * x)}%, var(--seq0))`
    : `color-mix(in srgb, var(--seq2) ${Math.round(200 * (x - 0.5))}%, var(--seq1))`;
}

function Sensitivity() {
  const { t, A, start, days, power, siteName } = useApp();
  const [s, set] = useState({ data: null, loading: false, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!A) return;
    let live = true;
    set({ data: null, loading: true, error: null });
    api.sensitivity(A, { start: dateInput(start), days, power }).then((d) => live && set({ data: d, loading: false, error: null })).catch((e) => live && set({ data: null, loading: false, error: e.message }));
    return () => { live = false; };
  }, [A, start, days, power, attempt]);
  const pts = s.data?.points || [];
  const xs = [...new Set(pts.map((p) => p.dx_m))].sort((a, b) => a - b);
  const ys = [...new Set(pts.map((p) => p.dy_m))].sort((a, b) => b - a);
  const lo = pts.length ? Math.min(...pts.map((p) => p.sun_fraction)) : 0;
  const hi = pts.length ? Math.max(...pts.map((p) => p.sun_fraction)) : 1;
  // Absolute scale (0–100 % sunlight), so maps of different sites and dates read the same.
  const ext = pts.length ? Math.max(...pts.map((p) => Math.max(Math.abs(p.dx_m), Math.abs(p.dy_m)))) : 0;
  const sum = s.data?.summary?.available ? s.data.summary : null;
  const inside = (p) => sum && Math.hypot(p.dx_m, p.dy_m) <= sum.radius_m + 1e-6;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold m-0"><Label k="compare.sensitivity" /></h2>
      <p className="m-0 text-sm text-muted">{t('compare.sensitivityNote')}</p>
      {s.loading && <Loading />}
      {s.error && <ErrorBox message={s.error} onRetry={() => setAttempt((n) => n + 1)} />}
      {s.data && !s.data.available && <p className="m-0 text-sm text-warntext">{t(s.data.reason_code === 'custom_site' ? 'compare.sensitivityCustom' : 'compare.sensitivityNoTerrain')}</p>}
      {pts.length > 0 && (
        <div className="flex flex-wrap gap-6 items-start">
          <div className="flex flex-col gap-1">
            <div className="grid gap-px bg-line" style={{ gridTemplateColumns: `repeat(${xs.length}, ${xs.length > 9 ? 30 : 36}px)` }} role="img" aria-label={t('compare.sensitivity')}>
              {ys.flatMap((y) => xs.map((x) => {
                const p = pts.find((q) => q.dx_m === x && q.dy_m === y);
                const f = p ? seqColor(p.sun_fraction) : null;
                const ring = p && inside(p) ? 'inset 0 0 0 1px color-mix(in srgb, var(--ink) 45%, transparent)' : undefined;
                return <div key={`${x},${y}`} title={p ? `${fixed(x)}${NBSP}m ${t('sky.axis.e')}, ${fixed(y)}${NBSP}m ${t('sky.axis.n')} · ${pct(p.sun_fraction)}` : ''} className={`${xs.length > 9 ? 'h-[30px]' : 'h-9'} ${x === 0 && y === 0 ? 'outline outline-2 outline-ink' : ''}`}
                  style={{ background: f || 'var(--bg2)', boxShadow: ring }} />;
              }))}
            </div>
            <div className="flex justify-between font-mono text-[11px] text-dim" aria-hidden="true"><span>−{ext}{'\u00A0'}m</span><span>0</span><span>+{ext}{'\u00A0'}m</span></div>
            <div className="mt-2 flex flex-col gap-1" style={{ width: `${xs.length * (xs.length > 9 ? 31 : 37)}px`, maxWidth: '100%' }}>
              <span className="text-[11px] text-muted">{t('compare.sensitivityLegend')}</span>
              <div className="h-2.5 border border-line" aria-hidden="true" style={{ background: 'linear-gradient(to right, var(--seq0), var(--seq1), var(--seq2))' }} />
              <div className="flex justify-between font-mono text-[11px] text-dim"><span>0{'\u00A0'}%</span><span>50{'\u00A0'}%</span><span>100{'\u00A0'}%</span></div>
            </div>
          </div>
          <div className="text-sm font-mono flex flex-col gap-1">
            <div>{t('common.sunlight')}: {pct(lo)} – {pct(hi)}</div>
            <div className="text-muted">{t('compare.sensitivityScale', { spacing: s.data.spacing_m, ext, n: pts.length })}</div>
            {sum && (
              <>
              <p className="m-0 mt-2 pt-2 border-t border-hair font-sans text-xs text-muted"><Label k="compare.withinRadius" vars={{ m: sum.radius_m, n: sum.points }} /></p>
              <dl className="m-0 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-[13px]">
                {[['sun', t('common.sun'), 'var(--sun)'], ['earth', t('common.earth'), 'var(--earth)'], ['both', t('common.both')], ['comm', t('common.comm'), 'var(--earth)']].filter(([k]) => sum[k]).map(([k, label, c]) => (
                  <div key={k} className="contents">
                    <dt className="font-sans text-text2">{label}</dt>
                    <dd className="m-0 text-right tabular"><span style={c ? { color: c } : undefined}>{spreadSpan(sum, k)}</span> <span className="text-dim">({pct(sum[k].median)})</span></dd>
                  </div>
                ))}
              </dl>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function Compare() {
  const { t, A, B, siteA, siteB, delayDays, days, results, siteName } = useApp();
  const a = useDelay(A);
  const b = useDelay(B);
  const deltas = [[a, 'A', 'var(--sun)'], [b, 'B', 'var(--earth)']].filter(([d]) => d.data);
  return (
    <>
      <ScenarioBar showDelay />
      <div className="px-4 md:px-8 py-7 flex flex-col gap-8">
        <div>
          <h1 className="m-0 text-[28px] font-semibold tracking-tight">{t('compare.title', { n: delayDays })}</h1>
          <p className="m-0 mt-1 text-sm text-muted">{t('compare.subtitle', { d: days })}</p>
          <LearnNotes className="mt-3" notes={[t('learn.delay'), t('learn.spread')]} />
        </div>
        {(a.loading || b.loading) && <Loading />}
        {a.error && <ErrorBox message={a.error} />}
        {b.error && <ErrorBox message={b.error} />}
        {/* Charts of the same data as the table; none when A = B (the scenario bar shows the notice). */}
        {siteA !== siteB && a.data && b.data && <CompareCharts a={a.data} b={b.data} resultA={results.A} resultB={results.B} delayDays={delayDays} />}
        {(a.data || b.data) && <DelayTable a={a} b={b} />}
        {deltas.length > 0 && (
          <section className="flex flex-wrap border-t border-line2">
            <div className="flex-[1_1_420px] min-w-0 py-5 md:pr-6 flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold m-0">{t('compare.change')}</h2>
              <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] gap-x-2.5 sm:gap-x-6 gap-y-2 text-sm">
                <div className="contents">
                  <dt><span className="sr-only">{t('compare.metric')}</span></dt>
                  {[t('common.sun'), t('common.earth'), t('common.commShort'), t('power.batteryShort')].map((h) => <dd key={h} className="m-0 text-xs text-muted text-right">{h}</dd>)}
                </div>
                {deltas.map(([d, w, c]) => (
                  <div key={w} className="contents">
                    <dt><span style={{ color: c }}>{w}</span> {siteName(d.data.scenarios[0].site)}</dt>
                    <dd className="m-0 font-mono text-right">{signed(d.data.delta.sun_hours)}</dd>
                    <dd className="m-0 font-mono text-right">{signed(d.data.delta.earth_hours)}</dd>
                    <dd className="m-0 font-mono text-right">{d.data.delta.comm_hours !== undefined ? signed(d.data.delta.comm_hours) : '—'}</dd>
                    <dd className="m-0 font-mono text-right">{d.data.delta.battery_kwh !== undefined
                      ? <span title={d.data.delta.battery_from_lower_bound ? t('common.deltaBound') : undefined} className={d.data.delta.battery_from_lower_bound ? 'cursor-help underline decoration-dotted' : undefined}>{signed(d.data.delta.battery_kwh, 2, 'kWh')}</span>
                      : '—'}</dd>
                  </div>
                ))}
              </dl>
              {a.data && <HorizonNote provenance={a.data.scenarios[0].provenance} />}
              <p className="m-0 text-xs text-dim">{t('compare.linkNote')}</p>
            </div>
            <div className="flex-[1_1_420px] min-w-0 py-5 md:pl-6 md:border-l border-line"><WindowSearch /></div>
          </section>
        )}
        <div className="border-t border-line2 pt-6"><Sensitivity /></div>
      </div>
    </>
  );
}
