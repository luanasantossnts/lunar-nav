// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import ScenarioBar from '../components/ScenarioBar.jsx';
import PolarMap from '../components/PolarMap.jsx';
import SiteReadout from '../components/SiteReadout.jsx';
import PowerPanel from '../components/PowerPanel.jsx';
import Timeline from '../components/Timeline.jsx';
import ElevationChart from '../components/ElevationChart.jsx';
import { ErrorBox, LearnNote, Loading } from '../components/States.jsx';

export default function Planner() {
  const { t, results, reload, go, delayDays, A, B, siteName } = useApp();
  return (
    <>
      <h1 className="sr-only">{t('planner.h1', { a: A ? siteName(A) : '…', b: B ? siteName(B) : '…' })}</h1>
      <ScenarioBar />
      {results.error && <ErrorBox message={results.error} onRetry={reload} />}
      <div className="flex flex-wrap border-b border-line">
        <div className="flex-[999_1_460px] min-w-0 flex flex-col bg-bg2">
          <PolarMap />
          <div className="px-4 py-2 border-t border-line flex flex-wrap gap-2">
            <button type="button" className="btn !min-h-[36px] text-[13px]" onClick={() => go('/sky')}>{t('planner.sky')}</button>
          </div>
        </div>
        <aside aria-label={t('planner.siteConditions')} className="flex-[1_1_380px] border-l border-line flex flex-col">
          {results.loading && !results.A && <Loading />}
          <SiteReadout which="A" />
          <SiteReadout which="B" />
          <PowerPanel />
          <section className="px-4 py-4 flex flex-col gap-3">
            <LearnNote>{t('learn.polar')}</LearnNote>
            <LearnNote>{t('learn.libration')}</LearnNote>
            <button type="button" className="btn text-[13px] font-medium" style={{ borderColor: 'var(--alert)', color: 'var(--alert)' }} onClick={() => go('/compare')}>
              {t('planner.delayCta', { n: delayDays })}
            </button>
            <button type="button" className="btn text-[13px]" onClick={() => go('/analyst')}>{t('planner.analystNote')}</button>
          </section>
        </aside>
      </div>
      <Timeline />
      <div className="border-t border-line"><ElevationChart which="A" /></div>
    </>
  );
}
