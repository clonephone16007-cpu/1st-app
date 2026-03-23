// ─── useEngineContext ─────────────────────────────────────────────────────────
// THE single hook that runs all algorithms once and shares results everywhere.
// Every page imports this instead of calling engines individually.
// One change in data → everything downstream reacts automatically.

import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exams } from '../data/exams';
import { chapters as chapterDefs } from '../data/chapters';
import { predictorEngine } from '../engines/predictorEngine';
import { schedulerEngine } from '../engines/schedulerEngine';
import { decayEngine, getBKTKnowledge, getRetention, getAlerts } from '../engines/decayEngine';
import { burnoutEngine } from '../engines/burnoutEngine';
import { adaptiveEngine } from '../engines/adaptiveEngine';
import { ghostEngine } from '../engines/ghostEngine';
import { computeGrindIndex } from '../engines/grindEngine';
import { getDueCards } from '../engines/srsEngine';

// ─── resolveChapter: merges static def with user overrides ────────────────────
// Call this everywhere instead of using chapterDefs directly.
export function resolveChapter(def, overrides = {}) {
  const ov = overrides[def.id];
  if (!ov) return def;
  return {
    ...def,
    jeeWeight: ov.customWeight ?? def.jeeWeight,
    tier: ov.tier ?? def.tier,
    _overridden: true,
    _personalNote: ov.personalNote ?? null,
  };
}

export function resolveChapters(overrides = {}) {
  return chapterDefs.map(d => resolveChapter(d, overrides));
}

// ─── Smart phase: time + Kalman velocity + completion ratio ───────────────────
function computeSmartPhase(daysToExam, subjectVelocity, completionRatio, scores) {
  if (daysToExam <= 0) return 'Exam Day';
  if (daysToExam < 14) return 'Final Sprint';

  // Velocity score: negative velocity = urgency bump
  const velScores = Object.values(subjectVelocity);
  const avgVel = velScores.length ? velScores.reduce((a, b) => a + b, 0) / velScores.length : 0;
  const declineCount = velScores.filter(v => v < -0.5).length;

  // Base phase from days
  let base = daysToExam <= 30 ? 2 : daysToExam <= 60 ? 3 : 4;
  // Bump up urgency if declining scores or low completion
  if (declineCount >= 2) base = Math.max(1, base - 1);
  if (completionRatio < 0.3 && daysToExam <= 45) base = Math.max(1, base - 1);

  const phases = ['Final Sprint', 'Final Sprint', 'Revision Phase', 'Intensive Phase', 'Foundation Phase'];
  return phases[base] ?? 'Foundation Phase';
}

// ─── Subject Kalman velocity from predictorEngine ─────────────────────────────
function computeSubjectVelocity(scores) {
  const subjects = { Math: null, Physics: null, Chemistry: null };
  // Map exam scores to subject velocities via Kalman estimates
  const examSubjectMap = {
    jee:  { Math: 100, Physics: 100, Chemistry: 100 },
    cet:  { Math: 100, Physics: 50,  Chemistry: 50  },
    met:  { Math: 80,  Physics: 60,  Chemistry: 60  },
    ugee: { Math: 60,  Physics: 45,  Chemistry: 45  },
  };
  const vel = { Math: 0, Physics: 0, Chemistry: 0 };
  const counts = { Math: 0, Physics: 0, Chemistry: 0 };

  Object.entries(scores || {}).forEach(([examId, examScores]) => {
    if ((examScores || []).length < 2) return;
    const result = predictorEngine.predictPercentile(scores, examId);
    if (!result?.velocity) return;
    const subjectWeights = examSubjectMap[examId] || {};
    const total = Object.values(subjectWeights).reduce((a, b) => a + b, 0) || 1;
    Object.entries(subjectWeights).forEach(([subj, w]) => {
      vel[subj] += result.velocity * (w / total);
      counts[subj]++;
    });
  });

  return {
    Math:      counts.Math      > 0 ? vel.Math      / counts.Math      : 0,
    Physics:   counts.Physics   > 0 ? vel.Physics   / counts.Physics   : 0,
    Chemistry: counts.Chemistry > 0 ? vel.Chemistry / counts.Chemistry : 0,
  };
}

