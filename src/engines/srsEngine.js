// ─── FSRS v4.5 ─────────────────────────────────────────────────────────────
// Free Spaced Repetition Scheduler — state-of-the-art, beats SM-2 by ~20%
// Paper: https://github.com/open-spaced-repetition/fsrs4anki
// Two hidden variables per card: S (stability) and D (difficulty)
// Memory model: R(t) = e^(-t/S) — retrievability after t days

const FSRS_WEIGHTS = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589,
  1.5330, 0.1544, 1.0040, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407,
  2.9466, 0.5034, 0.6567
];

const DECAY = -0.5;
const FACTOR = 0.9 ** (1 / DECAY) - 1;
const DESIRED_RETENTION = 0.9;
const MAX_INTERVAL = 36500;

// Compute new interval from S and desired retention
function nextInterval(stability) {
  const interval = (stability / FACTOR) * (DESIRED_RETENTION ** (1 / DECAY) - 1);
  return Math.min(Math.round(interval), MAX_INTERVAL);
}

// Initial stability after first review (by rating 1-4)
function initialStability(rating) {
  return Math.max(FSRS_WEIGHTS[rating - 1], 0.1);
}

// Initial difficulty (0-10 scale)
function initialDifficulty(rating) {
  const d = FSRS_WEIGHTS[4] - Math.exp(FSRS_WEIGHTS[5] * (rating - 1)) + 1;
  return Math.min(Math.max(d, 1), 10);
}

// Mean reversion: pull D toward base difficulty
function meanReversion(base, current) {
  return FSRS_WEIGHTS[7] * base + (1 - FSRS_WEIGHTS[7]) * current;
}

// Update difficulty after a review
function updateDifficulty(D, rating) {
  const nextD = D - FSRS_WEIGHTS[6] * (rating - 3);
  return Math.min(Math.max(meanReversion(FSRS_WEIGHTS[4], nextD), 1), 10);
}

// Short-term stability (recalled cards, within same day)
function shortTermStability(S, rating) {
  return S * Math.exp(FSRS_WEIGHTS[17] * (rating - 3 + FSRS_WEIGHTS[18]));
}

// Recall: card was remembered
function recallStability(D, S, R, rating) {
  const hardPenalty = rating === 2 ? FSRS_WEIGHTS[15] : 1;
  const easyBonus  = rating === 4 ? FSRS_WEIGHTS[16] : 1;
  return (
    S *
    (Math.exp(FSRS_WEIGHTS[8]) *
      (11 - D) *
      Math.pow(S, -FSRS_WEIGHTS[9]) *
      (Math.exp((1 - R) * FSRS_WEIGHTS[10]) - 1) *
      hardPenalty *
      easyBonus +
      1)
  );
}

// Forget: card was NOT remembered
function forgetStability(D, S, R) {
  return (
    FSRS_WEIGHTS[11] *
    Math.pow(D, -FSRS_WEIGHTS[12]) *
    (Math.pow(S + 1, FSRS_WEIGHTS[13]) - 1) *
    Math.exp((1 - R) * FSRS_WEIGHTS[14])
  );
}

// ─── Current retrievability for a card
function getRetrievability(card) {
  if (!card.dueDate || !card.stability || card.reps === 0) return 0;
  const lastReview = new Date(card.lastReview || card.dueDate);
  const daysSince = (Date.now() - lastReview.getTime()) / 86400000;
  return Math.pow(1 + FACTOR * (daysSince / card.stability), DECAY);
}

// ─── Core rating function ───────────────────────────────────────────────────
export function rateCard(card, rating, bktRetention = null) {
  const isNew = !card.reps || card.reps === 0;
  const now = new Date();

  let S = card.stability || 0;
  let D = card.difficulty || 0;
  let reps = card.reps || 0;

  if (isNew) {
    S = initialStability(rating);
    D = initialDifficulty(rating);
    reps = 1;
  } else {
    const R = getRetrievability(card);
    D = updateDifficulty(D, rating);
    if (rating === 1) {
      S = forgetStability(D, S, R);
    } else {
      S = recallStability(D, S, R, rating);
    }
    reps += 1;
  }

  S = Math.max(S, 0.1);
  let interval = nextInterval(S);
  
  // Algorithm interconnection: BKT constraints SRS interval
  // If the overarching knowledge model says we don't know the chapter well,
  // do not let the micro-level flashcard interval expand too far.
  if (bktRetention !== null && bktRetention < 0.4) {
    interval = Math.min(interval, 2); // Force short interval (max 2 days)
  }
  
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + (rating === 1 ? 0 : interval));

  // Keep backward-compat ease field for any legacy code reading it
  const ease = Math.max(1.3, 2.5 + (D - 5) * -0.1);

  return {
    ...card,
    stability: parseFloat(S.toFixed(4)),
    difficulty: parseFloat(D.toFixed(4)),
    interval,
    ease: parseFloat(ease.toFixed(2)),
    reps,
    dueDate: dueDate.toISOString(),
    lastReview: now.toISOString(),
  };
}

// ─── Due cards — FSRS orders by urgency (lowest R first) ───────────────────
export function getDueCards(flashcards) {
  const now = new Date().toISOString();
  return flashcards
    .filter(c => !c.dueDate || c.dueDate <= now)
    .sort((a, b) => getRetrievability(a) - getRetrievability(b));
}

// ─── Public helpers ─────────────────────────────────────────────────────────
export function getCardRetrievability(card) {
  return getRetrievability(card);
}

export function getCardDueDate(card) {
  if (!card.dueDate) return null;
  return new Date(card.dueDate);
}

// Projected retention if reviewed today (for display)
export function getProjectedRetention(card, daysAhead = 0) {
  if (!card.stability) return 0;
  const t = daysAhead;
  return Math.pow(1 + FACTOR * (t / card.stability), DECAY);
}

export const srsEngine = { getDueCards, rateCard, getRetrievability, getCardRetrievability, getProjectedRetention };
