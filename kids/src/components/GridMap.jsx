// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useKids } from '../App.jsx';
import { CENTRE, GRID_N, clampCell } from '../lib/missions.js';

const CELL = 44;
const SIZE = GRID_N * CELL;

/** Colour for a number of sunny days (0–30): dark navy when none, then lilac → warm yellow. */
export function sunColor(days) {
  if (days === 0) return '#0d0b2b';
  const f = Math.min(1, days / 30);
  const a = [110, 102, 184]; const b = [255, 201, 74];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * A top-down 11 × 11 map (each square is 100 m; north up). Keyboard: arrows move the aim, Enter
 * confirms; touch / mouse: tap a square to aim there. Squares in `shown` (or all, with `showAll`)
 * are coloured by their sunny days; the rest are hidden in lilac fog.
 */
export default function GridMap({ cells, aim, setAim, onConfirm, shown, showAll, marks = [], label, describedBy, centreTarget = true }) {
  const { t } = useKids();
  const move = (dc, dr) => setAim({ col: clampCell(aim.col + dc), row: clampCell(aim.row + dr) });
  const onKey = (e) => {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (k) { e.preventDefault(); move(k[0], k[1]); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onConfirm(); }
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="grid-wrap" tabIndex={0} role="group" aria-label={label} aria-describedby={describedBy} onKeyDown={onKey}>
        <svg className="grid-map" viewBox={`-6 -6 ${SIZE + 12} ${SIZE + 12}`} aria-hidden="true" focusable="false">
          <rect x="-6" y="-6" width={SIZE + 12} height={SIZE + 12} rx="18" fill="#14123a" />
          {Object.values(cells).map((c) => {
            const visible = showAll || shown?.has(`${c.col},${c.row}`);
            return (
              <rect key={`${c.col},${c.row}`} x={c.col * CELL + 1} y={c.row * CELL + 1} width={CELL - 2} height={CELL - 2} rx="6"
                fill={visible ? sunColor(c.days) : '#2a2668'} stroke={visible && c.days === 0 ? '#6e66b8' : 'none'} strokeDasharray={visible && c.days === 0 ? '3 3' : undefined}
                onClick={() => setAim({ col: c.col, row: c.row })} style={{ cursor: 'pointer' }} />
            );
          })}
          {centreTarget && (
            <g pointerEvents="none">
              <circle cx={CENTRE * CELL + CELL / 2} cy={CENTRE * CELL + CELL / 2} r="17" fill="none" stroke="#ffffff" strokeWidth="3" />
              <circle cx={CENTRE * CELL + CELL / 2} cy={CENTRE * CELL + CELL / 2} r="7" fill="none" stroke="#ffffff" strokeWidth="3" />
            </g>
          )}
          {marks.map((m) => (
            <g key={m.key} pointerEvents="none">
              <circle cx={m.col * CELL + CELL / 2} cy={m.row * CELL + CELL / 2} r="13" fill="#ff7a59" stroke="#ffffff" strokeWidth="3" />
              <path d={`M${m.col * CELL + CELL / 2 - 6} ${m.row * CELL + CELL / 2 + 1} l4 4 8 -9`} stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>
          ))}
          <rect x={aim.col * CELL - 1} y={aim.row * CELL - 1} width={CELL + 2} height={CELL + 2} rx="8" fill="none" stroke="#ffe066" strokeWidth="5" pointerEvents="none" />
        </svg>
      </div>
      <div className="row" style={{ alignItems: 'center', gap: 18 }}>
        <div className="pad" role="group" aria-label={t('grid.move')}>
          <span />
          <button type="button" className="btn ghost" onClick={() => move(0, -1)} aria-label={t('grid.north')}>↑</button>
          <span />
          <button type="button" className="btn ghost" onClick={() => move(-1, 0)} aria-label={t('grid.west')}>←</button>
          <span />
          <button type="button" className="btn ghost" onClick={() => move(1, 0)} aria-label={t('grid.east')}>→</button>
          <span />
          <button type="button" className="btn ghost" onClick={() => move(0, 1)} aria-label={t('grid.south')}>↓</button>
          <span />
        </div>
      </div>
    </div>
  );
}

/** "300 m east, 100 m north" for an offset in metres (true minus sign never needed: words are used). */
export function offsetText(t, dx, dy) {
  const parts = [];
  if (dx) parts.push(t(dx > 0 ? 'grid.east_m' : 'grid.west_m', { m: Math.abs(dx) }));
  if (dy) parts.push(t(dy > 0 ? 'grid.north_m' : 'grid.south_m', { m: Math.abs(dy) }));
  return parts.length ? parts.join(', ') : t('grid.atTarget');
}
