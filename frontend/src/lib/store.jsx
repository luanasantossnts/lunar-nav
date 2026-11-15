// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, POWER_DEFAULTS } from './api.js';
import { detectLang, makeT } from './i18n.js';
import { parseDateInput } from './format.js';

const Ctx = createContext(null);

const storage = {
  get(k, d) { try { const v = localStorage.getItem('lunarnav.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lunarnav.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

/** Hash routing: #/route?key=value — the query carries the scenario, so links are shareable. */
function readHash() {
  const raw = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { route: path || '/', params: Object.fromEntries(new URLSearchParams(query)) };
}

/** Parameters that belong to a page, not to the scenario: kept when the scenario hash is rewritten. */
const PAGE_PARAMS = ['term', 'section'];

// Terrain (LOLA) by default: sites without a mask (e.g. Chandrayaan-3) fall back to the smooth
// sphere in the API, and the readouts say "terrain unavailable for this site".
export const DEFAULTS = { start: '2030-07-01', days: 30, mode: 'terrain', delay: 10, earthMargin: 0 };

/** Horizon mode from the URL (mode=geometric|terrain); anything else → the default. The user's choice wins. */
export const initialMode = (param) => (param === 'geometric' || param === 'terrain' ? param : DEFAULTS.mode);

export function AppProvider({ children }) {
  const initial = readHash().params;
  const [route, setRoute] = useState(readHash().route);
  const [lang, setLang] = useState(() => storage.get('lang', detectLang()));
  const [theme, setTheme] = useState(() => storage.get('theme', 'dark'));
  const [uiMode, setUiMode] = useState(() => storage.get('uiMode', 'technical'));
  const [sites, setSites] = useState([]);
  const [siteA, setSiteA] = useState(initial.a || null);
  const [siteB, setSiteB] = useState(initial.b || null);
  const [custom, setCustom] = useState(null);
  const [start, setStart] = useState(parseDateInput(initial.start || DEFAULTS.start));
  const [days, setDays] = useState(Number(initial.days) || DEFAULTS.days);
  const [horizonMode, setHorizonMode] = useState(initialMode(initial.mode));
  const [earthMargin, setEarthMargin] = useState(Number(initial.em) || DEFAULTS.earthMargin);
  const [delayDays, setDelayDays] = useState(Number(initial.delay) || DEFAULTS.delay);
  const [cursor, setCursor] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [results, setResults] = useState({ A: null, B: null, loading: false, error: null });
  const [terrain, setTerrain] = useState({});
  const [analystLog, setAnalystLog] = useState([]);
  const [reportNotes, setReportNotes] = useState([]);
  const [health, setHealth] = useState(null);
  // Illustrative power-model inputs, kept per browser; "reset" restores POWER_DEFAULTS.
  const [power, setPower] = useState(() => ({ ...POWER_DEFAULTS, ...storage.get('power', {}) }));
  useEffect(() => { storage.set('power', power); }, [power]);
  const reqId = useRef(0);

  const t = useMemo(() => makeT(lang), [lang]);

  useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light'); storage.set('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang; storage.set('lang', lang); }, [lang]);
  useEffect(() => { storage.set('uiMode', uiMode); }, [uiMode]);

  useEffect(() => {
    const on = () => setRoute(readHash().route);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    api.sites().then((r) => {
      setSites(r.sites);
      setSiteA((a) => a || r.default_pair[0]);
      setSiteB((b) => b || r.default_pair[1]);
    }).catch((e) => setResults((s) => ({ ...s, error: e.message })));
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const findSite = useCallback((id) => (id === 'custom' ? custom : sites.find((s) => s.id === id) || null), [sites, custom]);
  const A = findSite(siteA);
  const B = findSite(siteB);

  const load = useCallback(async () => {
    if (!A || !B) return;
    const id = ++reqId.current;
    setResults((s) => ({ ...s, loading: true, error: null }));
    // The position spread comes from terrain grids, so it is requested in terrain mode only.
    const o = { start, days, mode: horizonMode, earthMargin, series: true, spread: horizonMode === 'terrain', power };
    try {
      const [ra, rb] = await Promise.all([api.metrics(A, o), api.metrics(B, o)]);
      if (id !== reqId.current) return;
      setResults({ A: ra, B: rb, loading: false, error: null });
      setCursor((c) => (c && c >= start && c <= start + days * 86400 ? c : start + Math.round(days * 86400 * 0.33)));
    } catch (e) {
      if (id !== reqId.current) return;
      setResults((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [A, B, start, days, horizonMode, earthMargin, power]);

  useEffect(() => { load(); }, [load]);

  // Terrain masks for the Sky view, fetched once per catalogue site.
  useEffect(() => {
    [A, B].filter(Boolean).forEach((s) => {
      if (s.id === 'custom' || terrain[s.id] !== undefined) return;
      setTerrain((m) => ({ ...m, [s.id]: null }));
      api.terrain(s).then((r) => setTerrain((m) => ({ ...m, [s.id]: r }))).catch(() => {});
    });
  }, [A, B, terrain]);

  // Playback: one stay in about 40 s; respects reduced motion.
  useEffect(() => {
    if (!playing) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setPlaying(false); return undefined; }
    const span = days * 86400;
    let last = performance.now();
    let raf;
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setCursor((c) => {
        const base = c ?? start;
        const next = base + (span / 40) * dt;
        return next > start + span ? start : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, start, days]);

  const scenarioQuery = useMemo(() => {
    const p = new URLSearchParams({ a: siteA || '', b: siteB || '', start: new Date(start * 1000).toISOString().slice(0, 10), days: String(days), mode: horizonMode, delay: String(delayDays) });
    if (earthMargin) p.set('em', String(earthMargin));
    return p.toString();
  }, [siteA, siteB, start, days, horizonMode, delayDays, earthMargin]);

  const go = useCallback((r) => { location.hash = `#${r}?${scenarioQuery}`; }, [scenarioQuery]);
  /** Like go(), plus page-only parameters (Help ?term=, Methodology ?section=). */
  const goWith = useCallback((r, extra) => {
    const p = new URLSearchParams(scenarioQuery);
    Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
    location.hash = `#${r}?${p.toString()}`;
  }, [scenarioQuery]);

  useEffect(() => {
    const { route: r, params } = readHash();
    const p = new URLSearchParams(scenarioQuery);
    PAGE_PARAMS.forEach((k) => { if (params[k]) p.set(k, params[k]); });
    const next = `#${r}?${p.toString()}`;
    if (location.hash !== next) history.replaceState(null, '', next);
  }, [scenarioQuery]);

  const value = {
    t, lang, setLang, theme, setTheme, uiMode, setUiMode, route, go, goWith,
    sites, siteA, siteB, setSiteA, setSiteB, A, B, custom, setCustom,
    start, setStart, days, setDays, horizonMode, setHorizonMode, earthMargin, setEarthMargin, delayDays, setDelayDays,
    cursor, setCursor, playing, setPlaying, results, reload: load, terrain,
    analystLog, setAnalystLog, reportNotes, setReportNotes, health, power, setPower,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
