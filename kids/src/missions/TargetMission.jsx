// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useMemo, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { CENTRE, cellAt, gridCells, landingFrom, targetStars } from '../lib/missions.js';
import GridMap, { offsetText } from '../components/GridMap.jsx';
import { MissionBar, MissionStars, NextButton } from '../components/Frame.jsx';

/**
 * Mission 5 — Hit the target: aim at the Shackleton ridge and land. The landing lands up to 200 m
 * away (real landings can miss by hundreds of metres); the sunny days are the real grid value there.
 */
export default function TargetMission() {
  const { t, lang, award } = useKids();
  const cells = useMemo(() => gridCells('shackleton_ridge'), []);
  const [aim, setAim] = useState({ col: CENTRE, row: CENTRE });
  const [landings, setLandings] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const shown = useMemo(() => new Set(landings.map((l) => `${l.col},${l.row}`)), [landings]);
  const last = landings[landings.length - 1];
  const lastCell = last ? cellAt(cells, last.col, last.row) : null;
  const aimCell = cellAt(cells, aim.col, aim.row);
  const r300 = DATA.grids.shackleton_ridge.radius_300m;
  const days = (f) => Math.round(f * DATA.about.period.hours / 24);

  const land = () => {
    const spot = landingFrom(aim.col, aim.row);
    const c = cellAt(cells, spot.col, spot.row);
    setLandings((l) => [...l, { ...spot, key: `${l.length}` }]);
    award('target', targetStars(c.days));
  };

  return (
    <div className="stack">
      <MissionBar id="target" />
      <div className="stack" style={{ gap: 10 }}>
        <h1>{t('m5.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('m5.intro')}</p>
        <MissionStars id="target" />
        <p className="scene-note">{t('m5.goals')}</p>
      </div>

      <div className="grid2">
        <section className="panel stack" aria-labelledby="m5-map" style={{ gap: 14 }}>
          <h2 id="m5-map" style={{ fontSize: 26 }}>{t('m5.mapTitle')}</h2>
          <p id="m5-help" className="scene-note">{t('m5.help')}</p>
          <GridMap cells={cells} aim={aim} setAim={setAim} onConfirm={land} shown={shown} showAll={showAll}
            marks={last ? [{ ...last, key: 'last' }] : []} label={t('m5.mapLabel')} describedBy="m5-help" />
          <p className="status" aria-live="polite">{t('m5.aim', { where: offsetText(t, aimCell.dx, aimCell.dy) })}</p>
          <div className="row">
            <button type="button" className="btn big" onClick={land}>{t('m5.land')}</button>
            <button type="button" className="btn ghost small" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>{t('m5.showAll')}</button>
          </div>
        </section>

        <section className="card stack" aria-labelledby="m5-result" style={{ gap: 12 }}>
          <h2 id="m5-result" style={{ fontSize: 26 }}>{t('m5.resultTitle')}</h2>
          <div role="status">
            {lastCell ? (
              <div className="stack" style={{ gap: 8 }}>
                <p>{t('m5.landed', { where: offsetText(t, lastCell.dx, lastCell.dy) })}</p>
                <p className="big-number">{t('m5.days', { n: kidNumber(lastCell.days, lang) })}</p>
                <p>{t(`m5.stars${targetStars(lastCell.days)}`)}</p>
              </div>
            ) : <p>{t('m5.none')}</p>}
          </div>
          <p>{t('m5.miss')}</p>
          <p>{t('m5.range', { x: kidNumber(days(r300.sun_p10), lang), y: kidNumber(days(r300.sun_p90), lang) })}</p>
          <p className="scene-note">{t('m5.legend')}</p>
        </section>
      </div>

      <NextButton to="/seasons" label={t('nav.next')} />
    </div>
  );
}
