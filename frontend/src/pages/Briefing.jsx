// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import SvsContext from '../components/SvsContext.jsx';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { isoMin, pct } from '../lib/format.js';
import { FakeBanner, Logo, LangSwitch, ThemeToggle } from '../components/Shell.jsx';
import SkyPanorama from '../components/SkyPanorama.jsx';

export default function Briefing() {
  const { t, go, results, terrain, setPlaying, cursor } = useApp();
  const A = results.A;
  const B = results.B;
  useEffect(() => { setPlaying(true); return () => setPlaying(false); }, [setPlaying]);
  const mask = A && A.provenance.horizon.mode === 'terrain' ? terrain[A.site.id]?.mask : null;

  // From 1024 px the left column stays in place while the right column scrolls, but only when
  // it fits entirely below the bar; otherwise it scrolls normally (nothing is ever cut off).
  const headerRef = useRef(null);
  const leftRef = useRef(null);
  const [stick, setStick] = useState({ on: false, top: 48 });
  useEffect(() => {
    const check = () => {
      const top = headerRef.current?.offsetHeight || 48;
      const el = leftRef.current;
      // Content height up to the provenance line (the empty bottom padding may pass the fold).
      const last = el?.lastElementChild;
      const need = last ? last.offsetTop + last.offsetHeight + 16 : Infinity;
      const on = !!el && window.matchMedia('(min-width: 1024px)').matches && need <= window.innerHeight - top;
      setStick((s) => (s.on === on && s.top === top ? s : { on, top }));
    };
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    if (ro && leftRef.current) ro.observe(leftRef.current);
    window.addEventListener('resize', check);
    return () => { ro?.disconnect(); window.removeEventListener('resize', check); };
  }, []);

  return (
    <div className="min-h-full flex flex-col bg-bg text-ink">
      <FakeBanner />
      <header ref={headerRef} className="flex items-center justify-between gap-3 min-h-[48px] px-4 md:px-6 border-b border-line bg-bg lg:sticky lg:top-0 lg:z-20">
        {/* On the Briefing the big lockup carries the brand; the bar keeps only the tagline. */}
        <span className="text-[13px] text-muted min-w-0 truncate">{t('app.tagline')}</span>
        <div className="flex items-center gap-2"><LangSwitch /><ThemeToggle /></div>
      </header>

      <main className="flex-grow flex flex-wrap">
        {/* Top-aligned; the lockup's top lines up with the panorama caption on the right (both 56 px below the bar). */}
        <section className="flex-[1_1_480px] xl:flex-[1_1_500px] border-b md:border-b-0 md:border-r border-line">
          <div ref={leftRef} data-sticky={stick.on ? 'on' : 'off'} className="relative flex flex-col justify-start gap-7 lg:gap-6 [@media(max-height:760px)]:gap-5 px-6 md:px-12 pt-10 pb-14 md:pt-14 [@media(max-height:760px)]:md:pt-12"
            style={stick.on ? { position: 'sticky', top: stick.top } : undefined}>
          {/* Brand lockup above the title: mark + name + "by Lumi Lunar"; colours follow the theme. */}
          <div className="flex items-center gap-3 md:gap-4">
            <span className="md:hidden"><Logo size={48} /></span>
            <span className="hidden md:inline [@media(max-height:760px)]:md:hidden"><Logo size={68} /></span>
            <span className="hidden [@media(max-height:760px)]:md:inline"><Logo size={56} /></span>
            <span className="flex flex-col leading-none">
              <span className="text-[26px] md:text-[34px] font-semibold tracking-tight">{t('app.name')}</span>
              <span className="mt-1.5 text-[13px] md:text-sm text-muted">{t('app.by')}</span>
            </span>
          </div>
          <h1 className="m-0 text-4xl md:text-[44px] [@media(max-height:760px)]:md:text-[38px] leading-[1.1] font-semibold tracking-tight max-w-[540px]">{t('brief.title')}</h1>
          <p className="m-0 text-[17px] leading-relaxed text-text2 max-w-[480px]">{t('brief.body')}</p>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className="btn btn-primary !min-h-[48px] !px-5 text-[15px]" onClick={() => go('/tour/1')}>{t('brief.tour')}</button>
            <button type="button" className="btn !min-h-[48px] !px-5 text-[15px]" onClick={() => go('/planner')}>{t('brief.open')}</button>
          </div>
          {A && B && (
            <dl className="m-0 grid grid-cols-2 max-w-[480px] border-t border-line">
              {[A, B].map((r, i) => (
                <div key={r.site.id} className={`py-3.5 ${i === 0 ? 'pr-4 border-r' : 'pl-4'} border-b border-line`}>
                  <dt className="text-xs text-muted">{r.site.name}</dt>
                  <dd className="m-0 mt-1 font-mono text-[15px] tabular">
                    {/* Sun and Earth on separate lines; label and value never split. */}
                    <span className="block whitespace-nowrap" style={{ color: 'var(--sun)' }}>{t('common.sun')}{'\u00A0'}{pct(r.metrics.sun.fraction)}</span>
                    <span className="block whitespace-nowrap" style={{ color: 'var(--earth)' }}>{t('common.earth')}{'\u00A0'}{pct(r.metrics.earth.fraction)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {A && <p className="m-0 text-xs text-dim">{A.provenance.source} · {A.provenance.horizon.mode} · {isoMin(A.metrics.period.start)} → {isoMin(A.metrics.period.end)}</p>}
          </div>
        </section>

        <figure className="flex-[999_1_520px] m-0 flex flex-col gap-3 p-6 md:p-8 md:pt-14 [@media(max-height:760px)]:md:pt-12">
          <figcaption className="flex flex-wrap justify-between gap-2 text-[13px] text-muted">
            <span>{A ? t('brief.figure', { site: A.site.name }) : t('common.loading')}</span>
            {cursor && <span className="font-mono text-ink">{isoMin(cursor)}</span>}
          </figcaption>
          <div className="border border-line bg-bg2 p-2">
            {A ? <SkyPanorama result={A} mask={mask} refMask={A ? terrain[A.site.id]?.mask : null} height={460} compact /> : <div className="h-[460px]" />}
          </div>
          <p className="m-0 text-xs text-dim">{t('brief.note')}</p>
          <div className="mt-4"><SvsContext compact /></div>
        </figure>
      </main>

      <footer className="flex flex-wrap justify-between gap-2 px-6 py-3 border-t border-line font-mono text-xs text-dim">
        <span>JPL Horizons · NASA LOLA · LROC · NASA SVS</span>
        <span className="font-sans">{t('app.credit')}</span>
      </footer>
    </div>
  );
}
