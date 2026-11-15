// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Shared pieces of the SVG charts (Charts tab and Compare): the frame with title, "what this
 * shows", legend and collapsible data table; legend swatches; the value grid; real-pixel width.
 */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { NBSP, fx } from '../lib/format.js';

export const SUN = 'var(--sun)';
export const EARTH = 'var(--earth)';
/** The same colour, darker (e.g. the delayed scenario next to the original). */
export const darker = (c) => `color-mix(in srgb, ${c} 58%, #000)`;
export const MONO = 'IBM Plex Mono, monospace';
export const DASH = ['', '7 4', '2 3', '9 3 2 3', '14 3'];

/** Width of the chart area, so the SVG is drawn at real pixels (text never shrinks on phones). */
export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export const pts = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fx(Math.abs(v), 1)}`);
export const pctTick = (v) => `${v}${NBSP}%`;

/** Frame shared by every chart: title, "what this shows", legend, the SVG and a data table. */
export function ChartFrame({ id, n, title, what, legend, table, status, children }) {
  const { t } = useApp();
  const [ref, w] = useWidth();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-line2 pt-6">
      <h2 id={id} className="m-0 text-[17px] font-semibold">{n ? `${n} · ` : ''}{title}</h2>
      <p className="m-0 text-sm leading-relaxed text-text2 max-w-[78ch]"><span className="font-medium text-ink">{t('charts.what')}:</span> {what}</p>
      {legend?.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-text2" aria-label={t('charts.legend')}>
          {legend.map(([swatch, label]) => <li key={label} className="inline-flex items-center gap-1.5">{swatch}{label}</li>)}
        </ul>
      )}
      <div ref={ref} className="w-full">
        {status ? <p className="m-0 py-6 text-sm text-muted">{status}</p> : children(w)}
      </div>
      {table && !status && (
        <details className="text-sm">
          <summary className="tap inline-flex items-center cursor-pointer text-[13px] text-text2">{t('charts.table')}</summary>
          <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={`${title} · ${t('charts.table')}`}>
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead><tr className="text-left text-xs text-muted">{table.head.map((h) => <th key={h} scope="col" className="py-2 pr-3 font-medium border-b border-line">{h}</th>)}</tr></thead>
              <tbody className="font-mono tabular">
                {table.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => (j === 0
                    ? <th key={j} scope="row" className="py-2 pr-3 text-left font-sans font-normal border-b border-hair">{c}</th>
                    : <td key={j} className="py-2 pr-3 border-b border-hair whitespace-nowrap">{c}</td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export const Swatch = ({ color, kind = 'solid' }) => (
  <svg width="22" height="12" aria-hidden="true">
    {kind === 'solid' && <rect x="1" y="1" width="20" height="10" style={{ fill: color }} />}
    {kind === 'dark' && <rect x="1" y="1" width="20" height="10" style={{ fill: darker(color) }} />}
    {kind === 'light' && <rect x="1" y="1" width="20" height="10" style={{ fill: color, stroke: color }} fillOpacity="0.35" strokeWidth="1.5" />}
    {kind === 'whisker' && <><line x1="11" x2="11" y1="1" y2="11" style={{ stroke: 'var(--ink)' }} strokeWidth="1.5" /><line x1="7" x2="15" y1="1" y2="1" style={{ stroke: 'var(--ink)' }} strokeWidth="1.5" /><line x1="7" x2="15" y1="11" y2="11" style={{ stroke: 'var(--ink)' }} strokeWidth="1.5" /></>}
    {kind === 'box' && <rect x="5" y="1" width="12" height="10" fill="none" style={{ stroke: 'var(--ink)' }} strokeDasharray="3 2" strokeWidth="1.2" />}
    {kind.startsWith('dash') && <line x1="1" x2="21" y1="6" y2="6" style={{ stroke: color }} strokeWidth="2" strokeDasharray={DASH[Number(kind.slice(4))]} />}
    {kind === 'vline' && <line x1="11" x2="11" y1="0" y2="12" style={{ stroke: 'var(--ink)' }} strokeWidth="2" />}
    {kind === 'vdash' && <line x1="11" x2="11" y1="0" y2="12" style={{ stroke: 'var(--ink)' }} strokeWidth="1.5" strokeDasharray="3 2" />}
  </svg>
);

export const Grid = ({ x0, x1, y, ticks, fmt }) => ticks.map((v) => (
  <g key={v}>
    <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} style={{ stroke: v === 0 ? 'var(--line2)' : 'var(--hair)' }} />
    <text x={x0 - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fontFamily={MONO} style={{ fill: 'var(--dim)' }}>{fmt(v)}</text>
  </g>
));
