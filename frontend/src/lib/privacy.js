// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * The one-time microphone notice: shown the first time speech input is used in this browser.
 * Remembered in localStorage (a preference, not tracking); if storage is unavailable
 * (private mode), the notice is simply shown every time.
 */
export const MIC_NOTICE_KEY = 'lunarnav.micNoticeSeen';

const local = () => { try { return window.localStorage; } catch { return null; } };

export function micNoticeNeeded(store = local()) {
  try { return store?.getItem(MIC_NOTICE_KEY) !== '1'; } catch { return true; }
}

export function markMicNoticeSeen(store = local()) {
  try { store?.setItem(MIC_NOTICE_KEY, '1'); } catch { /* private mode: shown again next time */ }
}

/** Everything the app keeps in the browser (for the Privacy page). No cookies, no analytics. */
export const BROWSER_KEYS = ['lunarnav.lang', 'lunarnav.theme', 'lunarnav.uiMode', 'lunarnav.power', MIC_NOTICE_KEY];
