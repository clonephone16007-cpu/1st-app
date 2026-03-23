// ─── Hidden Markov Model: Study State Detector ───────────────────────────────
// Models study state as a hidden variable with 3 states:
//   0 = Peak       — long sessions, consistent, good mood
//   1 = Declining  — shorter sessions, irregular, mood dropping
//   2 = Burnout    — very short/no sessions, bad mood, skipping days
//
// Viterbi algorithm decodes the most likely hidden state sequence
// O(T × N²) where T=days, N=3 states
//
// CACHED: Results memoized by session count + mood key count to avoid
// re-running Viterbi on every recompute when inputs haven't changed.

const N_STATES = 3;

const TRANSITIONS = [
  [0.80, 0.18, 0.02],
  [0.25, 0.60, 0.15],
  [0.10, 0.35, 0.55],
];

const INIT_PROBS = [0.50, 0.35, 0.15];

function emissionProb(state, obs) {
  const { durationBucket, moodScore, gapDays } = obs;

  const durationProbs = [
    [0.02, 0.06, 0.20, 0.40, 0.32],
    [0.15, 0.25, 0.35, 0.20, 0.05],
    [0.50, 0.30, 0.15, 0.04, 0.01],
  ];

  const moodProbs = [
    [0.05, 0.25, 0.70],
    [0.20, 0.50, 0.30],
    [0.55, 0.35, 0.10],
  ];

  const gapPenalty = gapDays > 3
    ? [0.2, 0.7, 1.2][state]
    : [1.0, 1.0, 1.0][state];

  const p = durationProbs[state][durationBucket] *
            moodProbs[state][moodScore] *
            gapPenalty;

  return Math.max(p, 1e-10);
}

function buildObservations(sessions, mood, days = 21) {
  const observations = [];
  const now = new Date();

  let prevDayWithSession = null;

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    const dayStr = date.toISOString().split('T')[0];

    const totalMins = sessions
      .filter(s => (s.date || '').startsWith(dayStr))
      .reduce((acc, s) => acc + (s.mins || 0), 0);

    let durationBucket;
    if (totalMins === 0)       durationBucket = 0;
    else if (totalMins < 30)   durationBucket = 1;
    else if (totalMins < 60)   durationBucket = 2;
    else if (totalMins < 120)  durationBucket = 3;
    else                       durationBucket = 4;

    const dayMood = mood[dayStr];
    let moodScore;
    if (!dayMood)                              moodScore = 1;
    else if (dayMood === '😩' || dayMood === '😴') moodScore = 0;
    else if (dayMood === '😐')                  moodScore = 1;
    else                                        moodScore = 2;

    let gapDays = 0;
    if (totalMins > 0 && prevDayWithSession !== null) {
      gapDays = d - prevDayWithSession;
    } else if (totalMins === 0 && prevDayWithSession !== null) {
      gapDays = d - prevDayWithSession;
    }
    if (totalMins > 0) prevDayWithSession = d;

    observations.push({ dayStr, durationBucket, moodScore, gapDays, totalMins });
  }

  return observations;
}

function viterbi(observations) {
  const T = observations.length;
  if (T === 0) return { states: [], currentState: 0, trajectory: [] };

  const delta = Array.from({ length: T }, () => new Array(N_STATES).fill(0));
  const psi   = Array.from({ length: T }, () => new Array(N_STATES).fill(0));

  for (let s = 0; s < N_STATES; s++) {
    delta[0][s] = Math.log(INIT_PROBS[s]) + Math.log(emissionProb(s, observations[0]));
    psi[0][s] = 0;
  }

  for (let t = 1; t < T; t++) {
    for (let s = 0; s < N_STATES; s++) {
      let maxVal = -Infinity;
      let maxState = 0;
      for (let prev = 0; prev < N_STATES; prev++) {
        const val = delta[t - 1][prev] + Math.log(TRANSITIONS[prev][s]);
        if (val > maxVal) { maxVal = val; maxState = prev; }
      }
      delta[t][s] = maxVal + Math.log(emissionProb(s, observations[t]));
      psi[t][s] = maxState;
    }
  }

  const states = new Array(T);
  states[T - 1] = delta[T - 1].indexOf(Math.max(...delta[T - 1]));
  for (let t = T - 2; t >= 0; t--) {
    states[t] = psi[t + 1][states[t + 1]];
  }

  return { states, currentState: states[T - 1] };
}

// ─── Cache ────────────────────────────────────────────────────────────────────
let _cachedResult = null;
let _cacheKey = '';

function getCacheKey(sessions, mood) {
  // Fast cache key: session count + last session date + mood key count
  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1].date : '';
  return `${sessions.length}|${lastSession}|${Object.keys(mood || {}).length}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────
const STATE_LABELS = ['Peak', 'Declining', 'Burnout'];
const STATE_COLORS = { Peak: 'green', Declining: 'amber', Burnout: 'red' };
const STATE_DESCRIPTIONS = {
  Peak: 'Your study rhythm is excellent. Maintain this consistency.',
  Declining: 'Study sessions are getting shorter. Time to re-engage before it becomes a habit.',
  Burnout: 'Study patterns suggest burnout. Consider a structured rest day, then restart with shorter sessions.',
};

export function detectStudyState(sessions, mood) {
  if (sessions.length < 3) {
    return {
      currentState: 0,
      label: 'Peak',
      color: STATE_COLORS['Peak'],
      description: STATE_DESCRIPTIONS['Peak'],
      trajectory: [],
      daysInCurrentState: 0,
      recommendation: null,
    };
  }

  // Check cache — avoid re-running Viterbi if inputs unchanged
  const key = getCacheKey(sessions, mood);
  if (_cachedResult && _cacheKey === key) {
    return _cachedResult;
  }

  const observations = buildObservations(sessions, mood || {}, 21);
  const { states, currentState } = viterbi(observations);

  let daysInCurrentState = 1;
  for (let i = states.length - 2; i >= 0; i--) {
    if (states[i] === currentState) daysInCurrentState++;
    else break;
  }

  const label = STATE_LABELS[currentState];

  let recommendation = null;
  if (currentState === 1 && daysInCurrentState >= 3) {
    recommendation = `You've been in Declining state for ${daysInCurrentState} days. Try a 90-minute focused session today.`;
  } else if (currentState === 2) {
    recommendation = daysInCurrentState >= 5
      ? 'Take a planned rest day today, then restart with 45-minute sessions tomorrow.'
      : 'Start with one short (30-min) session today to rebuild momentum.';
  }

  const result = {
    currentState,
    label,
    color: STATE_COLORS[label],
    description: STATE_DESCRIPTIONS[label],
    trajectory: states.map((s, i) => ({
      dayStr: observations[i]?.dayStr,
      state: s,
      label: STATE_LABELS[s],
    })),
    daysInCurrentState,
    recommendation,
  };

  _cachedResult = result;
  _cacheKey = key;

  return result;
}

export const burnoutEngine = { detectStudyState };
