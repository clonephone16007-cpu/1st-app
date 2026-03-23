// ─── Grind Index — Enhanced with BKT + Burnout state ────────────────────────
// Composite score 0–1000 combining:
//   30% — Study hours today vs target
//   20% — Streak consistency
//   15% — Chapters completed this week
//   10% — Mock exam logged this week
//   10% — Mood signal
//   10% — Average BKT knowledge across done chapters
//    5% — Burnout state penalty (HMM)

import { getBKTKnowledge } from './decayEngine';
import { detectStudyState } from './burnoutEngine';

export function computeGrindIndex(sessions, chapters, scores, mood, settings) {
  const todayStr = new Date().toISOString().split('T')[0];

  // ── 1. Hours today (30%) ─────────────────────────────────────────────────
  const todayMins = sessions
    .filter(s => s.date && s.date.startsWith(todayStr))
    .reduce((acc, s) => acc + (s.mins || 0), 0);
  const hoursToday = todayMins / 60;
  const hoursRatio = Math.min(hoursToday / (settings.dailyTargetHours || 8), 1);

  // ── 2. Streak (20%) ──────────────────────────────────────────────────────
  const sessionDates = [
    ...new Set(sessions.map(s => s.date?.split('T')[0]).filter(Boolean)),
  ].sort().reverse();

  let streak = 0;
  const checkDate = new Date();
  for (let i = 0; i < 60; i++) {
    const dStr = checkDate.toISOString().split('T')[0];
    if (sessionDates.includes(dStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (i === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  const streakRatio = Math.min(streak / 30, 1);

  // ── 3. Chapters done this week (15%) ─────────────────────────────────────
  const weekAgo = Date.now() - 7 * 86400000;
  const chaptersThisWeek = Object.values(chapters)
    .filter(c => c.done && c.doneAt && c.doneAt > weekAgo).length;
  const chaptersRatio = Math.min(chaptersThisWeek / 10, 1);

  // ── 4. Mock logged this week (10%) ────────────────────────────────────────
  const hasMock = Object.values(scores).some(examScores =>
    examScores.some(s => new Date(s.date).getTime() > weekAgo)
  );
  const mockRatio = hasMock ? 1 : 0;

  // ── 5. Mood (10%) ─────────────────────────────────────────────────────────
  const moodMap = { '😩': 0, '😴': 0.2, '😐': 0.5, '😊': 0.8, '🔥': 1.0 };
  const todayMood = mood[todayStr] || null;
  const moodRatio = todayMood !== null ? (moodMap[todayMood] ?? 0.5) : 0.5;

  // ── 6. BKT retention across done chapters (10%) ───────────────────────────
  const doneChapters = Object.entries(chapters).filter(([, c]) => c.done);
  let avgBKT = 0.5; // Default if no data
  if (doneChapters.length > 0) {
    const total = doneChapters.reduce((acc, [, state]) => {
      return acc + getBKTKnowledge(state, state.subject || 'Math');
    }, 0);
    avgBKT = total / doneChapters.length;
  }

  // ── 7. Burnout state penalty (5%) ─────────────────────────────────────────
  let burnoutBonus = 1.0;
  try {
    const burnoutState = detectStudyState(sessions, mood);
    if (burnoutState.currentState === 2) burnoutBonus = 0.0;      // Burnout = -5%
    else if (burnoutState.currentState === 1) burnoutBonus = 0.5;  // Declining = -2.5%
  } catch (e) {
    // Fail silently — burnout detection is non-critical
  }

  // ── Weighted composite → 0–1000 ───────────────────────────────────────────
  const rawScore =
    hoursRatio    * 0.30 +
    streakRatio   * 0.20 +
    chaptersRatio * 0.15 +
    mockRatio     * 0.10 +
    moodRatio     * 0.10 +
    avgBKT        * 0.10 +
    burnoutBonus  * 0.05;

  const score = Math.round(rawScore * 1000);

  // ── Label ─────────────────────────────────────────────────────────────────
  let label;
  if (score >= 850)       label = 'Elite';
  else if (score >= 700)  label = 'On Fire';
  else if (score >= 550)  label = 'Grinding';
  else if (score >= 400)  label = 'Building';
  else if (score >= 200)  label = 'Starting';
  else                    label = 'Off Track';

  // ── Delta from yesterday ───────────────────────────────────────────────────
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const yesterdayMins = sessions
    .filter(s => s.date && s.date.startsWith(yesterdayStr))
    .reduce((acc, s) => acc + (s.mins || 0), 0);
  const yesterdayHoursRatio = Math.min(
    yesterdayMins / 60 / (settings.dailyTargetHours || 8), 1
  );
  const yesterdayScore = Math.round(yesterdayHoursRatio * 0.30 * 1000);
  const delta = score - yesterdayScore;

  return { score, label, delta };
}
