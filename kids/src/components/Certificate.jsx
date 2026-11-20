// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useKids } from '../App.jsx';
import { PHASES } from '../lib/progress.js';

/** Certificate seal: the Sun, Earth, the arc of the lunar horizon and a coral star. */
function Seal() {
  return (
    <svg className="seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="56" fill="#1e1b52" />
      <circle cx="42" cy="46" r="20" fill="#ffc94a" opacity="0.3" />
      <circle cx="42" cy="46" r="13" fill="#ffc94a" />
      <circle cx="80" cy="40" r="12" fill="#3ba7ff" />
      <path d="M73 37 q5 -7 10 -2 q2 5 -3 7z" fill="#7fe0b8" />
      <path d="M14 88 Q60 58 106 88" fill="none" stroke="#9e97d6" strokeWidth="8" strokeLinecap="round" />
      <path d="M60 70 l4.5 9 10 1.5 -7.2 7 1.7 10 -9 -4.7 -9 4.7 1.7 -10 -7.2 -7 10 -1.5z" fill="#ff7a59" />
    </svg>
  );
}

/** A closed padlock (the certificate is still locked). */
const LockIcon = () => (
  <svg className="seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <circle cx="60" cy="60" r="56" fill="#2a2668" />
    <path d="M42 54 v-10 a18 18 0 0 1 36 0 v10" fill="none" stroke="#c9c3e6" strokeWidth="9" strokeLinecap="round" />
    <rect x="34" y="52" width="52" height="40" rx="10" fill="#ffc94a" />
    <circle cx="60" cy="70" r="6" fill="#14123a" />
    <rect x="57" y="72" width="6" height="12" rx="3" fill="#14123a" />
  </svg>
);

/**
 * A "Junior Lunar Navigator" certificate for one phase (Cadet, Explorer, Commander). No name is asked
 * for. Locked: no print button, and the locked card is not printed. "Print" prints only this card.
 */
export default function Certificate({ phaseId, unlocked }) {
  const { t, lang } = useKids();
  const date = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const phase = PHASES.find((p) => p.id === phaseId);
  const titleId = `cert-title-${phaseId}`;
  const print = (e) => {
    const box = e.currentTarget.closest('.cert-block');
    document.body.classList.add('printing'); box?.classList.add('print-me');
    const done = () => { document.body.classList.remove('printing'); box?.classList.remove('print-me'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  };
  return (
    <section id={phaseId === 1 ? 'certificate' : `certificate-${phaseId}`} className="stack cert-block" aria-labelledby={titleId} style={{ gap: 14 }}>
      {unlocked ? (
        <>
          <div className="certificate">
            <Seal />
            <p className="label">CERTIFICATE</p>
            <h2 id={titleId}>Junior Lunar Navigator: {t(`phase.${phase.key}`)}</h2>
            <p>{t(`cert.text${phaseId}`)}</p>
            <p className="small">{date} · Lunar Nav Kids · kids.lunarnav.space</p>
            <p className="small">{t('footer.data')}</p>
          </div>
          <p className="no-print"><button type="button" className="btn big" onClick={print}>{t('cert.print')}</button></p>
        </>
      ) : (
        // Locked: no print button, and nothing to print (the .locked card is hidden on paper).
        <div className="certificate locked">
          <LockIcon />
          <p className="label">CERTIFICATE</p>
          <h2 id={titleId}>Junior Lunar Navigator: {t(`phase.${phase.key}`)}</h2>
          <p>{t(phaseId === 1 ? 'cert.locked' : 'cert.lockedPhase', { phase: t(`phase.${phase.key}`) })}</p>
        </div>
      )}
    </section>
  );
}

