// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';

export const TOUR_PAGES = { 1: '/planner', 2: '/planner', 3: '/sky', 4: '/compare', 5: '/analyst' };

/** Five-step guided tour docked at the bottom of the real screens. */
export default function Tour({ step }) {
  const { t, go, health } = useApp();
  const [title, body] = t(`tour.s${step}`);
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const playId = useRef(0);
  const stop = () => { playId.current += 1; audio.current?.pause(); audio.current = null; setPlaying(false); };
  // Changing step or leaving the tour silences the narration.
  useEffect(() => () => stop(), [step]);
  // Esc leaves the tour (same as Skip).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) go('/planner'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);
  const read = async () => {
    if (playing) { stop(); return; }
    const id = ++playId.current;
    setPlaying(true);
    try {
      const url = await api.tts(`${title}. ${body}`);
      if (playId.current !== id) return; // stopped while loading
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => setPlaying(false);
      await a.play();
    } catch { setPlaying(false); /* voice not configured */ }
  };
  return (
    <section aria-labelledby="tour-title" className="no-print sticky bottom-0 z-40 border-t border-line2 bg-panel flex flex-wrap items-center gap-x-10 gap-y-4 px-6 md:px-8 py-5">
      <div className="font-mono text-[13px] text-muted">{step} / 5</div>
      <div className="flex-[1_1_420px] flex flex-col gap-1.5">
        <h2 id="tour-title" className="m-0 text-xl font-semibold">{title}</h2>
        <p className="m-0 text-[15px] leading-relaxed text-text2">{body}</p>
      </div>
      <div className="flex items-center gap-2.5">
        {health?.voice?.tts && (
          <button type="button" className="btn !px-3" onClick={read} aria-label={playing ? t('analyst.stopVoice') : t('common.readAloud')} aria-pressed={playing}
            style={playing ? { borderColor: 'var(--alert)', color: 'var(--alert)' } : undefined}>
            {playing
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>}
          </button>
        )}
        <button type="button" className="btn" onClick={() => go(step > 1 ? `/tour/${step - 1}` : '/')}>{t('common.back')}</button>
        {step < 5
          ? <button type="button" className="btn btn-primary" onClick={() => go(`/tour/${step + 1}`)}>{t('common.next')}</button>
          : <button type="button" className="btn btn-primary" onClick={() => go('/planner')}>{t('brief.open')}</button>}
        <button type="button" className="tap text-[13px] text-muted ml-1 px-2" onClick={() => go('/planner')}>{t('common.skip')}</button>
      </div>
    </section>
  );
}
