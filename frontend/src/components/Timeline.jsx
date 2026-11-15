// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { fracOf } from '../lib/visibility.js';
import { pct, shortDate } from '../lib/format.js';

function Track({ spans, start, end, color, cursorFrac, onPick, label }) {
  return (
    <div className="relative h-[10px] bg-[var(--terrain)] cursor-crosshair" role="img" aria-label={label}
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onPick((e.clientX - r.left) / r.width); }}>
      {spans.map(([s, e], i) => (
        <div key={i} className="absolute inset-y-0" style={{ left: `${fracOf(s, start, end) * 100}%`, width: `${(fracOf(e, start, end) - fracOf(s, start, end)) * 100}%`, background: color }} />
      ))}
      {cursorFrac !== null && <div className="absolute -inset-y-1.5 w-px bg-ink" style={{ left: `${cursorFrac * 100}%` }} />}
    </div>
  );
}

export default function Timeline() {
  const { t, results, cursor, setCursor, playing, setPlaying, start, days } = useApp();
  const end = start + days * 86400;
  const cf = cursor ? fracOf(cursor, start, end) : null;
  const pick = (f) => { setPlaying(false); setCursor(start + f * (end - start)); };
  const rows = [];
  ['A', 'B'].forEach((w) => {
    const r = results[w];
    if (!r) return;
    rows.push([`${w} ${t('common.sun').toLowerCase()}`, r.metrics.sun.spans, 'var(--sun)']);
    rows.push([`${w} ${t('common.earth').toLowerCase()}`, r.metrics.earth.spans, 'var(--earth)']);
    if (r.metrics.comm) rows.push([`${w} ${t('common.commShort')}`, r.metrics.comm.spans, 'var(--earth)', t('common.comm')]);
  });
  // DSN station coverage is the same for every site: one lane per complex, in a lighter Earth tone.
  const dsn = (results.A || results.B)?.metrics.comm?.stations;
  if (dsn) {
    Object.entries(dsn).forEach(([id, s]) => rows.push([id, s.spans, 'color-mix(in srgb, var(--earth) 45%, var(--bg2))', t('common.dsnLane', { id })]));
  }
  const ticks = Array.from({ length: 5 }, (_, i) => start + ((end - start) * i) / 4);

  return (
    <section aria-label={t('planner.timeline')} className="px-4 py-3 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button type="button" className="btn !min-h-[36px] !px-2.5" onClick={() => setPlaying(!playing)} aria-label={playing ? t('common.pause') : t('common.play')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {playing ? <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></> : <polygon points="6 4 20 12 6 20" />}
            </svg>
          </button>
          <h2 className="panel-title m-0">{t('planner.timeline')}</h2>
        </div>
        <label className="flex items-center gap-2.5 text-xs text-dim flex-1 min-w-[200px] max-w-[460px]">
          {t('common.time')}
          <input type="range" min="0" max="1000" value={Math.round((cf ?? 0) * 1000)} className="flex-grow" style={{ accentColor: 'var(--ink)' }}
            onChange={(e) => pick(Number(e.target.value) / 1000)} />
        </label>
      </div>
      <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 items-center font-mono text-xs text-text2">
        {rows.map(([label, spans, color, title]) => (
          <div key={label} className="contents">
            <span title={title}>{label}</span>
            <Track spans={spans} start={start} end={end} color={color} cursorFrac={cf} onPick={pick}
              label={t('common.trackSummary', { label: title || label, p: pct(spans.reduce((a, [s0, e0]) => a + Math.max(0, Math.min(e0, end) - Math.max(s0, start)), 0) / Math.max(1, end - start)) })} />
          </div>
        ))}
        <span />
        <div className="flex justify-between text-dim border-t border-line pt-1">{ticks.map((tk) => <span key={tk}>{shortDate(tk)}</span>)}</div>
      </div>
    </section>
  );
}
