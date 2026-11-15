// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import SvsContext from '../components/SvsContext.jsx';
import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import Provenance from '../components/Provenance.jsx';
import { aiLines } from '../lib/aiStatus.js';
import { minus } from '../lib/format.js';

const STATUS_COLOR = {
  'integration tested': 'var(--earth)',
  'numerically verified': 'var(--sun)',
  'validated for scope': 'var(--sun)',
  failed: 'var(--alert)',
  error: 'var(--alert)',
  'needs smaller step': 'var(--alert)',
  'needs investigation': 'var(--alert)',
};

// Same set as REFERENCES.md (data and services, site coordinates); nothing that is not used.
const SOURCES = [
  ['JPL Horizons API', 'https://ssd-api.jpl.nasa.gov/doc/horizons.html'],
  ['JPL: lunar reference frames and DE440', 'https://ssd.jpl.nasa.gov/announcements/an20210929.html'],
  ['LOLA, PDS Geosciences Node', 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm'],
  ['LOLA DEM LDEM_80S_40M (PDS)', 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_40m.img'],
  ['LOLA DEM LDEM_75S_60M (PDS)', 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_60m.img'],
  ['NASA PGDA 69: Lunar Polar Illumination (Mazarico et al. 2011, Icarus 211)', 'https://pgda.gsfc.nasa.gov/products/69'],
  ['DSN 810-005, module 301 Rev. P: Coverage and Geometry', 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf'],
  ['NASA: Lunar South Pole Region (Moon Base)', 'https://www.nasa.gov/reference/moonbase-environment/'],
  ["NASA's Scientific Visualization Studio (SVS 5013, 4716, 4770, 4119, 5228)", 'https://svs.gsfc.nasa.gov/'],
  ['SVS 5127: Lunar South Pole Terrain in Coded Color (NASA Moon Base page)', 'https://svs.gsfc.nasa.gov/5127/'],
  ['LROC: Spacecraft Related Coordinates (2016)', 'https://www.lroc.im-ldi.com/images/938'],
  ['LROC: Shackleton–de Gerlache ridge', 'https://lroc.im-ldi.com/images/1247'],
  ['LROC: IM-2 landing region', 'https://lroc.im-ldi.com/images/1401'],
  ['LROC QuickMap', 'https://quickmap.lroc.asu.edu/'],
  ['Wikipedia: IM-1 (landing site)', 'https://en.wikipedia.org/wiki/IM-1'],
  ['Wikipedia: Peak of eternal light (Malapert)', 'https://en.wikipedia.org/wiki/Peak_of_eternal_light'],
  ['Wikipedia: Statio Shiv Shakti (Chandrayaan-3, citing ISRO)', 'https://en.wikipedia.org/wiki/Statio_Shiv_Shakti'],
  ['Giorgini et al. (1996), BAAS 28, 1158 (JPL Horizons)', null],
  ['Park et al. (2021), AJ 161:105 (DE440/DE441)', null],
  ['Smith et al. (2010), Space Sci. Rev. 150, 209–241 (LOLA)', null],
  ['Mazarico et al. (2011), Icarus 211, 1066–1081 (polar illumination)', null],
];

const p1 = (f) => (f === null || f === undefined ? '—' : `${(100 * f).toFixed(1)}%`);
const sgn = (d) => (d === null || d === undefined ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(1)}`);

/** Our model over a whole year vs NASA PGDA 69 (18.6-year averages), from the validation file. */
function PgdaTable({ check, siteName }) {
  const { t } = useApp();
  const d = check?.detail;
  if (!d?.rows) return null;
  return (
    <div className="mt-8 flex flex-col gap-3">
      <h3 className="m-0 text-[15px] font-semibold">{t('method.pgda.title', { year: d.year })}</h3>
      <p className="m-0 text-sm text-muted max-w-[70ch]">{t('method.pgda.intro')}</p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('method.pgda.title', { year: d.year })}>
        <table className="w-full min-w-[860px] border-collapse text-sm border-t border-line2">
          <thead><tr className="text-left text-xs text-muted">
            {['site', 'model', 'sunOurs', 'sunPgda', 'delta', 'sun300', 'earthOurs', 'earthPgda', 'delta'].map((k, i) => (
              <th key={i} scope="col" className="py-2.5 pr-3 font-medium border-b border-line">{t(`method.pgda.cols.${k}`)}</th>
            ))}
          </tr></thead>
          <tbody className="font-mono tabular">
            {d.rows.map((r) => (
              <tr key={r.site}>
                <th scope="row" className="py-2.5 pr-3 text-left font-sans font-normal border-b border-hair">{siteName(r.site)}</th>
                <td className="py-2.5 pr-3 border-b border-hair text-xs">{r.mode === 'terrain' ? `${t('common.terrain')} · ${r.dem_m} m` : t('common.geometric')} / PGDA {r.pgda_resolution_m} m</td>
                <td className="py-2.5 pr-3 border-b border-hair" style={{ color: 'var(--sun)' }}>{p1(r.ours.sun_first_limb)} <span className="text-dim">({p1(r.ours.sun_centre)})</span></td>
                <td className="py-2.5 pr-3 border-b border-hair">{p1(r.pgda.sun)}</td>
                <td className="py-2.5 pr-3 border-b border-hair" style={Math.abs(r.delta_points.sun) > 10 ? { color: 'var(--alert)' } : undefined}>{sgn(r.delta_points.sun)}</td>
                <td className="py-2.5 pr-3 border-b border-hair">{p1(r.ours.sun_first_limb_median_300m)} / {p1(r.pgda.sun_median_300m)} <span className="text-dim">({sgn(r.delta_points.sun_median_300m)})</span></td>
                <td className="py-2.5 pr-3 border-b border-hair" style={{ color: 'var(--earth)' }}>{p1(r.ours.earth_first_limb)} <span className="text-dim">({p1(r.ours.earth_centre)})</span></td>
                <td className="py-2.5 pr-3 border-b border-hair">{p1(r.pgda.earth)}</td>
                <td className="py-2.5 pr-3 border-b border-hair">{sgn(r.delta_points.earth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-sm">{t('method.pgda.ranking', { same: d.ranking.same ? t('method.pgda.yes') : t('method.pgda.no'), ours: d.ranking.ours.map(siteName).join(' > '), pgda: d.ranking.pgda.map(siteName).join(' > ') })}</p>
      <ul className="m-0 pl-5 flex flex-col gap-1 text-sm text-text2 max-w-[70ch]">{t('method.pgda.notes').map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

export default function Methodology() {
  const { t, results, sites, health } = useApp();
  const [v, setV] = useState(null);
  useEffect(() => { api.validation().then(setV).catch(() => setV({ status: 'not run', checks: [] })); }, []);
  // Help → References links here with ?section=sources.
  useEffect(() => {
    const sec = new URLSearchParams(location.hash.split('?')[1] || '').get('section');
    if (sec) requestAnimationFrame(() => document.getElementById(sec)?.scrollIntoView());
  }, []);
  const premises = t('method.p');
  // Validation checks carry a key and language-neutral params; the text is built here.
  // Older files (no key) and error messages fall back to the stored English text.
  const siteName = (id) => sites.find((s) => s.id === id)?.name || id;
  const known = (k) => typeof t(k) === 'string' && t(k) !== k;
  const checkName = (c) => (c.key && known(`validation.names.${c.key}`) ? t(`validation.names.${c.key}`, { ...c.params, site: siteName(c.params?.site) }) : c.name);
  // Results are built from stored numbers: negatives get a true minus sign (U+2212).
  const checkResult = (c) => minus(c.status !== 'error' && c.key && known(`validation.results.${c.key}`) ? t(`validation.results.${c.key}`, c.params) : c.result);
  return (
    <div className="w-full max-w-[980px] mx-auto px-6 py-10 flex flex-col gap-10">
      <div>
        <h1 className="m-0 text-[32px] font-semibold tracking-tight">{t('method.title')}</h1>
        <p className="m-0 mt-2.5 text-base leading-relaxed text-text2 max-w-[700px]">{t('method.intro')}</p>
      </div>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">1 · {t('method.premises')}</h2>
        <dl className="m-0 grid grid-cols-1 sm:grid-cols-[200px_1fr] border-t border-line2 text-[15px] leading-relaxed">
          {Object.values(premises).map(([k, d]) => (
            <div key={k} className="contents">
              <dt className="py-3 pr-4 border-b border-hair font-medium">{k}</dt>
              <dd className="m-0 py-3 border-b border-hair text-text2">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">2 · {t('method.limitsTitle')}</h2>
        <p className="m-0 mb-3 text-sm text-muted max-w-[700px]">{t('method.limitsIntro')}</p>
        <ul className="m-0 p-0 list-none border-t border-line2 text-[15px] leading-relaxed">
          {t('method.limits').map((x) => <li key={x} className="py-2.5 border-b border-hair text-text2">{x}</li>)}
        </ul>
      </section>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">3 · {t('method.validation')}</h2>
        {v && v.status === 'not run' && <p className="m-0 text-sm text-warntext">{t('method.notRun')}</p>}
        {v?.checks?.length > 0 && (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('method.validation')}>
            <table className="w-full min-w-[680px] border-collapse text-sm border-t border-line2">
              <thead><tr className="text-left text-xs text-muted">
                <th className="py-2.5 pr-3 font-medium border-b border-line">{t('method.check')}</th>
                <th className="p-2.5 font-medium border-b border-line">{t('method.status')}</th>
                <th className="py-2.5 pl-3 font-medium border-b border-line">{t('method.result')}</th>
              </tr></thead>
              <tbody>
                {v.checks.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-3 border-b border-hair">{checkName(c)}</td>
                    <td className="p-3 border-b border-hair font-mono text-xs" style={{ color: STATUS_COLOR[c.status] || 'var(--dim)' }}>{t(`validation.status.${c.status}`) === `validation.status.${c.status}` ? c.status : t(`validation.status.${c.status}`)}</td>
                    <td className="py-3 pl-3 border-b border-hair text-text2">{checkResult(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-dim mt-2">{v.generated_at} · {t('report.method', { v: v.method_version })}</p>
            <PgdaTable check={v.checks.find((c) => c.id === 'pgda_reference')} siteName={siteName} />
          </div>
        )}
      </section>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">4 · {t('method.provenance')}</h2>
        {results.A ? <Provenance provenance={results.A.provenance} /> : <p className="text-sm text-muted m-0">—</p>}
      </section>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">5 · {t('method.ai')}</h2>
        <ul className="m-0 pl-5 flex flex-col gap-2 text-[15px] leading-relaxed text-text2">
          {aiLines(t, health).map((x) => <li key={x}>{x}</li>)}
        </ul>
      </section>

      <SvsContext />

      <section id="sources" className="scroll-mt-24">
        <h2 className="m-0 mb-3 text-[13px] font-semibold text-muted">6 · {t('method.sources')}</h2>
        <ul className="m-0 pl-5 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {SOURCES.map(([n, u]) => <li key={n}>{u ? <a href={u} target="_blank" rel="noreferrer">{n}</a> : <span className="text-text2">{n}</span>}</li>)}
        </ul>
      </section>
    </div>
  );
}
