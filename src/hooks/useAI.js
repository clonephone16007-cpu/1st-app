import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { askAI } from '../services/aiService';
import { PROMPTS, SYSTEM_PROMPT } from '../config/aiConfig';

export function useAI() {
  const { settings } = useAppStore();
  const apiKey = settings?.geminiApiKey ?? '';
  const provider = settings?.aiProvider ?? 'gemini';
  const hasAI = apiKey.trim().length > 0;

  const [loading, setLoading] = useState(false);

  const ask = useCallback(async (prompt) => {
    if (!hasAI) return null;
    setLoading(true);
    try {
      const res = await askAI(prompt, apiKey, provider);
      return res;
    } catch (e) {
      console.error('[ExamHQ AI]', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [hasAI, apiKey, provider]);

  // ── Purpose-built context callers ─────────────────────────────────────────
  // Each function accepts a purpose-built context object, NOT the raw aiContext.

  // Advisor insight — "Why?" button
  const explainInsight = useCallback((ctx) =>
    ask(PROMPTS.advisorExplain(ctx)), [ask]);

  // Timer — post-session debrief
  const debriefSession = useCallback((ctx) =>
    ask(PROMPTS.timerDebrief(ctx)), [ask]);

  // Chapters — "Explain" button
  const explainChapter = useCallback((ctx) =>
    ask(PROMPTS.chapterPrereqs(ctx)), [ask]);

  // Planner — narrative brief
  const narrativePlan = useCallback((ctx) =>
    ask(PROMPTS.plannerNarrative(ctx)), [ask]);

  // Settings — AI auto-tune
  const tuneSetting = useCallback((ctx) =>
    ask(PROMPTS.settingsTune(ctx)), [ask]);

  // Dashboard — "Brief me"
  const briefMe = useCallback((ctx) =>
    ask(PROMPTS.briefMe(ctx)), [ask]);

  // Daily check-in — structured extraction (still uses raw text + minimal context)
  const parseCheckIn = useCallback(async (text, ctx) => {
    if (!hasAI) return null;
    const prompt = `${SYSTEM_PROMPT}\n\nThe student wrote this daily check-in: "${text}"\n\nContext: ${JSON.stringify(ctx)}\n\nExtract structured signals and return ONLY a valid JSON object (no markdown) with these keys:\n- chapters: string[] (mentioned chapter topics)\n- confidence: "high"|"medium"|"low"\n- confusion: string[] (confused topics if any)\n- energy: "high"|"normal"|"tired"\n- overallMood: "positive"|"neutral"|"negative"`;
    return ask(prompt);
  }, [ask, hasAI]);

  // Similarity matrix — runs once on API key insertion
  const buildSimilarityMatrix = useCallback(async (cards, chapters) => {
    if (!hasAI) return null;
    const prompt = `${SYSTEM_PROMPT}\n\nBuild a similarity matrix for these study topics. Return ONLY a valid JSON array of arrays (no markdown). Each inner array is [topic1_id, topic2_id, similarity_score_0_to_1].\n\nTopics:\n${chapters.slice(0, 30).map(c => `${c.id}: ${c.name}`).join('\n')}`;
    return ask(prompt);
  }, [ask, hasAI]);

  // Retroactive activation — runs once when API key is first inserted
  const retroactiveActivation = useCallback(async (ctx) => {
    if (!hasAI) return null;
    const prompt = `${SYSTEM_PROMPT}\n\n${JSON.stringify(ctx)}\n\nThis student just connected AI. Analyze their data and return ONLY a valid JSON object (no markdown) with:\n- kalmanQ: number (recommended process noise 0.001-0.01)\n- kalmanR: number (recommended measurement noise 0.01-0.05)\n- weakestSubject: "Math"|"Physics"|"Chemistry"\n- personalizedTips: string[] (3 specific tips based on their data)`;
    return ask(prompt);
  }, [ask, hasAI]);

  return {
    hasAI,
    loading,
    ask,
    explainInsight,
    debriefSession,
    explainChapter,
    narrativePlan,
    tuneSetting,
    briefMe,
    parseCheckIn,
    buildSimilarityMatrix,
    retroactiveActivation,
  };
}
