// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useKids } from '../App.jsx';
import Certificate from '../components/Certificate.jsx';
import { MissionBar } from '../components/Frame.jsx';
import { PHASES, certificateReady } from '../lib/progress.js';

/** One certificate per phase: Cadet (quiz 5 of 5), Explorer and Commander (every mission of the phase done). */
export default function Certificates() {
  const { t, progress } = useKids();
  return (
    <div className="stack">
      <MissionBar />
      <div className="stack phase-intro no-print" style={{ gap: 10 }}>
        <h1>{t('certs.title')}</h1>
        <p style={{ fontSize: 20, maxWidth: '62ch' }}>{t('certs.intro')}</p>
      </div>
      <div className="grid3" style={{ alignItems: 'start' }}>
        {PHASES.map((p) => <Certificate key={p.id} phaseId={p.id} unlocked={certificateReady(progress, p.id)} />)}
      </div>
    </div>
  );
}
