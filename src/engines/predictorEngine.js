// ─── Kalman Filter + Monte Carlo AIR Predictor ──────────────────────────────
//
// The Kalman Filter models "true ability" as a hidden state observed through
// noisy mock exam scores. It maintains a running estimate with uncertainty.
//
// State:  x = true ability (score units)
// Obs:    z = recorded mock score (noisy measurement of x)
// Q = process noise (ability grows over time)
// R = measurement noise (exam conditions, luck, etc.)

// JEE/CET approximate score percentile tables (curvefitted to historical data)
// Maps normalised score [0,1] to approximate AIR (out of total candidates)
const EXAM_PERCENTILE_TABLES = {
  jee: {
    totalCandidates: 1100000,
    // [pctScore, approxAIR] — log-linear interpolation between points
    curve: [
      [1.00, 1],      [0.99, 100],    [0.98, 500],
      [0.95, 2000],   [0.90, 8000],   [0.85, 18000],
      [0.80, 35000],  [0.70, 90000],  [0.60, 200000],
      [0.50, 400000], [0.40, 600000], [0.00, 1100000],
    ],
    totalMarks: 360,
  },
  cet: {
    totalCandidates: 500000,
    curve: [
      [1.00, 1],      [0.99, 50],     [0.95, 500],
      [0.90, 3000],   [0.85, 10000],  [0.80, 25000],
      [0.70, 70000],  [0.60, 150000], [0.50, 250000],
      [0.00, 500000],
    ],
    totalMarks: 200,
  },
  met: {
    totalCandidates: 50000,
    curve: [
      [1.00, 1],     [0.95, 50],    [0.90, 200],
      [0.80, 1000],  [0.70, 3000],  [0.60, 8000],
      [0.00, 50000],
    ],
    totalMarks: 400,
  },
  ugee: {
    totalCandidates: 20000,
    curve: [
      [1.00, 1],    [0.95, 20],   [0.90, 100],
      [0.80, 500],  [0.70, 1500], [0.60, 5000],
      [0.00, 20000],
    ],
    totalMarks: 180,
  },
};

// Interpolate AIR from score fraction
function scoreToAIR(scoreFraction, examId) {
  const table = EXAM_PERCENTILE_TABLES[examId];
  if (!table) return null;
  const curve = table.curve;
  const sf = Math.min(1, Math.max(0, scoreFraction));

  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, air1] = curve[i];
    const [p2, air2] = curve[i + 1];
    if (sf <= p1 && sf >= p2) {
      // Log-linear interpolation
      const t = (sf - p2) / (p1 - p2);
      return Math.round(Math.exp(Math.log(air2) + t * (Math.log(air1) - Math.log(air2))));
    }
  }
  return table.totalCandidates;
}

// ─── Kalman Filter ───────────────────────────────────────────────────────────
function runKalmanFilter(scoreList, totalMarks) {
  if (!scoreList || scoreList.length === 0) return null;

  // Normalize scores to [0,1]
  const obs = scoreList.map(s => s.score / totalMarks);

  // Tuned noise params for exam preparation context
  const Q = 0.002;   // Process noise: ability grows slowly but steadily
  const R = 0.025;   // Measurement noise: ±5% variation from luck/conditions

  let x = obs[0];          // Initial state = first score
  let P = 0.05;            // Initial uncertainty

  const estimates = [{ x, P, z: obs[0] }];

  for (let k = 1; k < obs.length; k++) {
    // Predict step
    const x_pred = x;          // We assume ability changes slowly (could add drift)
    const P_pred = P + Q;

    // Update step (Kalman gain)
    const K = P_pred / (P_pred + R);
    x = x_pred + K * (obs[k] - x_pred);
    P = (1 - K) * P_pred;

    estimates.push({ x, P, z: obs[k] });
  }

  return { estimates, finalX: x, finalP: P, Q, R };
}

// ─── Monte Carlo AIR Simulator ───────────────────────────────────────────────
// Samples N future score outcomes from the Kalman posterior distribution
// Maps each to an AIR to build a full rank distribution
//
// CACHED: Results memoized by mean score + variance + examId to avoid
// re-running 2000 samples on every render.
const _mcCache = new Map();
const MC_CACHE_MAX = 20;

