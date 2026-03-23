// ─── AI Configuration ─────────────────────────────────────────────────────────
// Every prompt receives a purpose-built context object — never the full aiContext.
// Each prompt has strict format + word limit + no-filler instructions.

export const AI_MODEL = 'gemini-2.0-flash';
export const AI_MAX_TOKENS = 512;

export const AI_FEATURES = {
  advisorExplainer:   true,
  timerDebrief:       true,
  chapterExplainer:   true,
  plannerNarrative:   true,
  settingsTuner:      true,
};

export const SYSTEM_PROMPT = `You are ExamHQ's study algorithm. You have access to the student's real performance data. Be direct and specific. Never be generic. Every response must reference at least one number from the data. Never use filler openers like "Great question", "Certainly", "As your study advisor". Never show your reasoning process. Respond only in the format specified. Shorter is better.`;

// ─── Purpose-built prompts ──────────────────────────────────────────────────

export const PROMPTS = {
  // Chapters — "Explain" button
  // Context: { chapterName, subject, tier, jeeWeight, bktRetention, daysToExam,
  //            prerequisiteChapters, unlocksChapters }
  chapterPrereqs: (ctx) =>
    `${SYSTEM_PROMPT}\n\n${JSON.stringify(ctx)}\n\nRespond in exactly 3 bullet points. Each bullet is one sentence. First bullet: prerequisite knowledge needed. Second bullet: what this chapter unlocks. Third bullet: the single most common mistake students make. Total response under 80 words. No intro sentence. Start directly with the first bullet.`,

  // Timer — Post-session debrief
  // Context: { sessionMins, subject, subjectBKT, subjectVelocity, daysToExam,
  //            nextRecommendedSubject, studyDebtHours }
  timerDebrief: (ctx) =>
    `${SYSTEM_PROMPT}\n\n${JSON.stringify(ctx)}\n\nRespond in exactly 2 sentences. First sentence acknowledges this session with one specific number. Second sentence tells exactly what to study next and why, referencing the velocity or BKT data. Under 40 words total. Never start with "Great" or "Well done" or any praise opener. Be direct.`,

  // Advisor — "Why?" per insight  
  // Context: { insightTitle, insightMessage, insightSeverity, relevantMetric, daysToExam }
  advisorExplain: (ctx) =>
    `${SYSTEM_PROMPT}\n\n${JSON.stringify(ctx)}\n\nRespond in exactly 2 sentences. First sentence explains why this specific alert is showing, naming the metric. Second sentence gives one concrete action to take today. Under 50 words. Never repeat the insight title back. Start with the explanation directly.`,

  // Dashboard — "Brief me"
  // Context: { smartPhase, daysToNearestExam, nearestExamName, studyDebtHours,
  //            todayPlanChapters, subjectWithLowestBKT, burnoutStateLabel }
  briefMe: (ctx) =>
    `${SYSTEM_PROMPT}\n\n${JSON.stringify(ctx)}\n\nRespond in exactly 2 sentences. One sentence about today's situation referencing phase and debt. One sentence about what matters most today referencing the weakest subject or most urgent plan item. Under 45 words. Motivating but not generic. Reference at least one specific number.`,

  // Planner — "Generate" narrative
  // Context: { todayPlan: [{name, allocatedMinutes, subject}], totalBudgetMins,
  //            studyDebtHours, smartPhase, daysToExam, burnoutStateLabel }
  plannerNarrative: (ctx) =>
    `${SYSTEM_PROMPT}\n\n${JSON.stringify(ctx)}\n\nWrite one paragraph, present tense, as if briefing a student on their day. Name specific chapters and their times. Reference the phase and debt if relevant. Under 70 words. No bullet points. No headers. Reads like a coach talking to an athlete before a match.`,

  // Settings — "AI Tune Settings"
  // Context: { last30Sessions: [{mins, subject, date}], currentDailyTargetHours,
  //            avgActualHoursLast14Days, studyDebtHours, streakDays, burnoutStateLabel }
  settingsTune: (ctx) =>
    `${SYSTEM_PROMPT}\n\n${JSON.stringify(ctx)}\n\nReturn ONLY a valid JSON object. No markdown. No explanation. No code fences. Keys allowed: dailyTargetHours (number). Only include a key if you have strong evidence from the session data to recommend a change. If no change is warranted, return empty object {}. If dailyTargetHours recommendation would be lower than 2 or higher than 16, do not include it.`,
};
