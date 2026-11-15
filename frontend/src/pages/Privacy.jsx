// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';

const REPO = 'https://github.com/luanasantossnts/lunar-nav';

/** Privacy & Terms: who is responsible, what data, why, with whom, rights (LGPD), terms of use. */
export default function Privacy() {
  const { t } = useApp();
  const sections = t('privacy.sections');
  return (
    <div className="w-full max-w-[860px] mx-auto px-4 md:px-8 py-10 flex flex-col gap-8">
      <div>
        <h1 className="m-0 text-[30px] font-semibold tracking-tight">{t('privacy.title')}</h1>
        <p className="m-0 mt-2 text-sm text-muted">{t('privacy.updated')}</p>
        <p className="m-0 mt-3 text-[15px] leading-relaxed text-text2">{t('privacy.intro')}</p>
      </div>
      {sections.map(([heading, items], i) => (
        <section key={heading} aria-labelledby={`privacy-${i}`} className="flex flex-col gap-2 border-t border-line2 pt-5">
          <h2 id={`privacy-${i}`} className="m-0 text-[17px] font-semibold">{heading}</h2>
          <ul className="m-0 pl-5 flex flex-col gap-1.5 text-[15px] leading-relaxed text-text2">
            {items.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </section>
      ))}
      <p className="m-0 text-sm">
        <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">{t('privacy.contactLink')}</a>
        {' · '}
        <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">{t('privacy.licenseLink')}</a>
      </p>
    </div>
  );
}
