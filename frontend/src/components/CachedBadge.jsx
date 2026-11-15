// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/** Discreet label on an Analyst answer that came from the answer cache (no new AI call). */
export default function CachedBadge({ entry, t }) {
  if (!entry?.cached) return null;
  return (
    <span data-testid="cached-badge" className="self-center px-1.5 py-0.5 text-[11px] text-muted border border-line2 rounded"
      title={entry.cached_at ? t('analyst.cachedTitle', { d: entry.cached_at }) : undefined}>
      {t('analyst.cachedAnswer')}
    </span>
  );
}
