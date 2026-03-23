// ─── Thompson Sampling Multi-Armed Bandit ─────────────────────────────────────
// Models each subject (Math/Physics/Chemistry) as a "slot machine arm"
// Tracks Beta distribution parameters (α=wins, β=losses) per subject
// Thompson Sampling: draw from Beta(α, β) → pick arm with highest draw
//
// "Win" = session followed by score improvement or chapter completion
// "Loss" = session with no measurable progress
//
// Beta distribution sampling via Johnk's method (no external deps)

function betaSample(alpha, beta) {
  // Johnk's algorithm for Beta distribution sampling
  let u, v, x, y;
  do {
    u = Math.random();
    v = Math.random();
    x = Math.pow(u, 1 / alpha);
    y = Math.pow(v, 1 / beta);
  } while (x + y > 1);

  if (x + y === 0) return 0.5;
  return x / (x + y);
}

// Compute Beta parameters from session history
function computeBetaParams(sessions, scores, chapters, subject) {
  let alpha = 1; // Start with uniform prior (α=1, β=1)
  let beta  = 1;

  // Sessions for this subject
  const subjectSessions = sessions
    .filter(s => s.subject === subject)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // For each session, determine if it was a "win" or "loss"
  for (let i = 0; i < subjectSessions.length; i++) {
    const session = subjectSessions[i];
    const sessionDate = new Date(session.date);

    // Win signals:
    // 1. Session was long (>45 min = productive)
    const longSession = session.mins >= 45;

    // 2. A chapter in this subject was completed within 1 day after the session
    const nextDayEnd = new Date(sessionDate.getTime() + 86400000);
    const chapterDoneAfter = Object.entries(chapters).some(([id, state]) => {
      if (!state.done || !state.doneAt) return false;
      const doneAt = new Date(state.doneAt);
      return doneAt >= sessionDate && doneAt <= nextDayEnd;
    });

    // Loss signals:
    // Session was very short (<15 min = abandoned)
    const veryShort = session.mins < 15;

    if (longSession || chapterDoneAfter) {
      alpha += 1;
    } else if (veryShort) {
      beta += 1;
    }
    // Neutral sessions (15-45 min) don't update params
  }

  return { alpha, beta };
}

// ─── Thompson Sampling recommendation ─────────────────────────────────────────
export function recommendSubject(sessions, scores, chapters, subjectVelocity = {}, studyDebt = 0, exclude = []) {
  const subjects = ['Math', 'Physics', 'Chemistry'].filter(s => !exclude.includes(s));
  if (subjects.length === 0) return 'Math';
  if (subjects.length === 1) return subjects[0];
  
  // Algorithm interconnection: High study debt overrides optimization mode
  // and forces catch-up mode (highest weight * lowest recent time)
  if (studyDebt > 10) { // e.g., > 10 hours behind
    const recentTime = { Math: 0, Physics: 0, Chemistry: 0 };
    const twoDaysAgo = Date.now() - 48 * 3600000;
    sessions.forEach(s => {
      if (s.date && new Date(s.date).getTime() > twoDaysAgo) {
        recentTime[s.subject] = (recentTime[s.subject] || 0) + (s.mins || 0);
      }
    });
    
    // Sort subjects by least time spent recently
    return subjects.sort((a, b) => recentTime[a] - recentTime[b])[0];
  }

  // Compute Beta params for each subject

  // Compute Beta params for each subject
  const params = {};
  subjects.forEach(s => {
    params[s] = computeBetaParams(sessions, scores, chapters, s);
  });

  // Thompson Sampling: draw from each Beta distribution
  let bestSubject = subjects[0];
  let bestDraw = -Infinity;

  subjects.forEach(s => {
    let { alpha, beta } = params[s];
    
    // Algorithm interconnection: Thompson sampling reacts to Kalman velocity
    // Negative velocity = forced exploration boost (artificially increase beta)
    if (subjectVelocity[s] < -0.2) {
      beta += 5; // Strong penalty to push the sampler to explore this subject
    }

    const draw = betaSample(alpha, beta);
    if (draw > bestDraw) {
      bestDraw = draw;
      bestSubject = s;
    }
  });

  return bestSubject;
}

// ─── Subject performance profile ───────────────────────────────────────────────
export function getSubjectProfile(sessions, scores, chapters) {
  const subjects = ['Math', 'Physics', 'Chemistry'];
  return subjects.map(s => {
    const p = computeBetaParams(sessions, scores, chapters, s);
    const successRate = p.alpha / (p.alpha + p.beta);
    const sessions_count = sessions.filter(x => x.subject === s).length;
    return {
      subject: s,
      alpha: p.alpha,
      beta: p.beta,
      successRate: parseFloat(successRate.toFixed(3)),
      confidence: Math.min(p.alpha + p.beta, 20), // More data = more confidence
      sessions: sessions_count,
    };
  });
}

export const adaptiveEngine = {
  recommendSubject,
  getSubjectProfile,
  betaSample,
};
