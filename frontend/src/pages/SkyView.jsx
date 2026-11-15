// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { lazy, Suspense, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { bodyStatus } from '../lib/visibility.js';
import { coord, isoMin, fixed } from '../lib/format.js';
import SkyPanorama from '../components/SkyPanorama.jsx';
import { Label } from '../components/HelpLink.jsx';
import Timeline from '../components/Timeline.jsx';
import { statusWord } from '../components/SiteReadout.jsx';
import { ErrorBox, HorizonNote, LearnNote, Loading } from '../components/States.jsx';

const Terrain3D = lazy(() => import('../components/Terrain3D.jsx'));

export default function SkyView() {
  const { t, results, terrain, cursor, earthMargin, go, reload } = useApp();
  const [which, setWhich] = useState('A');
  const [tab, setTab] = useState('panorama');
  const [present, setPresent] = useState(false);
  const r = results[which];
  const mask = r && r.provenance.horizon.mode === 'terrain' ? terrain[r.site.id]?.mask : null;
  const sNow = r?.series && cursor ? bodyStatus(r.series.sun, mask, cursor) : null;
  const eNow = r?.series && cursor ? bodyStatus(r.series.earth, mask, cursor, earthMargin) : null;

  return (
    <div className={present ? 'fixed inset-0 z-50 bg-bg overflow-auto' : ''}>
      <div className="no-print flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
        <h1 className="m-0 text-sm font-semibold">{r ? t('sky.title', { site: r.site.name }) : t('nav.sky')}</h1>
        {r && <span className="font-mono text-xs text-muted">{coord(r.site.lat, r.site.lon)}</span>}
        <span className="flex-grow" />
        <div className="seg" role="group" aria-label={t('sky.siteGroup')}>
          <button type="button" aria-pressed={which === 'A'} onClick={() => setWhich('A')}><span style={{ color: 'var(--sun)' }}>A</span></button>
          <button type="button" aria-pressed={which === 'B'} onClick={() => setWhich('B')}><span style={{ color: 'var(--earth)' }}>B</span></button>
        </div>
        <div className="seg" role="group" aria-label={t('sky.viewGroup')}>
          <button type="button" aria-pressed={tab === 'panorama'} onClick={() => setTab('panorama')}>{t('sky.panorama')}</button>
          <button type="button" aria-pressed={tab === '3d'} onClick={() => setTab('3d')}>{t('sky.terrain3d')}</button>
        </div>
        <button type="button" className="btn !min-h-[36px] text-[13px]" onClick={() => setPresent(!present)}>{present ? t('common.close') : t('sky.present')}</button>
      </div>
      {results.error && <ErrorBox message={results.error} onRetry={reload} />}
      {!r && results.loading && <Loading />}
      {r && (
        <div className="px-4 py-4 flex flex-col gap-3">
          {tab === 'panorama'
            ? <div className="border border-line bg-bg2 p-2"><SkyPanorama result={r} mask={mask} refMask={terrain[r.site.id]?.mask} height={present ? 640 : 520} /></div>
            : (
              <Suspense fallback={<Loading />}>
                {r.site.id !== 'custom' && r.terrain?.heightmap
                  ? <Terrain3D site={r.site} result={r} mask={terrain[r.site.id]?.mask} />
                  : <p className="text-sm text-muted">{t('sky.noTerrain')}</p>}
              </Suspense>
            )}
          <div className="flex flex-wrap items-stretch border border-line">
            <div className="px-4 py-2.5 border-r border-line">
              <div className="text-[11px] text-dim">{t('common.time')}</div>
              <div className="font-mono text-sm">{isoMin(cursor)}</div>
            </div>
            <div className="px-4 py-2.5 border-r border-line min-w-[180px]">
              <div className="text-[11px] text-dim"><Label k="common.sun" /></div>
              <div className="font-mono text-sm" style={{ color: 'var(--sun)' }}>{statusWord(t, sNow)} {sNow ? `· ${fixed(sNow.el, 2)}°` : ''}</div>
            </div>
            <div className="px-4 py-2.5 border-r border-line min-w-[180px]">
              <div className="text-[11px] text-dim"><Label k="common.earth" /></div>
              <div className="font-mono text-sm" style={{ color: 'var(--earth)' }}>{statusWord(t, eNow)} {eNow ? `· ${fixed(eNow.el, 2)}°` : ''}</div>
            </div>
            {mask && sNow && (
              <div className="px-4 py-2.5 border-r border-line">
                <div className="text-[11px] text-dim"><Label k="sky.skyline" /> @ {fixed(sNow.az, 2)}°</div>
                <div className="font-mono text-sm">{fixed(sNow.sky, 2)}°</div>
              </div>
            )}
            <button type="button" className="tap ml-auto px-4 text-[13px]" style={{ color: 'var(--earth)' }} onClick={() => go('/analyst')}>{t('sky.why')}</button>
          </div>
          <HorizonNote provenance={r.provenance} />
          <LearnNote>{t('learn.terrain')}</LearnNote>
          <LearnNote>{t('learn.libration')}</LearnNote>
        </div>
      )}
      <div className="border-t border-line"><Timeline /></div>
    </div>
  );
}
