import { useMemo } from 'react';

/**
 * useRightNow — computes ONE confident study recommendation
 * based on decay alerts, daily plan, burnout state, and time of day.
 * Zero AI required — pure deterministic logic on existing data.
 *
 * Returns:
 *   { chapter, subject, recommendedMins, reason, urgency }
 *   urgency: 'critical' | 'high' | 'normal' | 'recovery'
 */
export function useRightNow({ dailyPlan, decayAlerts, burnoutState, chapters, subjectVelocity, daysToExam }) {
  return useMemo(() => {
    const now = new Date();
    const hour = now.getHours();

    // Recovery mode — burnout level 2, suggest lightest task
    if (burnoutState?.currentState >= 2) {
      const easiest = dailyPlan.find(c => c.allocatedMinutes <= 30);
      if (easiest) {
        return {
          chapter: easiest.name,
          subject: easiest.subject,
          recommendedMins: 25,
          reason: 'Burnout detected — light session to stay consistent',
          urgency: 'recovery',
        };
      }
    }

    // CRITICAL — chapter in decay alerts AND in daily plan (double urgency)
    const decayNames = new Set(decayAlerts.map(a => a.name || a));
    const criticalOverlap = dailyPlan.find(c => decayNames.has(c.name));
    if (criticalOverlap) {
      return {
        chapter: criticalOverlap.name,
        subject: criticalOverlap.subject,
        recommendedMins: 45,
        reason: `Memory fading fast · ${daysToExam < 999 ? daysToExam + 'd to exam' : 'revision urgent'}`,
        urgency: 'critical',
      };
    }

    // HIGH — any decay alert chapter (memory fading)
    if (decayAlerts.length > 0) {
      const alert = decayAlerts[0];
      const alertName = alert.name || alert;
      const alertSubject = alert.subject || dailyPlan.find(c => c.name === alertName)?.subject || 'General';
      return {
        chapter: alertName,
        subject: alertSubject,
        recommendedMins: 30,
        reason: 'Retention dropping — active recall session recommended',
        urgency: 'high',
      };
    }

    // NORMAL — top of daily plan
    if (dailyPlan.length > 0) {
      const top = dailyPlan[0];
      // Pick recommended time based on hour of day
      let mins = top.allocatedMinutes || 45;
      // Early morning or late night — shorter session
      if (hour < 7 || hour >= 22) mins = Math.min(mins, 30);
      // Peak hours (8–11 AM, 7–10 PM) — full session
      const isPeak = (hour >= 8 && hour <= 11) || (hour >= 19 && hour <= 22);

      // Find weakest subject to add urgency context
      const weakSubject = Object.entries(subjectVelocity || {})
        .filter(([, v]) => v < -0.3)
        .sort((a, b) => a[1] - b[1])[0];

      let reason = isPeak ? 'Peak focus window active' : 'Next priority chapter';
      if (top.isReview) reason = 'Spaced repetition due — review session';
      if (weakSubject && top.subject === weakSubject[0]) reason = `${top.subject} velocity dropping — needs attention`;
      if (daysToExam < 14) reason = `Exam in ${daysToExam} days — high urgency`;

      return {
        chapter: top.name,
        subject: top.subject,
        recommendedMins: mins,
        reason,
        urgency: daysToExam < 14 ? 'high' : 'normal',
      };
    }

    // All caught up
    return {
      chapter: null,
      subject: null,
      recommendedMins: 0,
      reason: 'All priority chapters complete for today',
      urgency: 'normal',
    };
  }, [dailyPlan, decayAlerts, burnoutState, chapters, subjectVelocity, daysToExam]);
}
