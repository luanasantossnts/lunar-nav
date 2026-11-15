// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';

export function Loading({ label }) {
  const { t } = useApp();
  return <p role="status" className="text-sm text-muted p-4">{label || t('common.loading')}</p>;
}

export function ErrorBox({ message, onRetry }) {
  const { t } = useApp();
  return (
    <div role="alert" className="m-4 p-4 border border-warnline bg-warnbg text-warntext text-sm flex flex-wrap items-center gap-3 justify-between">
      <span>{t('common.error')}: {message}</span>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

/** States the horizon model in force for a result; never hides a missing terrain mask. */
export function HorizonNote({ provenance }) {
  const { t } = useApp();
  if (!provenance) return null;
  const h = provenance.horizon;
  const text = h.mode === 'terrain' ? t('common.terrainApplied') : (h.terrain === 'unavailable for this site' ? t('common.terrainUnavailable') : t('common.geometric'));
  return <span className={`text-xs ${h.terrain === 'unavailable for this site' ? 'text-warntext' : 'text-muted'}`}>{text}</span>;
}

export function LearnNote({ children }) {
  const { uiMode } = useApp();
  if (uiMode !== 'learn') return null;
  return <p className="text-[13px] leading-relaxed text-text2 border-l-2 border-sun pl-3">{children}</p>;
}
