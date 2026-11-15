// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { LANG_LABEL } from '../lib/i18n.js';
import { isoMin } from '../lib/format.js';

export function Logo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <defs><clipPath id={`logo-clip-${size}`}><path d="M-4 0H132V90H120Q64 46 8 90H-4Z" /></clipPath></defs>
      <circle cx="40" cy="72.04" r="16" style={{ fill: 'var(--sun)' }} clipPath={`url(#logo-clip-${size})`} />
      <circle cx="91" cy="40" r="19" style={{ fill: 'var(--earth)' }} />
      <path d="M8 90Q64 46 120 90Q64 62 8 90Z" style={{ fill: 'var(--dim)' }} />
    </svg>
  );
}

export function LangSwitch() {
  const { lang, setLang, t } = useApp();
  return (
    <div role="group" aria-label={t('top.language')} className="flex font-mono text-xs">
      {Object.keys(LANG_LABEL).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
          className={`tap min-w-[40px] min-h-[36px] border-0 border-b-2 bg-transparent ${lang === l ? 'border-ink text-ink' : 'border-transparent text-muted'}`}>
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const { theme, setTheme, t } = useApp();
  return (
    <button type="button" className="btn !min-h-[36px] !px-2.5" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={theme === 'light' ? t('top.toDark') : t('top.toLight')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {theme === 'light'
          ? <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
      </svg>
    </button>
  );
}

const NAV = [
  ['/planner', 'nav.explorer'],
  ['/compare', 'nav.compare'],
  ['/sky', 'nav.sky'],
  ['/charts', 'nav.charts'],
  ['/analyst', 'nav.analyst'],
  null,
  ['/report', 'nav.report'],
  ['/methodology', 'nav.methodology'],
  ['/help', 'nav.help', 'help'],
];

function ModeSwitch() {
  const { t, uiMode, setUiMode } = useApp();
  return (
    <div className="seg" role="group" aria-label={t('top.mode')}>
      <button type="button" aria-pressed={uiMode === 'technical'} onClick={() => setUiMode('technical')}>{t('top.technical')}</button>
      <button type="button" aria-pressed={uiMode === 'learn'} onClick={() => setUiMode('learn')}>{t('top.learn')}</button>
    </div>
  );
}

function NavLinks({ onNavigate, vertical }) {
  const { t, go, route } = useApp();
  return NAV.map((n, i) => n === null
    ? <div key={i} className={vertical ? 'h-px mx-4 my-2 bg-line' : 'hidden lg:block h-px mx-4 my-3 bg-line'} />
    : (
      <a key={n[0]} href={`#${n[0]}`} onClick={(e) => { e.preventDefault(); go(n[0]); onNavigate?.(); }}
        aria-current={route === n[0] ? 'page' : undefined}
        className={`flex items-center min-h-[44px] px-4 whitespace-nowrap no-underline border-l-2 ${route === n[0] ? 'border-ink bg-raise text-ink' : 'border-transparent text-text2'}`}>
        {n[2] === 'help' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mr-2 flex-shrink-0">
            <circle cx="12" cy="12" r="9.5" /><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.5" /><path d="M12 17h.01" />
          </svg>
        )}
        {t(n[1])}
      </a>
    ));
}

/**
 * Top bar. On phones and tablets it keeps the logo, language, theme and a menu button;
 * the mode switch, "Ask the analyst" and the screens move into the collapsible menu.
 */
export function TopBar({ menuOpen, setMenuOpen, menuButton }) {
  const { t, go, cursor, A, B, siteName } = useApp();
  return (
    <header className="no-print flex flex-wrap lg:flex-nowrap items-center gap-x-2 sm:gap-x-4 lg:gap-x-5 gap-y-2 min-h-[48px] px-4 border-b border-line [&>*]:flex-shrink-0">
      <a href="#/" onClick={(e) => { e.preventDefault(); go('/'); }} className="tap flex items-center gap-2.5 no-underline whitespace-nowrap">
        <Logo size={28} />{/* the mark fills ~85 % of its box: ~24 px wide */}
        <span className="text-sm font-semibold">{t('app.name')}</span>
      </a>
      {/* The scenario breadcrumb is the only part that gives way: it shortens with an ellipsis. */}
      <span className="text-[13px] text-muted hidden xl:block min-w-0 !flex-shrink truncate" title={`${A ? siteName(A) : ''} · ${B ? siteName(B) : ''}`}>
        {t('top.scenario')} / <span className="text-ink">{A ? siteName(A) : '…'} · {B ? siteName(B) : '…'}</span>
      </span>
      <span className="flex-grow !flex-shrink" />
      {cursor && <span className="hidden lg:inline font-mono text-[13px] tabular whitespace-nowrap" aria-live="off">{isoMin(cursor)}</span>}
      <div className="hidden lg:block"><ModeSwitch /></div>
      <LangSwitch />
      <ThemeToggle />
      <button type="button" className="btn !min-h-[36px] text-[13px] whitespace-nowrap !hidden lg:!inline-flex" onClick={() => go('/analyst')}>{t('top.ask')}</button>
      <button ref={menuButton} type="button" className="btn !px-2.5 lg:!hidden" aria-expanded={menuOpen} aria-controls="mobile-menu"
        aria-label={menuOpen ? t('top.closeMenu') : t('top.menu')} onClick={() => setMenuOpen(!menuOpen)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
    </header>
  );
}

/** Collapsible menu for phones and tablets (below the lg breakpoint). */
function MobileMenu({ open, close }) {
  const { t, go, cursor } = useApp();
  const first = useRef(null);
  useEffect(() => { if (open) first.current?.querySelector('a')?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div id="mobile-menu" className="no-print lg:hidden border-b border-line bg-panel">
      <nav aria-label={t('nav.modules')} ref={first} className="flex flex-col py-1 text-sm">
        <NavLinks onNavigate={close} vertical />
      </nav>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-line">
        <ModeSwitch />
        <button type="button" className="btn text-[13px]" onClick={() => { go('/analyst'); close(); }}>{t('top.ask')}</button>
        {cursor && <span className="font-mono text-[13px] tabular text-muted">{isoMin(cursor)}</span>}
      </div>
    </div>
  );
}

export function SideNav() {
  const { t } = useApp();
  return (
    <nav aria-label={t('nav.modules')} className="no-print hidden lg:flex lg:flex-col lg:w-[200px] lg:flex-shrink-0 lg:border-r border-line lg:py-3 text-sm">
      <NavLinks />
    </nav>
  );
}

export function StatusBar() {
  const { t, results, go } = useApp();
  const p = results.A?.provenance;
  return (
    <footer className="no-print flex flex-col gap-1 px-4 py-2 border-t border-line text-[11px] text-dim">
      <div className="flex flex-wrap gap-x-5 gap-y-1 justify-between font-mono">
        <span>
          {p ? t('common.status', { source: p.source, mode: p.horizon.mode, step: p.step_minutes }) : t('app.tagline')}
          {p?.cached ? ' · cache' : ''}
        </span>
        <span className="inline-flex gap-4">
          <a href="#/methodology" onClick={(e) => { e.preventDefault(); go('/methodology'); }} className="tap inline-flex items-center text-text2">{t('nav.methodology')}</a>
          <a href="#/privacy" onClick={(e) => { e.preventDefault(); go('/privacy'); }} className="tap inline-flex items-center text-text2">{t('nav.privacy')}</a>
        </span>
      </div>
      <p className="m-0 leading-snug">{t('app.credit')}</p>
    </footer>
  );
}

export function FakeBanner() {
  const { results } = useApp();
  if (!String(results.A?.provenance?.source || '').startsWith('FAKE')) return null;
  return (
    <div role="alert" className="px-4 py-1.5 text-[12px] font-mono text-center" style={{ background: 'var(--alert)', color: '#111' }}>
      OFFLINE TEST DATA — synthetic ephemeris, not JPL Horizons. Numbers are not real.
    </div>
  );
}

/**
 * Short notice after Technical / Learn changes: what the mode does. role="status" is always in the
 * page (so screen readers announce the new text); the text clears itself after a few seconds.
 */
function ModeNotice() {
  const { t, modeNotice, setModeNotice } = useApp();
  useEffect(() => {
    if (!modeNotice) return undefined;
    const id = setTimeout(() => setModeNotice(null), 6000);
    return () => clearTimeout(id);
  }, [modeNotice, setModeNotice]);
  return (
    <div role="status" aria-live="polite" className="fixed z-40 left-1/2 -translate-x-1/2 bottom-12 w-[min(560px,calc(100vw-32px))] pointer-events-none">
      {modeNotice && (
        <p className="m-0 px-4 py-3 bg-raise border border-line2 text-sm leading-relaxed text-text2 shadow-lg">
          <span className="font-medium text-ink">{t(modeNotice.mode === 'learn' ? 'top.learn' : 'top.technical')}:</span> {t(`top.modeNotice.${modeNotice.mode}`)}
        </p>
      )}
    </div>
  );
}

export function Shell({ children }) {
  const { t, route } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const close = useCallback(() => { setMenuOpen(false); menuButton.current?.focus(); }, []);
  // Close the menu when the screen changes, and with Esc.
  useEffect(() => { setMenuOpen(false); }, [route]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    // Capture phase + preventDefault: Esc closes the menu first, without also leaving the tour.
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menuOpen, close]);
  return (
    <div className="min-h-full flex flex-col bg-bg text-ink">
      <a href="#main" className="sr-only sr-only-focusable fixed top-2 left-2 z-50 btn bg-panel" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('top.skip')}</a>
      <FakeBanner />
      <TopBar menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuButton={menuButton} />
      <MobileMenu open={menuOpen} close={close} />
      <div className="flex-grow flex flex-col lg:flex-row min-h-0">
        <SideNav />
        <main id="main" tabIndex={-1} className="flex-grow min-w-0 flex flex-col focus:outline-none">{children}</main>
      </div>
      <StatusBar />
      <ModeNotice />
    </div>
  );
}