function monteCarloAIR(meanScore, variance, totalMarks, examId, N = 2000) {
  // Cache key: round to 3 decimal places to avoid floating point noise
  const cacheKey = `${meanScore.toFixed(3)}|${variance.toFixed(4)}|${examId}`;
  if (_mcCache.has(cacheKey)) return _mcCache.get(cacheKey);

  const sigma = Math.sqrt(variance);
  const airSamples = [];

  // Box-Muller transform for Gaussian samples (no external lib needed)
  for (let i = 0; i < N; i += 2) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.sin(2 * Math.PI * u2);

    for (const z of [z0, z1]) {
      const score = Math.min(1, Math.max(0, meanScore + z * sigma));
      const air = scoreToAIR(score, examId);
      if (air !== null) airSamples.push(air);
    }
  }

  airSamples.sort((a, b) => a - b);

  const p10 = airSamples[Math.floor(airSamples.length * 0.10)];
  const p50 = airSamples[Math.floor(airSamples.length * 0.50)];
  const p90 = airSamples[Math.floor(airSamples.length * 0.90)];

  const result = { p10, p50, p90, samples: airSamples };

  // Evict oldest entries if cache grows too large
  if (_mcCache.size >= MC_CACHE_MAX) {
    const firstKey = _mcCache.keys().next().value;
    _mcCache.delete(firstKey);
  }
  _mcCache.set(cacheKey, result);

  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function predictPercentile(scores, examId) {
  const examData = EXAM_PERCENTILE_TABLES[examId];
  const examScores = scores[examId] || [];

  if (examScores.length < 2) {
    return { predicted: null, low: null, high: null, trend: 'Need more data' };
  }

  const totalMarks = examData?.totalMarks || 360;
  const sorted = [...examScores].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Run Kalman Filter
  const kalman = runKalmanFilter(sorted, totalMarks);
  if (!kalman) return null;

  const { finalX, finalP } = kalman;
  const predictedRaw = Math.round(finalX * totalMarks);
  const low = Math.round(Math.max(0, (finalX - 2 * Math.sqrt(finalP)) * totalMarks));
  const high = Math.round(Math.min(totalMarks, (finalX + 2 * Math.sqrt(finalP)) * totalMarks));

  // Trend: compare last 3 Kalman estimates
  const ests = kalman.estimates;
  let trend = 'Stable';
  if (ests.length >= 3) {
    const recent = ests.slice(-3).map(e => e.x);
    const slope = (recent[2] - recent[0]) / 2;
    if (slope > 0.008)  trend = 'Upward';
    else if (slope < -0.008) trend = 'Downward';
  }

  // Monte Carlo AIR distribution
  let airEstimate = null;
  if (examData) {
    const mc = monteCarloAIR(finalX, finalP + kalman.R, totalMarks, examId);
    airEstimate = { optimistic: mc.p10, median: mc.p50, pessimistic: mc.p90 };
  }

  // Velocity: score change per session (Kalman-smoothed)
  const velocity = ests.length >= 2
    ? (ests[ests.length - 1].x - ests[0].x) / ests.length
    : 0;

  return {
    predicted: predictedRaw,
    low,
    high,
    trend,
    airEstimate,
    velocity: parseFloat((velocity * totalMarks).toFixed(1)),
    kalmanEstimates: ests.map(e => ({
      score: Math.round(e.x * totalMarks),
      uncertainty: Math.round(Math.sqrt(e.P) * totalMarks),
      observed: Math.round(e.z * totalMarks),
    })),
  };
}

// ─── Insights (uses real Kalman data) ───────────────────────────────────────
export function generateInsights(scores, chapters, sessions, eqLog) {
  const allScores = Object.entries(scores || {});
  if (allScores.length === 0) {
    return {
      strengths: 'No mock scores logged yet.',
      weaknesses: 'Log at least two mocks to get AI insights.',
      actionPlan: ['Log your first mock score in the Scores page.'],
    };
  }

  // Find best and worst performing exams by Kalman trend
  let bestExam = null, worstExam = null;
  let bestVelocity = -Infinity, worstVelocity = Infinity;

  for (const [examId, examScores] of allScores) {
    if (examScores.length < 2) continue;
    const result = predictPercentile(scores, examId);
    if (!result) continue;
    if (result.velocity > bestVelocity)  { bestVelocity = result.velocity; bestExam = examId; }
    if (result.velocity < worstVelocity) { worstVelocity = result.velocity; worstExam = examId; }
  }

  // Session pattern analysis
  const recentSessions = (sessions || []).slice(-14);
  const avgSessionMins = recentSessions.length > 0
    ? recentSessions.reduce((a, s) => a + s.mins, 0) / recentSessions.length
    : 0;

  const subjectMins = { Math: 0, Physics: 0, Chemistry: 0 };
  recentSessions.forEach(s => { if (subjectMins[s.subject] !== undefined) subjectMins[s.subject] += s.mins; });
  const leastStudied = Object.entries(subjectMins).sort((a, b) => a[1] - b[1])[0]?.[0] || 'Physics';

  const actionPlan = [
    avgSessionMins < 45
      ? 'Your average session is under 45 minutes — aim for 90+ minute deep work blocks.'
      : `Your avg session (${Math.round(avgSessionMins)}m) is solid. Focus on quality over quantity.`,
    worstExam
      ? `${worstExam.toUpperCase()} scores are declining — schedule a dedicated mock this week.`
      : 'Log at least 2 mocks per exam to enable trend analysis.',
    `${leastStudied} has the least study time recently. Rebalance your schedule.`,
  ];

  return {
    strengths: bestExam
      ? `Your ${bestExam.toUpperCase()} trajectory is improving (Kalman velocity: +${bestVelocity.toFixed(1)} marks/session). Keep the momentum.`
      : 'Keep logging mocks to build trend data.',
    weaknesses: worstExam && worstExam !== bestExam
      ? `${worstExam.toUpperCase()} shows a declining trend. Recent scores are lower than your Kalman baseline.`
      : `${leastStudied} is getting the least study time (${Math.round(subjectMins[leastStudied] / 60 * 10) / 10}h in last 2 weeks).`,
    actionPlan,
  };
}

export const predictorEngine = { predictPercentile, generateInsights, scoreToAIR };
