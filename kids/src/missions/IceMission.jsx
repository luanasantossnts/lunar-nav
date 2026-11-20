// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useMemo, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { CENTRE, cellAt, gridCells, iceResult } from '../lib/missions.js';
import GridMap, { offsetText } from '../components/GridMap.jsx';
import { MissionBar, MissionStars, NextButton } from '../components/Frame.jsx';

/**
 * Mission 7 — Ice hunt at Malapert. Permanent shadow is explained with NASA PGDA's figure (20 % of the
 * spots within 300 m). The map is the real grid: sunny days in July 2030 per 100 m square; squares
 * with no Sun all of July 2030 are shown as such (not as permanent shadow). Ice: "there may be".
 */
export default function IceMission() {
  const { t, lang, award } = useKids();
  const cells = useMemo(() => gridCells('malapert_m1'), []);
  const [aim, setAim] = useState({ col: CENTRE, row: CENTRE });
  const [result, setResult] = useState(null);
  const aimCell = cellAt(cells, aim.col, aim.row);
  const psr = DATA.psr.malapert_m1.percent_300m;

  const choose = () => {
    const r = iceResult(cells, aim.col, aim.row);
    setResult({ ...r, cell: aimCell });
    award('ice', r.stars);
  };

  return (
    <div className="stack">
      <MissionBar id="ice" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m7.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m7.intro')}</p>
        <MissionStars id="ice" />
        <p className="scene-note">{t('m7.goals')}</p>
      </div>

      <section className="card stack" aria-labelledby="m7-what" style={{ gap: 10 }}>
        <h2 id="m7-what" style={{ fontSize: 26 }}>{t('m7.whatTitle')}</h2>
        <p>{t('m7.what')}</p>
        <p style={{ fontWeight: 800, color: 'var(--card-ink)' }}>{t('m7.pgda', { n: kidNumber(psr, lang) })}</p>
      </section>

      <div className="grid2">
        <section className="panel stack" aria-labelledby="m7-map" style={{ gap: 14 }}>
          <h2 id="m7-map" style={{ fontSize: 26 }}>{t('m7.mapTitle')}</h2>
          <p id="m7-help" className="scene-note">{t('m7.help')}</p>
          <GridMap cells={cells} aim={aim} setAim={setAim} onConfirm={choose} showAll centreTarget={false}
            marks={result ? [{ col: result.cell.col, row: result.cell.row, key: 'pick' }] : []} label={t('m7.mapLabel')} describedBy="m7-help" />
          <p className="status" aria-live="polite">{t('m7.aim', { where: offsetText(t, aimCell.dx, aimCell.dy), n: kidNumber(aimCell.days, lang) })}</p>
          <p><button type="button" className="btn big" onClick={choose}>{t('m7.choose')}</button></p>
        </section>

        <section className="card stack" aria-labelledby="m7-result" style={{ gap: 12 }}>
          <h2 id="m7-result" style={{ fontSize: 26 }}>{t('m7.resultTitle')}</h2>
          <p role="status" style={{ fontSize: 20, color: 'var(--card-ink)', fontWeight: 800 }}>{result ? t(`m7.result.${result.kind}`) : t('m7.none')}</p>
          <div className="stack" style={{ gap: 6 }}>
            <p className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><span aria-hidden="true" style={{ width: 26, height: 18, borderRadius: 5, background: '#ffc94a', display: 'inline-block', flex: 'none' }} />{t('m7.legendSun')}</p>
            <p className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><span aria-hidden="true" style={{ width: 26, height: 18, borderRadius: 5, background: '#0d0b2b', border: '2px dashed #6e66b8', display: 'inline-block', flex: 'none' }} />{t('m7.legendDark')}</p>
          </div>
          <p className="scene-note" style={{ color: 'var(--card-muted)' }}>{t('m7.note')}</p>
        </section>
      </div>

      <NextButton to="/apollo" label={t('nav.next')} />
    </div>
  );
}
