// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { Markdown } from '../lib/markdown.jsx';
import CachedBadge from '../components/CachedBadge.jsx';
import { dateInput } from '../lib/format.js';
import { STT_MAX_BYTES, STT_MAX_SECONDS, shouldUseBrowserVoice, spoken } from '../lib/voice.js';

/** Renders the answer as safe Markdown; [n] citations open the matching tool call. */
function Answer({ text, onCite }) {
  return <Markdown text={text} onCite={onCite} />;
}

/** A polite, translated message for an API error (limits.*), or the generic one. */
export function errorText(t, e) {
  const k = e?.code ? `limits.${e.code}` : null;
  return k && t(k) !== k ? t(k) : t('limits.generic');
}

/** Speech input (ElevenLabs): stops by itself at 30 s; the text goes to the box, sent only on Run. */
function Mic({ onText }) {
  const { t, lang } = useApp();
  const [rec, setRec] = useState(null);
  const [err, setErr] = useState('');
  const chunks = useRef([]);
  const timer = useRef(null);
  const started = useRef(0);
  const stop = () => { clearTimeout(timer.current); rec?.state === 'recording' && rec.stop(); setRec(null); };
  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        clearTimeout(timer.current);
        stream.getTracks().forEach((tr) => tr.stop());
        const seconds = Math.min(STT_MAX_SECONDS, (Date.now() - started.current) / 1000);
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size > STT_MAX_BYTES) { setErr(t('limits.stt_too_long')); return; }
        try { onText(await api.stt(blob, lang, seconds.toFixed(1))); } catch (e) { setErr(errorText(t, e)); }
      };
      started.current = Date.now();
      mr.start();
      timer.current = setTimeout(() => { if (mr.state === 'recording') { mr.stop(); setErr(t('analyst.micMax')); } setRec(null); }, STT_MAX_SECONDS * 1000);
      setRec(mr);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <button type="button" className="btn !px-2.5" onClick={rec ? stop : start} aria-label={rec ? t('analyst.stop') : t('analyst.speak')} aria-pressed={!!rec}
        style={rec ? { borderColor: 'var(--alert)', color: 'var(--alert)' } : undefined}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </button>
      {err && <span className="text-xs text-warntext">{err}</span>}
    </>
  );
}

