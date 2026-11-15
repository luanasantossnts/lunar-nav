// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useKids } from '../App.jsx';
import Mascot from '../components/Mascot.jsx';
import { MissionNav } from '../components/Frame.jsx';

/** A printable "Junior Lunar Navigator" certificate. No name is asked for or stored. */
export default function Certificate() {
  const { t, lang } = useKids();
  const date = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <div className="stack">
      <p className="no-print">{t('cert.intro')}</p>
      <section className="certificate stack" aria-labelledby="cert-title" style={{ gap: 14 }}>
        <Mascot label={t('home.mascotLabel')} className="mascot seal" />
        <p className="small">{t('cert.top')}</p>
        <h1 id="cert-title" style={{ color: '#241a55' }}>Junior Lunar Navigator</h1>
        <p>{t('cert.text')}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontWeight: 800, color: '#2e2466', fontSize: 19 }}>
          <li>☆ {t('m1.title')}</li>
          <li>☆ {t('m2.title')}</li>
          <li>☆ {t('m3.title')}</li>
        </ul>
        <p className="small">{date} · Lunar Nav Kids · kids.lunarnav.space</p>
        <p className="small">{t('footer.data')}</p>
      </section>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => window.print()}>{t('cert.print')}</button>
      </div>
      <MissionNav />
    </div>
  );
}
