// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { htmlLang, initialLang, makeT, saveLang, savedLang, urlLang, withoutLangParam } from './lib/lang.js';
import { clearProgress, loadProgress, saveProgress, withQuizPassed, withStars } from './lib/progress.js';
import Stars from './components/Stars.jsx';
import { Footer, Header } from './components/Frame.jsx';
import Home from './missions/Home.jsx';
import SunMission from './missions/SunMission.jsx';
import CallMission from './missions/CallMission.jsx';
import BatteryMission from './missions/BatteryMission.jsx';
import Quiz from './missions/Quiz.jsx';
import SlippedMission from './missions/SlippedMission.jsx';
import TargetMission from './missions/TargetMission.jsx';
import SeasonsMission from './missions/SeasonsMission.jsx';
import IceMission from './missions/IceMission.jsx';
import ApolloMission from './missions/ApolloMission.jsx';
import PlanMission from './missions/PlanMission.jsx';
import Certificates from './missions/Certificates.jsx';

const Ctx = createContext(null);
export const useKids = () => useContext(Ctx);

/** Hash routes (any query after "?" is ignored). */
const PAGES = {
  '/': Home,
  '/sun': SunMission, '/call': CallMission, '/battery': BatteryMission, '/quiz': Quiz, '/certificate': Quiz,
  '/slipped': SlippedMission, '/target': TargetMission, '/seasons': SeasonsMission,
  '/ice': IceMission, '/apollo': ApolloMission, '/plan': PlanMission,
  '/certificates': Certificates,
};
const readRoute = () => {
  const r = (location.hash.replace(/^#/, '').split('?')[0]) || '/';
  return PAGES[r] ? r : '/';
};

export default function App() {
  const [lang, setLangState] = useState(() => initialLang(savedLang(), urlLang()));
  const [route, setRoute] = useState(readRoute);
  // Progress (stars, quiz passed) lives only on this device.
  const [progress, setProgress] = useState(() => loadProgress());
  // Phases opened with "Play anyway" (this visit only, not saved).
  const [opened, setOpened] = useState(() => new Set());
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

  const award = useCallback((id, n) => setProgress((p) => { const next = withStars(p, id, n); if (next !== p) saveProgress(next); return next; }), []);
  const passQuiz = useCallback(() => setProgress((p) => { const next = withQuizPassed(p); if (next !== p) saveProgress(next); return next; }), []);
  const resetProgress = useCallback(() => { clearProgress(); setProgress(loadProgress()); setOpened(new Set()); }, []);
  const openPhase = useCallback((id) => setOpened((s) => new Set([...s, id])), []);

  const go = (r) => { if (location.hash !== `#${r}`) location.hash = r; else setRoute(readRoute()); };
  const value = { t, lang, setLang, route, go, progress, award, passQuiz, resetProgress, opened, openPhase };
  const Page = PAGES[route] || Home;
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
