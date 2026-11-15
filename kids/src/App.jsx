// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { htmlLang, initialLang, makeT, saveLang, savedLang, urlLang, withoutLangParam } from './lib/lang.js';
import Stars from './components/Stars.jsx';
import Mascot from './components/Mascot.jsx';
import { Footer, Header, MISSION_COLORS } from './components/Frame.jsx';
import SunMission from './missions/SunMission.jsx';
import CallMission from './missions/CallMission.jsx';
import BatteryMission from './missions/BatteryMission.jsx';
import Quiz from './missions/Quiz.jsx';

const Ctx = createContext(null);
export const useKids = () => useContext(Ctx);

/** Hash routes: #/, #/sun, #/call, #/battery, #/quiz, #/certificate (query after "?" is ignored). */
const ROUTES = ['/', '/sun', '/call', '/battery', '/quiz', '/certificate'];
const readRoute = () => {
  const r = (location.hash.replace(/^#/, '').split('?')[0]) || '/';
  return ROUTES.includes(r) ? r : '/';
};

function Home() {
  const { t, go } = useKids();
  const missions = [['/sun', 'm1', MISSION_COLORS[0]], ['/call', 'm2', MISSION_COLORS[1]], ['/battery', 'm3', MISSION_COLORS[2]]];
  return (
    <div className="stack" style={{ gap: 34 }}>
      <section className="hero" aria-labelledby="hello-title">
        <div className="stack" style={{ gap: 18 }}>
          <h1 id="hello-title">{t('home.title')}</h1>
          <p className="lead">{t('home.lead')}</p>
          <p><a className="btn big" href="#/sun" onClick={(e) => { e.preventDefault(); go('/sun'); }}>{t('home.start')}</a></p>
        </div>
        <div className="lumi-side">
          <p className="speech">{t('home.hello')}</p>
          <div style={{ width: 'min(300px, 70vw)' }}><Mascot label={t('home.mascotLabel')} /></div>
        </div>
      </section>
      <section aria-labelledby="missions-title" className="stack" style={{ gap: 16 }}>
        <h2 id="missions-title" className="sr-only">{t('home.missions')}</h2>
        <ul className="grid3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {missions.map(([route, k, color], i) => (
            <li key={k}>
              <a className="card mission-link" href={`#${route}`} onClick={(e) => { e.preventDefault(); go(route); }}>
                <span className="numdot" style={{ background: color }} aria-hidden="true">{i + 1}</span>
                <span className="title-font">{t(`${k}.title`)}</span>
                <span style={{ color: 'var(--card-muted)' }}>{t(`${k}.teaser`)}</span>
                <span className="sr-only">{t('home.missionN', { n: i + 1 })}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function App() {
  const [lang, setLangState] = useState(() => initialLang(savedLang(), urlLang()));
  const [route, setRoute] = useState(readRoute);
  const t = useMemo(() => makeT(lang), [lang]);
  const mainRef = useRef(null);
  const first = useRef(true);

  const setLang = (l) => setLangState(l);
  useEffect(() => { document.documentElement.lang = htmlLang(lang); saveLang(lang); document.title = t('app.title'); }, [lang, t]);
  // ?lang= is applied (also when only the hash changes) and then removed from the address.
  useEffect(() => {
    const apply = () => {
      const l = urlLang();
      if (l) setLangState(l);
      try { const clean = withoutLangParam(location.href); if (clean !== location.href) history.replaceState(null, '', clean); } catch { /* old browser */ }
      setRoute(readRoute());
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  // A new screen starts at the top, with the focus on its main area (screen readers hear the new page).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [route]);

  const go = (r) => { if (location.hash !== `#${r}`) location.hash = r; else setRoute(readRoute()); };
  const value = { t, lang, setLang, route, go };
  // The quiz and the certificate share one screen (two columns on wide screens).
  const Page = { '/': Home, '/sun': SunMission, '/call': CallMission, '/battery': BatteryMission, '/quiz': Quiz, '/certificate': Quiz }[route] || Home;
  return (
    <Ctx.Provider value={value}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>{t('app.skip')}</a>
      <Stars />
      <div className="wrap">
        <Header />
        <main id="main" ref={mainRef} tabIndex={-1} style={{ outline: 'none' }}>
          <Page />
        </main>
        <Footer />
      </div>
    </Ctx.Provider>
  );
}