export default function Analyst() {
  const { t, lang, analystLog, setAnalystLog, setReportNotes, health, uiMode, siteA, siteB, start, days, horizonMode, delayDays, earthMargin, power } = useApp();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [speak, setSpeak] = useState(false);
  const [openCall, setOpenCall] = useState(null);
  const audio = useRef(null);
  const last = analystLog[analystLog.length - 1];
  const configured = health ? !!health.providers?.claude : true;

  const BCP47 = { en: 'en-US', es: 'es-ES', pt: 'pt-BR' };
  const hasBrowserVoice = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voiceNote, setVoiceNote] = useState('');

  /** Index of the answer currently being read aloud (null = silent). */
  const [playing, setPlaying] = useState(null);
  /** Bumped on every start/stop so late callbacks from an old playback are ignored. */
  const playId = useRef(0);

  const stopVoice = () => {
    playId.current += 1;
    audio.current?.pause();
    audio.current = null;
    if (hasBrowserVoice) window.speechSynthesis.cancel();
    setPlaying(null);
  };

  // Leaving the Analyst page (switching tabs/routes) must silence the voice.
  useEffect(() => () => {
    playId.current += 1;
    audio.current?.pause();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  /** The browser's own speech synthesis: when ElevenLabs is not configured or its allowance is used up. */
  const speakInBrowser = (text, done) => {
    if (!hasBrowserVoice) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = BCP47[lang] || 'en-US';
    const v = window.speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
    return true;
  };

  /** part: 'summary' (Conclusion + Trade-off, default) or 'full'. */
  const listen = async (text, idx, part = 'summary') => {
    stopVoice();
    const id = ++playId.current;
    const done = () => { if (playId.current === id) setPlaying(null); };
    setPlaying(`${idx}:${part}`);
    const fallback = (note) => {
      if (!speakInBrowser(spoken(text, part), done)) { done(); setErr(t('analyst.noVoice')); return; }
      setVoiceNote(note);
    };
    if (shouldUseBrowserVoice(health, null)) { fallback(t('analyst.browserVoice')); return; }
    try {
      const { url } = await api.tts(text, lang, part);
      if (playId.current !== id) return; // stopped while the audio was loading
      const a = new Audio(url);
      audio.current = a;
      a.onended = done;
      a.onerror = done;
      await a.play();
      setVoiceNote('');
    } catch (e) {
      if (playId.current !== id) return;
      if (shouldUseBrowserVoice(health, e)) fallback(t('analyst.voiceLimit'));
      else { done(); setErr(errorText(t, e)); }
    }
  };

  const ask = async (question) => {
    const text = (question ?? q).trim();
    if (!text) return;
    setBusy(true); setErr(''); setQ('');
    const history = analystLog.flatMap((e) => [{ role: 'user', content: e.question }, { role: 'assistant', content: e.answer }]);
    try {
      // The scenario on screen is part of the question (and of its cache key); Learn adds the glossary.
      const scenario = { a: siteA, b: siteB, start: dateInput(start), days, mode: horizonMode, delay: delayDays, earth_margin: earthMargin, power };
      const r = await api.analyst({ question: text, history, lang, mode: uiMode === 'learn' ? 'learn' : 'technical', scenario });
      setAnalystLog((l) => [...l, { question: text, ...r }]);
      if (speak && r.answer) listen(r.answer, analystLog.length);
    } catch (e) {
      setErr(errorText(t, e));
    } finally { setBusy(false); }
  };

  return (
    // From lg (1024 px) the answer and the side panel are two fixed columns: expanding a tool
    // call never pushes the panel below the answer; long JSON scrolls inside the panel.
    <div className="flex flex-wrap lg:flex-nowrap flex-grow">
      <section className="flex-[999_1_560px] lg:flex-1 min-w-0 flex flex-col">
        <div className="px-4 md:px-10 py-4 border-b border-line flex flex-wrap gap-x-4 gap-y-1 items-baseline">
          <h1 className="m-0 text-sm font-semibold">{t('analyst.title')}</h1>
          <span className="text-[13px] text-muted">{t('analyst.note')}</span>
        </div>
        <div className="flex-grow px-4 md:px-10 py-6 flex flex-col gap-7 max-w-[860px]" aria-live="polite">
          {!configured && <p className="m-0 p-3 border border-warnline bg-warnbg text-warntext text-sm">{t('analyst.unavailable')}</p>}
          {analystLog.length === 0 && (
            <div className="flex flex-col gap-2">
              <span className="label">{t('analyst.examples')}</span>
              {['ex1', 'ex2', 'ex3'].map((k) => (
                <button key={k} type="button" className="tap text-left text-sm text-text2 hover:text-ink border-l-2 border-line2 pl-3 py-1" onClick={() => ask(t(`analyst.${k}`))} disabled={busy}>{t(`analyst.${k}`)}</button>
              ))}
            </div>
          )}
          {analystLog.map((e, i) => (
            <article key={i} className="flex flex-col gap-4">
              <div className="pl-3.5 border-l-2 border-line2">
                <div className="text-xs text-muted">{t('analyst.you')}</div>
                <p className="m-0 mt-1 text-base leading-relaxed">{e.question}</p>
              </div>
              <Answer text={e.answer || '—'} onCite={(n) => setOpenCall({ entry: i, n })} />
              <div className="flex flex-wrap gap-2.5">
                {[['summary', t('analyst.listen'), 'btn text-sm'], ['full', t('analyst.readFull'), 'btn text-sm text-text2']].map(([part, label, cls]) => (playing === `${i}:${part}` ? (
                  <button key={part} type="button" className="btn text-sm inline-flex items-center gap-1.5" onClick={stopVoice} aria-pressed="true"
                    style={{ borderColor: 'var(--alert)', color: 'var(--alert)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                    {t('analyst.stopVoice')}
                  </button>
                ) : (
                  <button key={part} type="button" className={`${cls} inline-flex items-center gap-1.5`} onClick={() => listen(e.answer, i, part)}>
                    {part === 'summary' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>}
                    {label}
                  </button>
                )))}
                <button type="button" className="btn text-sm" onClick={() => setReportNotes((n) => [...n, { question: e.question, answer: e.answer, model: e.model, provider: e.provider }])}>{t('report.add')}</button>
                <span className="text-xs text-dim self-center">{e.provider} · {e.model}</span>
                <CachedBadge entry={e} t={t} />
                {voiceNote && i === analystLog.length - 1 && <span className="text-xs text-dim self-center basis-full">{voiceNote}</span>}
              </div>
            </article>
          ))}
          {busy && <p role="status" className="text-sm text-muted m-0">{t('analyst.thinking')}</p>}
          {err && <p role="alert" className="text-sm text-warntext m-0">{err}</p>}
        </div>
        <form className="flex items-center gap-2.5 px-4 py-3 border-t border-line focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:-outline-offset-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <span aria-hidden="true" className="font-mono text-dim">&gt;</span>
          <label htmlFor="ask" className="sr-only">{t('analyst.placeholder')}</label>
          <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('analyst.placeholder')} className="tap flex-grow min-h-[40px] bg-transparent border-0 text-[15px] text-ink outline-none" maxLength={500} />
          {health?.voice?.stt && <Mic onText={(txt) => { setQ(txt); document.getElementById('ask')?.focus(); }} />}
          <button type="submit" className="btn btn-primary" disabled={busy || !q.trim()}>{t('analyst.run')}</button>
        </form>
      </section>

      <aside className="flex-[1_1_380px] lg:flex-none lg:w-[320px] xl:w-[380px] min-w-0 border-l border-line flex flex-col">
        <section className="p-4 border-b border-line flex flex-col gap-2.5">
          <h2 className="panel-title m-0">{t('analyst.tools')}</h2>
          {last?.trace?.length ? (
            <ol className="m-0 p-0 list-none font-mono text-xs">
              {last.trace.map((c) => (
                <li key={c.n} className="border-b border-hair">
                  <button type="button" className={`w-full text-left py-1.5 flex gap-2 ${openCall?.n === c.n ? 'text-ink' : 'text-text2'}`} onClick={() => setOpenCall({ entry: analystLog.length - 1, n: c.n })}>
                    <span className="text-dim w-4">{c.n}</span><span className="flex-grow">{c.tool}</span><span className={c.ok ? 'text-dim' : 'text-warntext'}>{c.ok ? `${c.ms} ms` : 'error'}</span>
                  </button>
                  {openCall && openCall.n === c.n && openCall.entry === analystLog.length - 1 && (
                    <pre tabIndex={0} className="m-0 mb-2 p-2 bg-panel text-[11px] leading-snug overflow-auto max-h-80 max-w-full">{JSON.stringify({ args: c.args, result: c.result }, null, 2)}</pre>
                  )}
                </li>
              ))}
            </ol>
          ) : <p className="m-0 text-xs text-dim">{t('analyst.empty')}</p>}
          <p className="m-0 text-xs text-dim">{t('analyst.provenance')}</p>
        </section>
        <section className="p-4 flex flex-col gap-3.5 text-sm">
          <h2 className="panel-title m-0">{t('analyst.settings')}</h2>
          <div className="flex flex-col gap-1">
            <span className="label">{t('analyst.model')}</span>
            <p className="m-0">Claude (Anthropic)</p>
          </div>
          <label className="tap flex justify-between items-center gap-3">{t('analyst.readAloud')}
            <input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} disabled={health && !health.voice?.tts && !hasBrowserVoice} className="w-[18px] h-[18px]" style={{ accentColor: 'var(--ink)' }} />
          </label>
          <div className="flex justify-between items-baseline gap-3">
            <span>{t('analyst.level')}</span>
            <span className="text-right"><span className="font-medium">{t(uiMode === 'learn' ? 'top.learn' : 'top.technical')}</span><br /><span className="text-xs text-dim">{t('analyst.levelFollows')}</span></span>
          </div>
          <p className="m-0 pt-3 border-t border-line text-xs text-dim leading-relaxed">{t('analyst.disclosureText')}; {health?.voice?.tts ? t('analyst.voiceEleven') : t('analyst.voiceBrowser')}.</p>
        </section>
      </aside>
    </div>
  );
}
