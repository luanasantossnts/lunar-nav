// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Progress for Lunar Nav Kids, kept only on this device (localStorage "lunarnav.kids.progress").
 * It holds stars (0–3) per mission and whether the Phase 1 quiz was passed — no name, nothing
 * personal, never sent anywhere. Every read and write is wrapped in try/catch (private mode or
 * blocked storage simply means no progress is kept).
 */
export const PROGRESS_KEY = 'lunarnav.kids.progress';

/** Phases and their missions (ids are also the routes, without the leading "/"). */
export const PHASES = [
  { id: 1, key: 'cadet', missions: ['sun', 'call', 'battery'] },
  { id: 2, key: 'explorer', missions: ['slipped', 'target', 'seasons'] },
  { id: 3, key: 'commander', missions: ['ice', 'apollo', 'plan'] },
];
export const MISSIONS = PHASES.flatMap((p) => p.missions);
export const missionNumber = (id) => MISSIONS.indexOf(id) + 1;
export const phaseOf = (id) => PHASES.find((p) => p.missions.includes(id));

export const EMPTY = Object.freeze({ v: 1, stars: {}, quiz: false });

/** Keeps only known missions with whole stars 0–3, and a boolean quiz flag (anything else is dropped). */
export function sanitize(raw) {
  const out = { v: 1, stars: {}, quiz: false };
  if (!raw || typeof raw !== 'object') return out;
  for (const id of MISSIONS) {
    const n = Number(raw.stars?.[id]);
    if (Number.isInteger(n) && n > 0) out.stars[id] = Math.min(3, n);
  }
  out.quiz = raw.quiz === true;
  return out;
}

const store = (s) => s ?? (typeof window !== 'undefined' ? window.localStorage : null);

export function loadProgress(storage) {
  try { return sanitize(JSON.parse(store(storage)?.getItem(PROGRESS_KEY) || 'null')); } catch { return sanitize(null); }
}
export function saveProgress(p, storage) {
  try { store(storage)?.setItem(PROGRESS_KEY, JSON.stringify(sanitize(p))); } catch { /* storage blocked */ }
}
export function clearProgress(storage) {
  try { store(storage)?.removeItem(PROGRESS_KEY); } catch { /* storage blocked */ }
}

/** Stars only go up: a better result replaces a worse one. */
export function withStars(p, id, n) {
  const cur = p.stars[id] || 0;
  const next = Math.max(0, Math.min(3, Math.floor(n)));
  if (!MISSIONS.includes(id) || next <= cur) return p;
  return { ...p, stars: { ...p.stars, [id]: next } };
}
export const withQuizPassed = (p) => (p.quiz ? p : { ...p, quiz: true });

/** A phase is complete when each of its missions has at least one star. */
export const phaseComplete = (p, phaseId) => PHASES.find((x) => x.id === phaseId).missions.every((m) => (p.stars[m] || 0) >= 1);
/** Phase 1 is always open; the next opens when the one before is complete. */
export const phaseUnlocked = (p, phaseId) => phaseId === 1 || phaseComplete(p, phaseId - 1);
/** Certificates: Cadet after the quiz with 5 of 5; Explorer and Commander when their phase is complete. */
export const certificateReady = (p, phaseId) => (phaseId === 1 ? p.quiz === true : phaseComplete(p, phaseId));
export const phaseStars = (p, phaseId) => PHASES.find((x) => x.id === phaseId).missions.reduce((a, m) => a + (p.stars[m] || 0), 0);
