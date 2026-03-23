// ─── Bayesian Knowledge Tracing (BKT) ──────────────────────────────────────
// Standard 4-parameter HMM used in Khan Academy and Cognitive Tutor
// Models knowledge of each chapter as a hidden binary state: Known / Unknown
//
// Parameters (tuned for self-study in exam prep context):
//   P_L0  = P(know at start)            — prior knowledge before any study
//   P_T   = P(learn | unknown)          — probability of mastering per study event
//   P_G   = P(correct | unknown)        — guessing probability
//   P_S   = P(incorrect | known)        — slipping / forgetting probability

const BKT_DEFAULTS = {
  P_L0: 0.10,  // 10% chance of knowing before starting
  P_T:  0.20,  // 20% chance of learning per attempt
  P_G:  0.25,  // 25% guess rate
  P_S:  0.10,  // 10% slip rate
};

// Subject-specific parameters (more realistic priors)
const BKT_PARAMS = {
  Math:      { P_L0: 0.08, P_T: 0.18, P_G: 0.20, P_S: 0.12 },
  Physics:   { P_L0: 0.10, P_T: 0.20, P_G: 0.22, P_S: 0.10 },
  Chemistry: { P_L0: 0.12, P_T: 0.22, P_G: 0.28, P_S: 0.08 },
};

function getParams(subject) {
  return BKT_PARAMS[subject] || BKT_DEFAULTS;
}

// BKT update: given current P(L) and whether the response was correct
function bktUpdate(P_L, correct, params) {
  const { P_T, P_G, P_S } = params;
  // P(correct | known) = 1 - P_S, P(correct | unknown) = P_G
  const pCorrectGivenKnown   = 1 - P_S;
  const pCorrectGivenUnknown = P_G;

  let pLgivenObs;
  if (correct) {
    const pCorrect = P_L * pCorrectGivenKnown + (1 - P_L) * pCorrectGivenUnknown;
    pLgivenObs = (P_L * pCorrectGivenKnown) / pCorrect;
  } else {
    const pIncorrect = P_L * P_S + (1 - P_L) * (1 - P_G);
    pLgivenObs = (P_L * P_S) / pIncorrect;
  }

  // Apply learning transition: P(L_{n+1}) = P(L_n) + (1-P(L_n)) * P_T
  return pLgivenObs + (1 - pLgivenObs) * P_T;
}

// ─── Compute BKT P(Known) from chapter state ────────────────────────────────
// Chapter events feed BKT:
//   - marked done = correct response
//   - flashcard rated good/easy = correct
//   - flashcard rated again/hard = incorrect
//   - marked undone = negative signal
//   - decay since last review
export function getBKTKnowledge(chapterState, subject = 'Math', flashcardHistory = []) {
  const params = getParams(subject);
  let P_L = params.P_L0;

  if (!chapterState) return P_L;

  // If chapter was completed, that's a strong correct signal
  if (chapterState.done) {
    P_L = bktUpdate(P_L, true, params);
    // Confidence stars (1-5) provide additional signals
    const conf = chapterState.confidence || 0;
    for (let i = 0; i < conf; i++) {
      P_L = bktUpdate(P_L, true, params);
    }
  }

  // Flashcard ratings for this chapter
  flashcardHistory.forEach(rating => {
    const correct = rating >= 3; // Good or Easy = correct
    P_L = bktUpdate(P_L, correct, params);
  });

  // Explicit 'Needs Revision' flag drops retention severely
  if (chapterState.needsRevision) {
    P_L = bktUpdate(P_L, false, params);
    P_L = bktUpdate(P_L, false, params);
    P_L = bktUpdate(P_L, false, params);
  }

  // Apply temporal decay: knowledge fades without review
  // Based on days since last interaction (doneAt or lastReview)
  const lastInteraction = chapterState.doneAt || chapterState.lastReview;
  if (lastInteraction) {
    const daysSince = (Date.now() - lastInteraction) / 86400000;
    // Decay rate: lose ~1.5% per day on P(L), bounded to not go below prior
    const decayFactor = Math.exp(-0.015 * daysSince);
    const decayedP_L = params.P_L0 + (P_L - params.P_L0) * decayFactor;
    P_L = Math.max(decayedP_L, params.P_L0);
  }

  return Math.min(Math.max(P_L, 0), 1);
}

// ─── Retention (BKT-based, backward compatible) ─────────────────────────────
export function getRetention(chapterState, subject = 'Math', flashcardHistory = []) {
  if (!chapterState || !chapterState.done) return 0;
  return getBKTKnowledge(chapterState, subject, flashcardHistory);
}

// ─── Status labels ───────────────────────────────────────────────────────────
export function getStatus(retention) {
  if (retention >= 0.85) return 'fresh';
  if (retention >= 0.65) return 'good';
  if (retention >= 0.45) return 'stale';
  return 'fading';
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
export function getAlerts(chapters, chapterDefs) {
  const alerts = [];
  for (const def of chapterDefs) {
    const ch = chapters[def.id];
    if (ch && ch.done) {
      const ret = getRetention(ch, def.subject);
      const status = getStatus(ret);
      if (status === 'fading' || status === 'stale') {
        alerts.push({ ...def, status, retention: ret });
      }
    }
  }
  // Sort by most urgent first
  return alerts.sort((a, b) => a.retention - b.retention);
}

// ─── Recommend next review date ──────────────────────────────────────────────
export function getNextReviewDate(chapterState, subject = 'Math') {
  const P_L = getBKTKnowledge(chapterState, subject);
  // Review when P(L) is predicted to drop below 0.6
  // Using exponential model: days = -ln(0.6/P_L) / 0.015
  if (P_L <= 0.6) return 0; // Already below threshold — review now
  const days = -Math.log(0.6 / P_L) / 0.015;
  return Math.max(0, Math.round(days));
}

// ─── Legacy calculateDecay (keep for any code using it) ─────────────────────
export const decayEngine = {
  getRetention,
  getBKTKnowledge,
  getStatus,
  getAlerts,
  getNextReviewDate,
  calculateDecay: (confidence, lastReviewed) => {
    if (!lastReviewed) return 0;
    const daysSinceReview = (Date.now() - new Date(lastReviewed)) / 86400000;
    return Math.min(50, daysSinceReview * 5);
  }
};
