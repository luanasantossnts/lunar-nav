// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { coord } from '../lib/format.js';

const SIZE = 600;
const C = SIZE / 2;
const R_MAX = 270;
const LAT_EDGE = -80;
const k = (lat) => Math.tan((Math.PI / 180) * (90 + lat) / 2);
const K_EDGE = k(LAT_EDGE);

/** South polar stereographic, 0° longitude up, east clockwise as seen from above the pole. */
export function project(lat, lon) {
  const r = (k(lat) / K_EDGE) * R_MAX;
  const a = (lon * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

const CH = 7.2; // label character width (12 px mono) in map units
const LH = 14;

/**
 * Places site labels so they do not overlap each other, the latitude labels or other markers:
 * A and B first, then the rest; each tries right, left, then right/left shifted up or down.
 */
export function placeLabels(items, fixed = []) {
  const boxes = [...fixed];
  const hit = (b) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  const out = {};
  for (const it of items) {
    const w = it.text.length * CH;
    const tries = [[10, 0, 'start'], [-10, 0, 'end'], [10, LH, 'start'], [10, -LH, 'start'], [-10, LH, 'end'], [-10, -LH, 'end'], [10, 2 * LH, 'start'], [10, -2 * LH, 'start']];
    let pick = tries[0];
    for (const tr of tries) {
      const [dx, dy, anchor] = tr;
      const bx = anchor === 'start' ? it.x + dx : it.x + dx - w;
      const b = { x: bx, y: it.y + dy - 9, w, h: LH - 1 };
      if (bx < 2 || bx + w > SIZE - 2) continue;
      if (!hit(b)) { pick = tr; break; }
    }
    const [dx, dy, anchor] = pick;
    boxes.push({ x: anchor === 'start' ? it.x + dx : it.x + dx - w, y: it.y + dy - 9, w, h: LH - 1 });
    out[it.id] = { x: it.x + dx, y: it.y + dy + 4, anchor };
  }
  return out;
}

/** Latitude ring labels sit on the 180° meridian (bottom), where there are no catalogue sites. */
const LAT_LABELS = [-82, -84, -86, -88].map((lat) => ({ lat, x: C + 4, y: C + (k(lat) / K_EDGE) * R_MAX + 14 }));

export default function PolarMap() {
  const { t, sites, siteA, siteB, setSiteA, setSiteB, A, B, siteName, siteShort } = useApp();
  const [picked, setPicked] = useState(null);
  const polar = sites.filter((s) => s.lat <= LAT_EDGE);
  const extra = [A, B].filter((s) => s && s.id === 'custom' && s.lat <= LAT_EDGE);
  const all = [...polar, ...extra];
  const short = (s) => `${s.id === siteA ? 'A · ' : s.id === siteB ? 'B · ' : ''}${siteShort(s)}`;
  const order = [...all].sort((p, q) => Number(q.id === siteA || q.id === siteB) - Number(p.id === siteA || p.id === siteB));
  // Fixed obstacles: every marker, the latitude labels and the compass labels.
  const fixed = [
    ...all.map((s) => { const [x, y] = project(s.lat, s.lon); return { x: x - 7, y: y - 7, w: 14, h: 14 }; }),
    ...LAT_LABELS.map((l) => ({ x: l.x, y: l.y - 10, w: 30, h: 13 })),
    { x: C - 24, y: 6, w: 18, h: 14 }, { x: SIZE - 40, y: C - 8, w: 36, h: 14 }, { x: C - 14, y: SIZE - 20, w: 36, h: 14 }, { x: 6, y: C - 8, w: 44, h: 14 },
  ];
  const labels = placeLabels(order.map((s) => { const [x, y] = project(s.lat, s.lon); return { id: s.id, x, y, text: short(s) }; }), fixed);

  return (
    <section aria-label={t('planner.map')} className="relative bg-bg2 flex items-start justify-center pt-8 pb-4 md:sticky md:top-0 w-full">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full h-auto max-h-[calc(100vh-290px)] min-h-[340px]" role="group" aria-label={`${t('planner.map')} · A: ${A ? siteName(A) : '—'} · B: ${B ? siteName(B) : '—'}`}>
        <g fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="1">
          {[-80, -82, -84, -86, -88].map((lat) => <circle key={lat} cx={C} cy={C} r={(k(lat) / K_EDGE) * R_MAX} />)}
          {Array.from({ length: 12 }, (_, i) => {
            const [x, y] = project(LAT_EDGE, i * 30);
            return <line key={i} x1={C} y1={C} x2={x} y2={y} />;
          })}
        </g>
        <g style={{ fill: 'var(--dim)' }} fontFamily="IBM Plex Mono, monospace" fontSize="11">
          {LAT_LABELS.map((l) => <text key={l.lat} x={l.x} y={l.y}>{-l.lat}°S</text>)}
          <text x={C - 24} y={18}>0°</text>
          <text x={SIZE - 40} y={C + 4}>90°E</text>
          <text x={C - 14} y={SIZE - 8}>180°</text>
          <text x={6} y={C + 4}>270°E</text>
        </g>
        {all.map((s) => {
          const [x, y] = project(s.lat, s.lon);
          const lp = labels[s.id];
          const isA = s.id === siteA;
          const isB = s.id === siteB;
          const col = isA ? 'var(--sun)' : isB ? 'var(--earth)' : 'var(--muted)';
          return (
            <g key={s.id} role="button" tabIndex={0} aria-label={`${siteName(s)}, ${coord(s.lat, s.lon)}`}
              onClick={() => setPicked(s)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPicked(s)} style={{ cursor: 'pointer' }}>
              {/* Transparent touch area around the marker and its label: 68 map units ≈ 44 px on a phone. */}
              {(() => {
                const lw = 7.4 * short(s).length;
                const l0 = lp.anchor === 'start' ? lp.x : lp.x - lw;
                const x0 = Math.min(x - 16, l0 - 4);
                return <rect x={x0} y={y - 34} width={Math.max(x + 16, l0 + lw + 4) - x0} height="68" fill="transparent" />;
              })()}
              {(isA || isB) && <circle className="ln-pulse" cx={x} cy={y} r="6" fill="none" style={{ stroke: col }} strokeWidth="1.5" />}
              <rect x={x - 5} y={y - 5} width="10" height="10" fill={isA || isB ? 'none' : 'var(--bg2)'} style={{ stroke: col }} strokeWidth="1.5" />
              <text x={lp.x} y={lp.y} textAnchor={lp.anchor} fontSize="12" fontFamily="IBM Plex Mono, monospace" style={{ fill: col }}>
                {isA ? 'A · ' : isB ? 'B · ' : ''}{siteShort(s)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="absolute left-3 top-2 text-xs text-muted max-w-[70%]">{t('planner.mapNote')}</p>
      {picked && (
        <div className="absolute right-3 top-3 w-64 p-3 bg-panel border border-line2 text-sm flex flex-col gap-2">
          <div className="font-semibold">{siteName(picked)}</div>
          <div className="font-mono text-xs text-muted">{coord(picked.lat, picked.lon)}</div>
          <div className="text-xs text-muted">{picked.source}</div>
          <div className="flex gap-2">
            <button type="button" className="btn !min-h-[32px]" onClick={() => { setSiteA(picked.id); setPicked(null); }}>{t('planner.setA')}</button>
            <button type="button" className="btn !min-h-[32px]" onClick={() => { setSiteB(picked.id); setPicked(null); }}>{t('planner.setB')}</button>
            <button type="button" className="btn !min-h-[32px] min-w-[44px] ml-auto" onClick={() => setPicked(null)} aria-label={t('common.close')}>×</button>
          </div>
        </div>
      )}
      {[A, B].some((s) => s && s.lat > LAT_EDGE) && (
        <p className="absolute left-3 bottom-3 text-xs text-muted">
          {t('planner.outsideMap', { list: [A, B].filter((s, i, all) => s && s.lat > LAT_EDGE && all.findIndex((o) => o?.id === s.id) === i).map((s) => `${siteName(s)} (${coord(s.lat, s.lon)})`).join('; ') })}
        </p>
      )}
    </section>
  );
}
