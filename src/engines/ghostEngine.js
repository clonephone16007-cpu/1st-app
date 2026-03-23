// ─── Ghost Engine 2.0 ─────────────────────────────────────────────────────────
// Ghost now has urgency-aware daily hours: ramps up as exam approaches.
// Subject allocation mirrors user's weaknesses (one day behind).

export function getGhostData(sessions, settings, subjectBKT = { Math: 0.5, Physics: 0.5, Chemistry: 0.5 }, completionRatio = 0, urgencyMultiplier = 1.0, daysToExam = 999) {
  const dailyTargetHours = settings.dailyTargetHours || 8;

  // Ghost ramps: starts at 75% of target, reaches 110% in final 30 days
  const ghostBase = daysToExam <= 14
    ? dailyTargetHours * 1.10
    : daysToExam <= 30
    ? dailyTargetHours * 1.00
    : daysToExam <= 60
    ? dailyTargetHours * 0.88
    : dailyTargetHours * 0.75;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const weeklyBars = [];
  let userHoursThisWeek = 0;
  let ghostHoursThisWeek = 0;
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = day.toISOString().split('T')[0];

    const dayMins = sessions
      .filter(s => s.date && s.date.startsWith(dayStr))
      .reduce((acc, s) => acc + (s.mins || 0), 0);
    const userHours = parseFloat((dayMins / 60).toFixed(2));

    const isPast = day <= now;
    // Ghost varies slightly each day (seeded by day index, not random)
    const dayVariance = [1.0, 0.95, 1.05, 0.98, 1.02, 0.90, 1.08][i];
    const ghostHours = isPast ? parseFloat((ghostBase * dayVariance).toFixed(2)) : 0;

    userHoursThisWeek += userHours;
    ghostHoursThisWeek += ghostHours;
    weeklyBars.push({ day: dayLabels[i], userHours, ghostHours });
  }

  userHoursThisWeek = parseFloat(userHoursThisWeek.toFixed(1));
  ghostHoursThisWeek = parseFloat(ghostHoursThisWeek.toFixed(1));
  const delta = parseFloat((userHoursThisWeek - ghostHoursThisWeek).toFixed(1));

  const message =
    delta > 5  ? `You're ${delta}h ahead of ghost this week. Keep pushing!` :
    delta > 0  ? `You're ${delta}h ahead of ghost. Solid — don't slow down.` :
    delta === 0 ? 'Neck and neck with ghost. Push today to pull ahead.' :
    delta > -5 ? `Ghost is ${Math.abs(delta)}h ahead. Close the gap today.` :
                 `Ghost is ${Math.abs(delta)}h ahead this week. Time to grind.`;

  // Algorithm interconnection: Ghost subject allocation mirrors user weaknesses.
  // The lower the user's BKT in a subject, the harder the Ghost studies it.
  const bktValues = Object.entries(subjectBKT);
  const avgBKT = bktValues.length ? bktValues.reduce((a, b) => a + b[1], 0) / bktValues.length : 0.5;
  
  // Ghost focuses on the user's current weakest subject (approx. 1-day lag effect)
  const weakestSubject = bktValues.sort((a,b) => a[1] - b[1])[0]?.[0] || 'Math';
  const ghostFocusSubject = weakestSubject;
  
  const ghostBKT = { Math: 0, Physics: 0, Chemistry: 0 };
  Object.keys(subjectBKT).forEach(s => {
    // Ghost outperforms user in the user's weakest subjects (inverting the weakness)
    const weakness = Math.max(0, avgBKT - subjectBKT[s]);
    // Ghost BKT is user BKT + a bonus proportional to weekly ghost lead and user weakness
    const weeklyBonus = Math.max(0, -delta) * 0.01; // Every hour ghost is ahead = +1% BKT
    ghostBKT[s] = Math.min(0.95, subjectBKT[s] + weakness * 0.5 + weeklyBonus);
  });
  
  // Ghost overall completion scales with hours
  const lifetimeDeltaHours = delta; // Simplification: assume weekly delta reflects lifetime trend
  const ghostCompletionRatio = Math.min(0.99, Math.max(0, completionRatio + (lifetimeDeltaHours * -0.005)));

  return { 
    userHoursThisWeek, ghostHoursThisWeek, delta, message, weeklyBars, 
    ghostDailyTarget: parseFloat(ghostBase.toFixed(1)),
    ghostBKT, ghostCompletionRatio, ghostFocusSubject
  };
}

export const ghostEngine = { getGhostData };
