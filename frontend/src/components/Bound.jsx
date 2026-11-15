// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';

/**
 * Shows "≥" before a value that is only a minimum: the night (or gap) touches the start
 * or end of the analysed period and may continue beyond it.
 */
export default function Bound({ flag, gap = false, children }) {
  const { t } = useApp();
  if (!flag) return <>{children}</>;
  return <span title={t(gap ? 'common.lowerBoundGap' : 'common.lowerBound')} className="cursor-help whitespace-nowrap">≥{'\u00A0'}{children}</span>;
}
