// ─── useDebriefSignals ────────────────────────────────────────────────────────
// Processes session debrief tap responses into algorithm signal shape.
// Used by Engine One (always available). Replaced by AI parsing in Engine Two.
//
// Signal shape (identical for both engines):
// {
//   bktSignals: [{ chapterId, correct: boolean }],
//   hmmObservation: { energy: 0|1|2 },
//   kalmanMicroUpdate: { direction: -1|0|1 },
//   thompsonUpdate: { subject, outcome: 'win'|'loss'|'neutral' },
// }

export function processDebriefSignals(debrief, session) {
  if (!debrief || !session) return null;

  // Clarity → BKT signal
  // clicked/okay = correct, confused/struggling = incorrect
  const clarityMap = {
    clicked: true,
    okay: true,
    confused: false,
    struggling: false,
  };
  const bktCorrect = clarityMap[debrief.clarity] ?? true;

  // Energy → HMM observation
  const energyMap = { high: 2, normal: 1, tired: 0 };
  const hmmEnergy = energyMap[debrief.energy] ?? 1;

  // Practice → Kalman micro-update
  // many = positive velocity, few = neutral, none = negative
  const practiceMap = { many: 1, few: 0, none: -1 };
  const kalmanDirection = practiceMap[debrief.practice] ?? 0;

  // Confidence → Thompson update
  // 4-5 = win, 3 = neutral, 1-2 = loss
  const confidence = debrief.confidence || 3;
  const thompsonOutcome = confidence >= 4 ? 'win' : confidence <= 2 ? 'loss' : 'neutral';

  return {
    bktSignals: [{ subject: session.subject, correct: bktCorrect }],
    hmmObservation: { energy: hmmEnergy },
    kalmanMicroUpdate: { direction: kalmanDirection },
    thompsonUpdate: { subject: session.subject, outcome: thompsonOutcome },
  };
}

export function useDebriefSignals() {
  return { processDebriefSignals };
}
