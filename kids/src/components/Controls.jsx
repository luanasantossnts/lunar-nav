// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useRef, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, SITE_IDS } from '../lib/data.js';

/** True when the reader asked for less motion (then "Play" moves in calm steps, no smooth animation). */
export function useReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [reduced, setReduced] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setReduced(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return reduced;
}

/** Three pill buttons: Shackleton ridge, Mons Mouton (IM-2), Malapert Mountain. */
export function SitePicker({ value, onChange, label }) {
  const { t } = useKids();
  return (
    <div role="group" aria-label={label} className="pills">
      {SITE_IDS.map((id) => (
        <button key={id} type="button" className="btn ghost small" aria-pressed={value === id} onClick={() => onChange(id)}>
          {t(`sites.${id}.short`)}
        </button>
      ))}
    </div>
  );
}

/**
 * Time over the 30 days: a big slider (one step = 3 hours), the day in yellow, and Play / Pause.
 * Play is never automatic; under reduced motion it moves half a day per step, slowly.
 */
export function TimeControl({ index, setIndex, max, label, caption }) {
  const { t, lang } = useKids();
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setIndex((i) => {
        const next = i + (reduced ? 4 : 1);
        if (next >= max) { setPlaying(false); return max; }
        return next;
      });
    }, reduced ? 700 : 70);
    return () => clearInterval(timer.current);
  }, [playing, reduced, max, setIndex]);
  const dayN = Math.min(30, Math.floor((index * 3) / 24) + 1);
  const dayText = t('time.day', { d: dayN });
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label htmlFor={`time-${label}`} style={{ fontWeight: 800, color: 'var(--ink)' }}>{caption}</label>
        <span className="day-label" aria-hidden="true">{dayText}</span>
      </div>
      <div className="timebar">
        <button type="button" className="btn small" onClick={() => { if (index >= max) setIndex(0); setPlaying((p) => !p); }} aria-pressed={playing}>
          {playing ? t('time.pause') : t('time.play')}
        </button>
        <input id={`time-${label}`} type="range" min="0" max={max} step="1" value={index}
          aria-valuetext={`${dayText} ${t('time.of30')}`} lang={lang}
          onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} />
      </div>
    </div>
  );
}

/** The 30 days as a strip: coloured where something is true, a marker at `day`. */
export function Strip({ spans, day, color, label }) {
  const W = 720;
  const x = (d) => (d / 30) * W;
  return (
    <svg className="strip" viewBox="0 0 720 76" role="img" aria-label={label}>
      <rect x="0" y="6" width={W} height="28" rx="14" fill="#14123a" stroke="#6e66b8" strokeWidth="2" />
      {spans.map(([a, b], i) => <rect key={i} x={x(a)} y="8" width={Math.max(2, x(b) - x(a))} height="24" rx="2" fill={color} />)}
      <line x1={x(day)} x2={x(day)} y1="0" y2="40" stroke="#ffffff" strokeWidth="4" />
      {[0, 10, 20, 30].map((d) => <text key={d} x={Math.min(W - 18, Math.max(18, x(d)))} y="70" fontSize="26" fontWeight="800" fill="#c9c3e6" textAnchor="middle">{d}</text>)}
    </svg>
  );
}

/** Day (0–30) of a sample index (one sample every 3 h). */
export const dayOf = (index) => (index * 3) / 24;
export const SITE_LIST = SITE_IDS.map((id) => ({ id, ...DATA.sites[id] }));
