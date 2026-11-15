// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { htmlLang, initialLang, makeT, saveLang, savedLang, urlLang, withoutLangParam } from './lib/lang.js';
import Stars from './components/Stars.jsx';
import Mascot from './components/Mascot.jsx';
import { Footer, Header } from './components/Frame.jsx';
import SunMission from './missions/SunMission.jsx';
import CallMission from './missions/CallMission.jsx';
import BatteryMission from './missions/BatteryMission.jsx';
import Quiz from './missions/Quiz.jsx';
import Certificate from './missions/Certificate.jsx';

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
  const missions = [['/sun', 'm1', '#ffc83d'], ['/call', 'm2', '#4fb3ff'], ['/battery', 'm3', '#5ee6a0']];
  return (
    <div className="stack">
      <section className="hello" aria-labelledby="hello-title">
        <Mascot label={t('home.mascotLabel')} />
        <div className="stack" style={{ gap: 14 }}>
          <h1 id="hello-title">{t('home.title')}</h1>
          <div className="bubble">
            <p>{t('home.say1')}</p>
            <p>{t('home.say2')}</p>
          </div>
        </div>
      </section>
      <section aria-labelledby="missions-title" className="stack" style={{ gap: 14 }}>
        <h2 id="missions-title">{t('home.missions')}</h2>
        <ul className="grid3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {missions.map(([route, k, color], i) => (
            <li key={k}>
              <a className="card mission-card" href={`#${route}`} onClick={(e) => { e.preventDefault(); go(route); }}>
                <MissionIcon kind={k} color={color} />
                <span className="num">{t('home.missionN', { n: i + 1 })}</span>
                <h3>{t(`${k}.title`)}</h3>
                <span>{t(`${k}.teaser`)}</span>
              </a>
            </li>
          ))}
        </ul>
        <p>
          <a className="btn ghost" href="#/quiz" onClick={(e) => { e.preventDefault(); go('/quiz'); }}>{t('home.quiz')} →</a>
        </p>
      </section>
    </div>
  );
}

/** Small pictures on the mission cards (decorative). */
function MissionIcon({ kind, color }) {
  return (
    <svg viewBox="0 0 300 120" aria-hidden="true" focusable="false">
      <rect width="300" height="120" rx="16" fill="#0a0e2e" />
      {kind === 'm1' && <><circle cx="200" cy="70" r="22" fill={color} /><circle cx="200" cy="70" r="36" fill={color} opacity="0.25" /></>}
      {kind === 'm2' && <><circle cx="150" cy="52" r="24" fill={color} /><path d="M136 46 q8 -12 18 -4 q5 8 -4 13 q-9 4 -14 -9z" fill="#4cd38a" /></>}
      {kind === 'm3' && (
        <g>
          <rect x="112" y="24" width="76" height="60" rx="10" fill="none" stroke={color} strokeWidth="6" />
          <rect x="188" y="44" width="10" height="20" rx="3" fill={color} />
          <rect x="120" y="32" width="38" height="44" rx="5" fill={color} />
        </g>
      )}
      <path d="M0 120 L0 92 Q40 70 80 88 T160 84 T240 90 T300 80 L300 120Z" fill="#8e86b5" />
      <path d="M0 120 L0 104 Q60 92 120 104 T240 100 T300 106 L300 120Z" fill="#5d5689" />
    </svg>
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
  const Page = { '/': Home, '/sun': SunMission, '/call': CallMission, '/battery': BatteryMission, '/quiz': Quiz, '/certificate': Certificate }[route] || Home;
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
