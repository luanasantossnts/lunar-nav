// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { isoMin } from '../lib/format.js';

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
/** Horizons times ('2030-Jun-16 00:00', UT) as ISO with Z. */
const hz = (s) => {
  const m = /(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(s || ''));
  return m ? isoMin(Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5]) / 1000) : s;
};

/** Every number in Lunar Nav can be traced to these parameters. */
export default function Provenance({ provenance }) {
  const { t } = useApp();
  if (!provenance) return null;
  const p = provenance;
  const lines = [
    ['source', p.source],
    ['method', p.method_version],
    ['CENTER', p.horizons_params?.CENTER],
    ['SITE_COORD', p.horizons_params?.SITE_COORD],
    ['bodies', 'Sun 10, Earth 399'],
    ['QUANTITIES', `${p.horizons_params?.QUANTITIES}  APPARENT ${p.horizons_params?.APPARENT}`],
    ['ephemeris', `${hz(p.horizons_params?.START_TIME)} → ${hz(p.horizons_params?.STOP_TIME)}, step ${p.step_minutes} min`],
    ['nights', p.night_window ? `period ±${p.night_window.extended_days} d · ${p.night_window.note}` : undefined],
    ['horizon', `${p.horizon.mode} · ${p.horizon.terrain}${p.horizon.mask?.product ? ` · ${p.horizon.mask.product}` : ''}`],
    ['visibility', p.visibility],
    ['margins', `Sun ${p.margins_deg.sun}°, Earth ${p.margins_deg.earth}°`],
    ['DSN', p.dsn?.enabled
      ? `${p.dsn.stations.map((s) => `${s.id} ${s.complex}`).join(', ')} · Moon ≥ ${p.dsn.min_elevation_deg}° · step ${p.dsn.step_minutes} min`
      : 'off'],
    ['DSN coords', p.dsn?.enabled ? p.dsn.coordinates_url : undefined],
    ['power', p.power ? `${p.power.params.panel_w} W ${p.power.params.orientation}, load ${p.power.params.load_w} W, survival ${p.power.params.survival_w} W, DoD ${p.power.params.dod}, ${p.power.params.wh_per_kg} Wh/kg` : undefined],
    ['power model', p.power ? `${p.power.factor}; ${p.power.battery}` : undefined],
    ['computed', `${p.computed_at}${p.cached ? ' (cache)' : ''}`],
  ];
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-text2">{t('method.provenance')}</summary>
      <pre className="mt-2 p-3 bg-panel border-l-2 border-line2 font-mono text-xs leading-relaxed text-text2 overflow-x-auto whitespace-pre">
        {lines.map(([k, v]) => `${k.padEnd(11)} ${v ?? '—'}`).join('\n')}
      </pre>
    </details>
  );
}