// ─── Study Debt ───────────────────────────────────────────────────────────────
function computeStudyDebt(sessions, dailyTargetHours, days = 14) {
  let debt = 0;
  const now = new Date();
  for (let d = 1; d <= days; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    const dayStr = date.toISOString().split('T')[0];
    const dayMins = sessions
      .filter(s => (s.date || '').startsWith(dayStr))
      .reduce((acc, s) => acc + (s.mins || 0), 0);
    const dayHours = dayMins / 60;
    debt += Math.max(0, dailyTargetHours - dayHours);
  }
  return parseFloat(debt.toFixed(1));
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useEngineContext() {
  const { sessions, chapters, scores, flashcards, mood, settings, wins } = useAppStore();
  const apiKey = settings?.geminiApiKey ?? '';
  const hasAI = apiKey.trim().length > 0;

  return useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    // FIX: chapterOverrides now lives inside settings (not top-level state)
    const resolvedDefs = resolveChapters(settings?.chapterOverrides ?? {});

    // ── Exam timeline ──────────────────────────────────────────────────────
    const activeExams = exams.filter(e => settings.activeExams?.includes(e.id));
    const examTimelines = activeExams.map(e => {
      const targetDate = settings.examDates?.[e.id] || e.date;
      const diff = new Date(targetDate).getTime() - now.getTime();
      const days = Math.max(0, Math.floor(diff / 86400000));
      return { ...e, date: targetDate, daysLeft: days };
    });
    const nearestExam = examTimelines.reduce((a, b) => a.daysLeft < b.daysLeft ? a : b, examTimelines[0] ?? { daysLeft: 999 });
    const daysToExam = nearestExam?.daysLeft ?? 999;

    // ── Score velocity per subject ─────────────────────────────────────────
    const subjectVelocity = computeSubjectVelocity(scores);

    // ── Completion ratio ───────────────────────────────────────────────────
    const totalChapters = resolvedDefs.length;
    const doneChapters = Object.values(chapters).filter(c => c.done).length;
    const completionRatio = totalChapters > 0 ? doneChapters / totalChapters : 0;

    // ── Smart phase ────────────────────────────────────────────────────────
    const smartPhase = computeSmartPhase(daysToExam, subjectVelocity, completionRatio, scores);

    // ── Subject BKT averages ───────────────────────────────────────────────
    const subjectBKT = { Math: 0, Physics: 0, Chemistry: 0 };
    const subjectBKTCounts = { Math: 0, Physics: 0, Chemistry: 0 };
    resolvedDefs.forEach(def => {
      const state = chapters[def.id];
      if (state?.done && subjectBKT[def.subject] !== undefined) {
        subjectBKT[def.subject] += getBKTKnowledge(state, def.subject);
        subjectBKTCounts[def.subject]++;
      }
    });
    Object.keys(subjectBKT).forEach(s => {
      subjectBKT[s] = subjectBKTCounts[s] > 0 ? subjectBKT[s] / subjectBKTCounts[s] : 0.5;
    });

    // ── Urgency multiplier (0.8 → 1.5 as exam approaches) ─────────────────
    const urgencyMultiplier = daysToExam <= 14
      ? 1.5 : daysToExam <= 30
      ? 1.3 : daysToExam <= 60
      ? 1.1 : 0.9;

    // ── Burnout state ──────────────────────────────────────────────────────
    let burnoutState = null;
    try { burnoutState = burnoutEngine.detectStudyState(sessions, mood); } catch {}

    // ── Decay alerts ───────────────────────────────────────────────────────
    const decayAlerts = getAlerts(chapters, resolvedDefs).slice(0, 6);

    // ── KST Frontier + score-aware knapsack ────────────────────────────────
    const completedIds = Object.entries(chapters).filter(([, s]) => s.done).map(([id]) => id);
    const studyDebtForPlan = computeStudyDebt(sessions, settings.dailyTargetHours || 8);
    const dailyPlan = schedulerEngine.generateDailyPlan(chapters, resolvedDefs, sessions, settings, studyDebtForPlan, burnoutState, decayAlerts);
    const kstFrontier = schedulerEngine.getKSTFrontier(completedIds, resolvedDefs);

    // ── Ghost data (urgency-aware) ─────────────────────────────────────────
    const ghostData = ghostEngine.getGhostData(sessions, settings, subjectBKT, completionRatio, urgencyMultiplier, daysToExam);

    // ── Grind index ────────────────────────────────────────────────────────
    const grindIndex = computeGrindIndex(sessions, chapters, scores, mood, settings);

    // ── SRS due cards ──────────────────────────────────────────────────────
    const dueCards = getDueCards(flashcards).length;

    // ── Study debt ─────────────────────────────────────────────────────────
    const studyDebt = computeStudyDebt(sessions, settings.dailyTargetHours || 8);

    // ── Thompson subject suggestion ────────────────────────────────────────
    const suggestedSubject = adaptiveEngine.recommendSubject(sessions, scores, chapters, subjectVelocity, studyDebt);
    const subjectProfiles = adaptiveEngine.getSubjectProfile(sessions, scores, chapters);

    // ── Today stats ────────────────────────────────────────────────────────
    const todayMins = sessions.filter(s => (s.date || '').startsWith(todayStr))
      .reduce((acc, s) => acc + (s.mins || 0), 0);
    const todayHours = todayMins / 60;

    // ── AI context string (for AI prompts) ─────────────────────────────────
    const aiContext = JSON.stringify({
      daysToExam,
      smartPhase,
      subjectVelocity,
      subjectBKT,
      burnoutState: burnoutState ? { label: burnoutState.label, days: burnoutState.daysInCurrentState } : null,
      completionRatio: Math.round(completionRatio * 100) + '%',
      studyDebt,
      todayHours: todayHours.toFixed(1),
      dailyTarget: settings.dailyTargetHours,
      grindScore: grindIndex.score,
      examTimelines: examTimelines.map(e => ({ name: e.name, daysLeft: e.daysLeft })),
    });

    return {
      // Raw data (pass-through)
      sessions, chapters, scores, flashcards, mood, settings, wins,
      resolvedDefs,
      // Computed
      examTimelines, nearestExam, daysToExam,
      subjectVelocity, subjectBKT, urgencyMultiplier,
      smartPhase, completionRatio,
      burnoutState, kstFrontier, dailyPlan, decayAlerts,
      ghostData, grindIndex, dueCards, studyDebt,
      suggestedSubject, subjectProfiles,
      todayStr, todayMins, todayHours,
      // AI
      hasAI, aiContext,
    };
  // Stable deps: serialize only what actually changes the output
  }, [
    sessions.length,
    // Chapters: count of done chapters (not full stringify)
    Object.values(chapters).filter(c => c.done).length,
    Object.keys(chapters).length,
    // Scores: total count across all exams
    Object.values(scores).reduce((a, v) => a + v.length, 0),
    flashcards.length,
    // FIX: wins.length was missing — adding/removing a win now correctly
    // invalidates the memoized result
    wins.length,
    // Mood: only last entry
    Object.keys(mood).sort().slice(-1)[0],
    settings.dailyTargetHours,
    settings.activeExams?.join(','),
    JSON.stringify(settings.examDates || {}),
    // Overrides: count (now correctly reads from settings.chapterOverrides)
    Object.keys(settings.chapterOverrides || {}).length,
    settings.geminiApiKey?.length > 0,
    settings.aiProvider,
  ]);
}
