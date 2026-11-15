// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { fixed, isoMin, plain } from '../lib/format.js';

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
/** Horizons times ('2030-Jun-16 00:00', UT) as ISO with Z. */
const hz = (s) => {
  const m = /(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(s || ''));
  return m ? isoMin(Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5]) / 1000) : s;
};
const TERRAIN_STATE = { applied: 'applied', 'not requested': 'notRequested', 'unavailable for this site': 'unavailable', grid: 'grid' };

/** Literal technical text (Horizons parameters, product names, URLs): kept as sent, marked English. */
const Lit = ({ children }) => <span lang="en">{children}</span>;

/**
 * Every number in Lunar Nav can be traced to these parameters. Labels and sentences are in the
 * reader's language; Horizons parameters and product names stay literal (lang="en").
 */
export default function Provenance({ provenance }) {
  const { t } = useApp();
  if (!provenance) return null;
  const p = provenance;
  const hp = p.horizons_params || {};
  const step = (n) => t('prov.step', { n });
  // Disc radii come inside the API's visibility sentence ("r = 0.267° Sun, 0.95° Earth").
  const r = /r = ([\d.]+)° Sun, ([\d.]+)° Earth/.exec(p.visibility || '');
  const pw = p.power?.params;
  const lines = [
    ['source', <Lit>{p.source}</Lit>],
    ['method', p.method_version],
    ['CENTER', <Lit>{hp.CENTER}</Lit>, true],
    ['SITE_COORD', <Lit>{hp.SITE_COORD}</Lit>, true],
    ['bodies', t('prov.bodies', { sun: p.bodies?.sun ?? '10', earth: p.bodies?.earth ?? '399' })],
    ['QUANTITIES', <Lit>{`${hp.QUANTITIES}  APPARENT ${hp.APPARENT}`}</Lit>, true],
    ['ephemeris', `${hz(hp.START_TIME)} → ${hz(hp.STOP_TIME)}, ${step(p.step_minutes)}`],
    ['nights', p.night_window ? t('prov.nights', { d: p.night_window.extended_days }) : undefined],
    ['horizon', <>{t(p.horizon.mode === 'terrain' ? 'common.terrain' : 'common.geometric')} · {t(`report.terrainState.${TERRAIN_STATE[p.horizon.terrain] || 'applied'}`)}{p.horizon.mask?.product ? <> · <Lit>{p.horizon.mask.product}</Lit></> : null}</>],
    ['visibility', r ? t('prov.visibility', { sun: plain(Number(r[1])), earth: plain(Number(r[2])) }) : <Lit>{p.visibility}</Lit>],
    ['margins', t('prov.margins', { sun: fixed(p.margins_deg.sun, 1), earth: fixed(p.margins_deg.earth, 1) })],
    ['DSN', p.dsn?.enabled
      ? <>{p.dsn.stations.map((s) => `${s.id} ${s.complex}`).join(', ')} · {t('prov.dsnMoon', { el: p.dsn.min_elevation_deg })} · {step(p.dsn.step_minutes)}</>
      : t('prov.off')],
    ['dsnCoords', p.dsn?.enabled ? <Lit>{p.dsn.coordinates_url}</Lit> : undefined],
    ['power', pw ? t('prov.power', { panel: pw.panel_w, orient: t(pw.orientation === 'horizontal' ? 'power.horizontal' : 'power.vertical'), load: pw.load_w, surv: pw.survival_w, dod: plain(pw.dod), whkg: pw.wh_per_kg }) : undefined],
    ['powerModel', pw ? `${t(pw.orientation === 'horizontal' ? 'prov.factorHorizontal' : 'prov.factorVertical')}; ${t('prov.battery')}` : undefined],
    ['computed', `${p.computed_at}${p.cached ? ` (${t('prov.cache')})` : ''}`],
  ];
  // Horizons parameter names are literal; the other labels are translated.
  const label = ([k, , literal]) => (literal ? k : t(`prov.labels.${k}`));
  const width = Math.max(...lines.map((l) => label(l).length)) + 1;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-text2">{t('method.provenance')}</summary>
      <pre className="mt-2 p-3 bg-panel border-l-2 border-line2 font-mono text-xs leading-relaxed text-text2 overflow-x-auto whitespace-pre">
        {lines.map((l, i) => (
          <span key={l[0]}>
            {l[2] ? <Lit>{label(l).padEnd(width)}</Lit> : label(l).padEnd(width)}
            {l[1] ?? '—'}
            {i < lines.length - 1 ? '\n' : ''}
          </span>
        ))}
      </pre>
    </details>
  );
}
