// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Methodology §5: how AI is used. The analyst is Claude only; read-aloud and speech input
 * are ElevenLabs (the browser's own speech is the fallback for read-aloud). `health` is kept
 * in the signature for callers; the lines no longer depend on it.
 */
export function aiLines(t, health) { // eslint-disable-line no-unused-vars
  return [t('method.aiAnalyst'), t('method.aiVoice'), t('method.aiMic'), ...t('method.aiItems')];
}
