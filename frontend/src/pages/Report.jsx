// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { Markdown } from '../lib/markdown.jsx';

/** Fixed light palette: the report is a printable page in both themes. */
const PAPER = { '--ink': '#111827', '--text2': '#1f2937', '--muted': '#4b5563', '--dim': '#6b7280', '--line': '#d1d5db', '--line2': '#9ca3af', '--bg2': '#f3f4f6' };
import { coord, degRange, discSpan, round2, ge, hrs, isoMin, num, numSpan, numSpanBound, pct, spreadSpan } from '../lib/format.js';
import { longTermLine, longTermSpread } from '../lib/reference.js';
import { Logo } from '../components/Shell.jsx';

function download(name, type, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Horizon model and terrain state, in the reader's language (the API sends fixed codes). */
const TERRAIN_STATE = { applied: 'applied', 'not requested': 'notRequested', 'unavailable for this site': 'unavailable', grid: 'grid' };
const horizonLabel = (t, h) => `${t(h.mode === 'terrain' ? 'common.terrain' : 'common.geometric')} (${t(`report.terrainState.${TERRAIN_STATE[h.terrain] || 'applied'}`)})`;

/** Position spread only describes a terrain-mode result. */
const spreadOf = (r) => (r?.provenance?.horizon?.mode === 'terrain' ? r.position_spread : null);

/** Data sources named in the report footer (and the Markdown export). */
export const REPORT_SOURCES = 'JPL Horizons (DE441) · NASA LOLA · NASA PGDA · DSN 810-005';

// "Longest night" (power) is the same quantity as "Longest dark period" (Sun), so it appears once.
const ROWS = (t) => [
  [t('common.sunlight'), (m) => pct(m.sun.fraction)],
  [t('report.sunDisc'), (m) => discSpan(m.sun.disc_range)],
  [t('report.sunPos'), (m, r) => spreadSpan(spreadOf(r), 'sun')],
  [t('common.earthInView'), (m) => `${pct(m.earth.fraction)} (${hrs(m.earth.hours_per_day)} ${t('common.perDay')})`],
  [t('report.earthDisc'), (m) => discSpan(m.earth.disc_range)],
  [t('report.earthPos'), (m, r) => spreadSpan(spreadOf(r), 'earth')],
  [t('common.both'), (m) => pct(m.both.fraction)],
  [t('report.bothDisc'), (m) => discSpan(m.both.disc_range)],
  [t('report.bothPos'), (m, r) => spreadSpan(spreadOf(r), 'both')],
  [t('common.comm'), (m) => (m.comm ? `${pct(m.comm.fraction)} (${hrs(m.comm.hours_per_day)} ${t('common.perDay')})` : '—')],
  [t('report.commDisc'), (m) => (m.comm ? discSpan(m.comm.disc_range) : '—')],
  [t('report.commPos'), (m, r) => spreadSpan(spreadOf(r), 'comm')],
  [t('common.longestCommGap'), (m) => (m.comm ? ge(hrs(m.comm.longest_gap_h), m.comm.longest_gap_lower_bound) : '—')],
  [t('power.energy'), (m) => num(m.power?.energy_wh_per_day, 0, 'Wh/d')],
  [t('report.energyDisc'), (m) => (m.power ? numSpan(m.power.disc_range.full_disc.energy_wh_per_day, m.power.disc_range.first_limb.energy_wh_per_day, 0, 'Wh/d') : '—')],
  [t('report.energyPos'), (m, r) => { const s = spreadOf(r)?.energy_wh_per_day; return s ? numSpan(s.p10, s.p90, 0, 'Wh/d') : '—'; }],
  [t('power.balance'), (m) => num(m.power?.balance_wh_per_day, 0, 'Wh/d')],
  [t('power.deficit'), (m) => pct(m.power?.deficit_fraction)],
  [t('power.battery'), (m) => (m.power ? ge(`${num(m.power.battery_kwh, 2, 'kWh')} · ${num(m.power.battery_kg, 1, 'kg')}`, m.power.lower_bound) : '—')],
  [t('report.batteryDisc'), (m) => (m.power ? numSpanBound(m.power.disc_range.first_limb.battery_kwh, m.power.disc_range.first_limb.lower_bound, m.power.disc_range.full_disc.battery_kwh, m.power.disc_range.full_disc.lower_bound, 2, 'kWh') : '—')],
  [t('report.batteryPos'), (m, r) => { const s = spreadOf(r)?.battery_kwh; return s ? numSpanBound(s.p10, s.lower_bound?.p10, s.p90, s.lower_bound?.p90, 2, 'kWh') : '—'; }],
  [t('common.longestDark'), (m) => ge(hrs(m.sun.longest_hidden_h), m.sun.longest_hidden_lower_bound)],
  [t('common.longestEarthGap'), (m) => ge(hrs(m.earth.longest_hidden_h), m.earth.longest_hidden_lower_bound)],
  [t('common.longTerm'), (m) => longTermLine(t, m.reference_long_term)],
  [t('report.longTermSpread'), (m) => longTermSpread(t, m.reference_long_term)],
  [t('report.psr'), (m) => (m.reference_long_term?.available ? `${pct(m.reference_long_term.psr_fraction_300m)} (300\u00A0m) · ${pct(m.reference_long_term.psr_fraction_1km)} (1\u00A0km)` : '—')],
  [t('common.sunElevation'), (m) => degRange(m.sun.elevation.min, m.sun.elevation.max)],
  [t('common.earthElevation'), (m) => degRange(m.earth.elevation.min, m.earth.elevation.max)],
  [t('common.nextSunset'), (m) => (m.sun.first_set ? isoMin(m.sun.first_set) : t('common.never'))],
  [t('common.nextEarthset'), (m) => (m.earth.first_set ? isoMin(m.earth.first_set) : t('common.never'))],
];

export default function Report() {
  const { t, results, reportNotes, lang } = useApp();
  const list = ['A', 'B'].map((w) => results[w]).filter(Boolean);
  const rows = ROWS(t);
  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z';
  const pw = list[0]?.metrics?.power?.params;
  const powerInputs = pw ? t('power.inputs', { panel: pw.panel_w, orient: t(pw.orientation === 'horizontal' ? 'power.horizontal' : 'power.vertical'), load: pw.load_w, surv: pw.survival_w, dod: pw.dod, whkg: pw.wh_per_kg }) : null;

  // metrics.{sun,earth,both} carry disc_range; position_spread is added per scenario.
  const asJson = () => JSON.stringify({ generated, lang, scenarios: list.map((r) => ({ site: r.site, metrics: { ...r.metrics, sun: { ...r.metrics.sun, elevation: round2(r.metrics.sun.elevation) }, earth: { ...r.metrics.earth, elevation: round2(r.metrics.earth.elevation) } }, position_spread: spreadOf(r) ?? null, provenance: r.provenance })), analyst: reportNotes }, null, 2);
  const asCsv = () => {
    const head = ['metric', ...list.map((r) => r.site.name)];
    const lines = rows.map(([label, f]) => [label, ...list.map((r) => f(r.metrics, r))]);
    return [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  };
  const asMd = () => [
    `# ${t('report.title')}`, '', `${t('report.generated')}: ${generated}`, '',
    `| ${t('compare.metric')} | ${list.map((r) => r.site.name).join(' | ')} |`,
    `|---|${list.map(() => '---').join('|')}|`,
    ...rows.map(([label, f]) => `| ${label} | ${list.map((r) => f(r.metrics, r)).join(' | ')} |`),
    '', `## ${t('report.assumptions')}`, '', t('report.assumptionsText'), ...(powerInputs ? ['', powerInputs] : []),
    ...(reportNotes.length ? ['', `## ${t('report.analysis')}`, '', ...reportNotes.flatMap((n) => [`**${n.question}**`, '', n.answer, '', `_${n.provider} · ${n.model} — ${t('analyst.disclosure')}_`, ''])] : []),
    '', '---', REPORT_SOURCES, '', t('app.credit'),
  ].join('\n');

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4 bg-bg2 flex-grow">
      <div className="no-print flex flex-wrap gap-2.5">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>{t('report.print')}</button>
        <button type="button" className="btn" onClick={() => download('lunar-nav-report.json', 'application/json', asJson())} disabled={!list.length}>{t('report.json')}</button>
        <button type="button" className="btn" onClick={() => download('lunar-nav-report.csv', 'text/csv', asCsv())} disabled={!list.length}>{t('report.csv')}</button>
        <button type="button" className="btn" onClick={() => download('lunar-nav-report.md', 'text/markdown', asMd())} disabled={!list.length}>{t('report.md')}</button>
      </div>
      <article className="w-full max-w-[860px] bg-white text-[#080b12] p-10 md:p-16 flex flex-col gap-6 shadow-sm print:shadow-none print:p-0" style={{ colorScheme: 'light' }}>
        <header className="flex justify-between items-start pb-5 border-b-2 border-[#080b12]">
          <div className="flex items-center gap-3">
            <span className="light-logo"><Logo size={40} /></span>
            <div><h1 className="m-0 text-xl font-semibold">Lunar Nav<span className="sr-only"> · {t('report.h1')}</span></h1><div className="text-xs text-[#4b5563]">{t('app.by')}</div></div>
          </div>
          <div className="text-right font-mono text-xs leading-relaxed text-[#4b5563]">{t('report.title')}<br />{t('report.generated')} {generated}<br />{t('report.method', { v: list[0]?.provenance.method_version ?? '—' })}</div>
        </header>
        {list.map((r) => (
          <p key={r.site.id} className="m-0 text-sm text-[#374151]"><strong className="text-[#080b12]">{r.site.name}</strong> · {coord(r.site.lat, r.site.lon)} · {horizonLabel(t, r.provenance.horizon)} · {t('common.source')}: {r.site.source}</p>
        ))}
        {list[0] && <p className="m-0 text-sm text-[#374151]">{isoMin(list[0].metrics.period.start)} → {isoMin(list[0].metrics.period.end)} · {list[0].provenance.source}, {t('report.step', { n: list[0].provenance.step_minutes })}</p>}
        <table className="w-full border-collapse text-sm">
          <thead><tr className="text-left text-xs text-[#4b5563]"><th className="py-2 pr-2 font-medium border-b border-[#d1d5db]">{t('compare.metric')}</th>{list.map((r) => <th key={r.site.id} className="p-2 font-medium border-b border-[#d1d5db]">{r.site.name}</th>)}</tr></thead>
          <tbody className="font-mono">
            {rows.map(([label, f]) => (
              <tr key={label}><th scope="row" className="py-2.5 pr-2 text-left font-sans font-medium border-b border-[#e5e7eb]">{label}</th>{list.map((r) => <td key={r.site.id} className="p-2.5 border-b border-[#e5e7eb]">{f(r.metrics, r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[17px] font-semibold">{t('report.analysis')}</h2>
          {reportNotes.length === 0 && <p className="m-0 text-sm text-[#4b5563]">{t('report.noAnalysis')}</p>}
          {reportNotes.map((n, i) => (
            <div key={i} className="text-sm leading-relaxed">
              <p className="m-0 font-medium">{n.question}</p>
              <div style={PAPER}><Markdown text={n.answer} /></div>
              <p className="m-0 text-xs text-[#4b5563]">{n.provider} · {n.model} · {t('analyst.disclosure')}</p>
            </div>
          ))}
        </section>
        <section className="p-4 bg-[#f3f4f6] text-sm leading-relaxed">
          <h2 className="m-0 mb-1 text-sm font-semibold">{t('report.assumptions')}</h2>
          <p className="m-0 text-[#374151]">{t('report.assumptionsText')}</p>
          {powerInputs && <p className="m-0 mt-1 text-[#374151]">{powerInputs}</p>}
        </section>
        <footer className="pt-3.5 border-t border-[#d1d5db] text-[11px] leading-relaxed text-[#4b5563]">
          <div>{REPORT_SOURCES}</div>
          <div>{t('app.credit')}</div>
        </footer>
      </article>
    </div>
  );
}
