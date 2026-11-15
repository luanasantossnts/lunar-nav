// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';

/** Context visualizations from NASA's Scientific Visualization Studio, credited and linked. */
export default function SvsContext({ topics, compact = false }) {
  const { t } = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => {
    let live = true;
    api.svs().then((r) => live && setItems(r.items || [])).catch(() => live && setItems([]));
    return () => { live = false; };
  }, []);
  if (!items || items.length === 0) return null;
  const shown = topics ? items.filter((i) => topics.includes(i.topic)) : items;
  return (
    <section aria-label={t('svs.title')} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[13px] font-semibold text-muted">{t('svs.title')}</h2>
        <span className="text-xs text-dim">{t('svs.credit')}</span>
      </div>
      {/* 1 column on phones, 2 on tablets, 3 from 1024 px (6 items → 3 + 3). */}
      <ul className="m-0 p-0 list-none grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((i) => (
          <li key={i.id} className="border border-line bg-bg2 hover:border-line2 transition-colors">
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full no-underline text-ink">
              {i.image
                ? <img src={i.image.url} alt={i.image.alt || i.title} lang="en" loading="lazy" className="block w-full aspect-video object-cover bg-bg" />
                : <div className="w-full aspect-video bg-bg flex items-center justify-center font-mono text-[11px] text-dim">SVS {i.id}</div>}
              <div className="p-3 flex flex-col gap-1">
                <span lang="en" className="text-[13px] font-medium leading-snug">{i.title}</span>
                {/* Title, summary and image text are quoted from NASA SVS as published (English). */}
                {!compact && i.summary && <span lang="en" className="text-xs text-text2 leading-relaxed">{i.summary}</span>}
                <span className="font-mono text-[11px] text-dim">SVS {i.id}{i.release_date ? ` · ${i.release_date}` : ''}{i.live ? '' : ` · ${t('svs.offline')}`}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
