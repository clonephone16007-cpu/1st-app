import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEngineContext } from '../hooks/useEngineContext';
import { useAI } from '../hooks/useAI';
import { useAppStore } from '../store/useAppStore';
import { useRightNow } from '../hooks/useRightNow';
import { useSessionMetrics } from '../hooks/useSessionMetrics';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useExamCountdown } from '../hooks/useExamCountdown';
import { usePageActivity } from '../hooks/usePageActivity';
import { predictorEngine } from '../engines/predictorEngine';
import { GLOBAL_SHORTCUTS } from '../config/shortcuts';
import { AnimatePresence, motion } from 'motion/react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {
  Flame, Clock, Target, BrainCircuit, BookOpen,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  Zap, Sparkles, HelpCircle, X, Play, SkipForward,
  ChevronRight, AlertCircle
} from 'lucide-react';

// ── Urgency colour map ───────────────────────────────────────────────────────
const URGENCY = {
  critical: { bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.35)', accent: '#ef4444', label: 'CRITICAL' },
  high:     { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.35)', accent: '#f59e0b', label: 'HIGH' },
  normal:   { bg: 'var(--accent-tint)',    border: 'var(--accent)',          accent: 'var(--accent)', label: 'NEXT UP' },
  recovery: { bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.35)', accent: '#6366f1', label: 'RECOVERY' },
};

// ── Command Card ─────────────────────────────────────────────────────────────
function CommandCard({ rightNow, onStart, onSkip }) {
  const u = URGENCY[rightNow.urgency] || URGENCY.normal;

  if (!rightNow.chapter) {
    return (
      <div className="rounded-2xl p-7 flex flex-col items-center justify-center text-center min-h-[160px]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="text-3xl mb-2">🎯</div>
        <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>All caught up!</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No priority chapters remaining today.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl p-6"
      style={{ background: u.bg, border: `1.5px solid ${u.border}`, boxShadow: 'var(--shadow-md)' }}
    >
      {/* Badge + label */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ background: u.accent + '20', color: u.accent }}>
          {u.label}
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {rightNow.subject}
        </span>
      </div>

      {/* Main instruction */}
      <div className="mb-1">
        <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Study right now</p>
        <h2 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
          {rightNow.chapter}
        </h2>
      </div>

      {/* Time + reason */}
      <div className="flex items-center gap-3 mt-3 mb-5">
        <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full"
          style={{ background: 'var(--bg-card)', color: u.accent }}>
          <Clock size={13} /> {rightNow.recommendedMins} min
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {rightNow.reason}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{ background: u.accent, color: '#fff', boxShadow: `0 4px 14px ${u.accent}40` }}>
          <Play size={15} fill="white" /> Start Session
        </button>
        <button
          onClick={onSkip}
          className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
          <SkipForward size={14} /> Skip
        </button>
      </div>
    </motion.div>
  );
}

// ── Exam Countdown Strip ──────────────────────────────────────────────────────
function ExamStrip({ exam, scores, subjectVelocity }) {
  const navigate = useNavigate();
  const { days } = useExamCountdown(exam.id);
  const prediction = useMemo(() => predictorEngine.predictPercentile(scores, exam.id), [scores, exam.id]);
  const projected = prediction?.percentile || null;
  const velocity = prediction?.velocity || 0;

  // Cost of delay: each day behind = -0.3 percentile (simple linear model)
  const costPerDay = 0.3;
  const projectedIfWait3 = projected ? Math.max(0, projected - costPerDay * 3).toFixed(1) : null;

  const urgentColor = days < 14 ? '#ef4444' : days < 30 ? '#f59e0b' : '#22c55e';
  const TrendIcon = velocity > 0 ? TrendingUp : velocity < 0 ? TrendingDown : Minus;
  const trendColor = velocity > 0 ? '#22c55e' : velocity < 0 ? '#ef4444' : 'var(--text-muted)';

  return (
    <button onClick={() => navigate('/scores')}
      className="flex flex-col p-4 rounded-[14px] text-left transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--bg-card)', border: `1px solid var(--border-light)`, borderLeft: `4px solid ${urgentColor}`, boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>{exam.name}</p>
        <TrendIcon size={13} color={trendColor} />
      </div>
      <div className="font-mono text-2xl font-bold" style={{ color: urgentColor }}>
        {days}<span className="text-sm font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>d</span>
      </div>
      {projected && (
        <div className="mt-2 space-y-0.5">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Trajectory → <span className="font-bold" style={{ color: '#22c55e' }}>{projected.toFixed(0)}th %ile</span>
          </p>
          {projectedIfWait3 && (
            <p className="text-[11px]" style={{ color: '#ef4444' }}>
              Skip 3 days → {projectedIfWait3}th %ile
            </p>
          )}
        </div>
      )}
    </button>
  );
}

// ── Three-number strip ────────────────────────────────────────────────────────
function ThreeNumbers({ todayHours, targetHours, streak, dueCards }) {
  const navigate = useNavigate();
  const pct = Math.min(100, (todayHours / targetHours) * 100);
  const barColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : 'var(--accent)';

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Today progress */}
      <button onClick={() => navigate('/timer')}
        className="col-span-2 p-4 rounded-[14px] text-left transition-all hover:-translate-y-0.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Today</span>
          <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>
            {todayHours.toFixed(1)}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{targetHours}h</span>
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-sidebar)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: barColor }}
          />
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {pct >= 100 ? '🎯 Target hit!' : `${(targetHours - todayHours).toFixed(1)}h remaining`}
        </p>
      </button>

      {/* Streak */}
      <button onClick={() => navigate('/timer')}
        className="p-4 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all hover:-translate-y-0.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <Flame size={20} style={{ color: streak > 0 ? '#f59e0b' : 'var(--text-muted)' }} />
        <span className="font-mono text-2xl font-bold" style={{ color: 'var(--text)' }}>{streak}</span>
        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>day streak</span>
      </button>
    </div>
  );
}

// ── Intelligence Strip ────────────────────────────────────────────────────────
function IntelStrip({ ghostData, subjectVelocity, sessions }) {
  const navigate = useNavigate();

  // Weakest subject by velocity
  const weakest = useMemo(() => {
    const entries = Object.entries(subjectVelocity || {}).filter(([, v]) => v < -0.2);
    if (!entries.length) return null;
    entries.sort((a, b) => a[1] - b[1]);
    return { subject: entries[0][0], velocity: entries[0][1] };
  }, [subjectVelocity]);

  // Streak risk: compute usual start hour from last 7 sessions
  const streakRisk = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hasStudiedToday = sessions.some(s => s.date?.startsWith(today));
    if (hasStudiedToday) return null;

    const last7 = sessions.slice(-7);
    if (last7.length < 3) return null;
    const starts = last7
      .map(s => s.startTime ? new Date(s.startTime).getHours() : null)
      .filter(h => h !== null);
    if (!starts.length) return null;
    const avgHour = Math.round(starts.reduce((a, b) => a + b, 0) / starts.length);
    const currentHour = now.getHours();
    if (currentHour < avgHour - 1) return null; // Too early, not at risk yet
    const hoursLeft = Math.max(0, avgHour + 1 - currentHour);
    return { avgHour, hoursLeft };
  }, [sessions]);

  const signals = [
    ghostData && {
      icon: ghostData.delta >= 0 ? TrendingUp : TrendingDown,
      color: ghostData.delta >= 0 ? '#22c55e' : '#ef4444',
      text: ghostData.delta >= 0
        ? `${Math.abs(ghostData.delta).toFixed(1)}h ahead of ghost this week`
        : `${Math.abs(ghostData.delta).toFixed(1)}h behind ghost this week`,
      onClick: () => navigate('/timer'),
    },
    weakest && {
      icon: TrendingDown,
      color: '#f59e0b',
      text: `${weakest.subject} velocity dropping (${weakest.velocity.toFixed(1)}) — needs focus`,
      onClick: () => navigate('/chapters', { state: { subject: weakest.subject } }),
    },
    streakRisk && {
      icon: AlertCircle,
      color: '#ef4444',
      text: `Usually study by ${streakRisk.avgHour}:00 — ${streakRisk.hoursLeft}h left to protect streak`,
      onClick: () => navigate('/timer'),
    },
  ].filter(Boolean);

  if (!signals.length) return null;

  return (
    <div className="rounded-[14px] divide-y overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', '--tw-divide-color': 'var(--border-light)' }}>
      {signals.map((s, i) => (
        <button key={i} onClick={s.onClick}
          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
          <s.icon size={14} style={{ color: s.color, shrink: 0 }} />
          <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>{s.text}</span>
          <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
      ))}
    </div>
  );
}

// ── Mini mood picker ──────────────────────────────────────────────────────────
function MoodPicker({ mood, todayStr, setMood }) {
  return (
    <div className="rounded-[14px] p-4 flex items-center justify-between"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>How are you feeling?</span>
      <div className="flex gap-1.5">
        {['😩','😴','😐','😊','🔥'].map(m => (
          <button key={m} onClick={() => setMood(todayStr, m)}
            className="text-lg p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95"
            style={{ background: mood[todayStr] === m ? 'var(--accent-tint)' : 'transparent', border: mood[todayStr] === m ? '1px solid var(--accent)' : '1px solid transparent' }}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const ec = useEngineContext();
  const { setMood } = useAppStore();
  const { hasAI, briefMe, loading: aiLoading } = useAI();

  const {
    sessions, chapters, scores, mood, settings,
    examTimelines, daysToExam, smartPhase,
    subjectVelocity, burnoutState, decayAlerts,
    ghostData, grindIndex, dueCards, studyDebt,
    dailyPlan, todayStr, todayHours, resolvedDefs,
  } = ec;

  const { currentStreak } = useSessionMetrics();

  const [skippedChapters, setSkippedChapters] = useState([]);
  const [aiInsight, setAiInsight] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(sessions.length === 0);

  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  usePageActivity('Dashboard');

  useKeyboardShortcuts('GLOBAL', {
    'Show this help': () => setShowShortcuts(s => !s),
    'Go to Dashboard': () => navigate('/'),
    'Go to Timer': () => navigate('/timer'),
    'Go to Chapters': () => navigate('/chapters'),
    'Go to Scores': () => navigate('/scores'),
    'Go to Flashcards': () => navigate('/flashcards'),
    'Go to Notes': () => navigate('/notes'),
    'Go to Advisor': () => navigate('/advisor'),
  });

  // Filter out skipped chapters from dailyPlan for rightNow
  const filteredPlan = useMemo(
    () => dailyPlan.filter(c => !skippedChapters.includes(c.id || c.name)),
    [dailyPlan, skippedChapters]
  );

  const rightNow = useRightNow({
    dailyPlan: filteredPlan,
    decayAlerts,
    burnoutState,
    chapters,
    subjectVelocity,
    daysToExam,
  });

  // Auto-load AI insight once on mount if AI key exists
  useEffect(() => {
    if (!hasAI || aiInsight) return;
    const timer = setTimeout(async () => {
      const nearestExam = examTimelines[0];
      const ctx = {
        smartPhase,
        daysToNearestExam: daysToExam,
        nearestExamName: nearestExam?.name || 'Unknown',
        studyDebtHours: studyDebt,
        todayPlanChapters: dailyPlan.slice(0, 3).map(c => c.name),
        burnoutStateLabel: burnoutState?.label || 'Normal',
        rightNowChapter: rightNow.chapter,
      };
      const res = await briefMe(ctx);
      if (res) setAiInsight(res);
    }, 1200); // slight delay so page loads fast first
    return () => clearTimeout(timer);
  }, [hasAI]); // eslint-disable-line

  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const phaseColor = smartPhase === 'Final Sprint' ? '#ef4444' : smartPhase === 'Revision Phase' ? '#f59e0b' : smartPhase === 'Intensive Phase' ? '#3b82f6' : 'var(--accent)';

  const handleStartSession = () => {
    navigate('/timer', { state: { subject: rightNow.subject, chapter: rightNow.chapter, mins: rightNow.recommendedMins } });
  };

  const handleSkip = () => {
    if (rightNow.chapter) {
      setSkippedChapters(prev => [...prev, rightNow.chapter]);
    }
  };

  return (
    <div className="space-y-4 pb-10">

      {/* ── Header ── */}
      <div className="flex items-end justify-between pb-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {greeting} · <span style={{ color: phaseColor }}>{smartPhase}</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {studyDebt > 1 && (
            <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: 'rgb(220,38,38)' }}>
              <AlertCircle size={11} /> {studyDebt}h debt
            </div>
          )}
          <button onClick={() => setShowShortcuts(s => !s)}
            className="p-2 rounded-lg transition-all"
            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* ── Shortcuts popover ── */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Keyboard Shortcuts</p>
              <button onClick={() => setShowShortcuts(false)}><X size={13} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GLOBAL_SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-[11px]">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[9px]" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>{s.key}</kbd>
                  <span style={{ color: 'var(--text-muted)' }}>{s.action}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Onboarding banner ── */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 rounded-xl flex items-center justify-between gap-4"
            style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            <div className="flex items-center gap-3">
              <Sparkles size={17} />
              <div>
                <p className="font-bold text-sm">Welcome to ExamHQ 🚀</p>
                <p className="text-xs opacity-90">Set exam dates in <Link to="/settings" className="font-bold underline">Settings</Link>, then log your first session in the <Link to="/timer" className="font-bold underline">Timer</Link>.</p>
              </div>
            </div>
            <button onClick={() => setShowOnboarding(false)} className="p-1 rounded-full hover:bg-black/5"><X size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Burnout banner ── */}
      <AnimatePresence>
        {burnoutState?.currentState >= 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
            style={{
              background: burnoutState.currentState === 2 ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)',
              border: `1px solid ${burnoutState.currentState === 2 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
              color: burnoutState.currentState === 2 ? 'rgb(220,38,38)' : 'rgb(180,115,0)',
            }}>
            <AlertTriangle size={13} />
            {burnoutState.label}: {burnoutState.recommendation || burnoutState.description}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMMAND CARD — Hero ── */}
      <CommandCard rightNow={rightNow} onStart={handleStartSession} onSkip={handleSkip} />

      {/* ── AI Insight (auto-loads if key exists) ── */}
      <AnimatePresence>
        {(aiInsight || aiLoading) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-xl flex items-start gap-2.5"
            style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent)' }}>
            <Sparkles size={14} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            {aiLoading
              ? <div className="h-4 rounded w-2/3 animate-pulse" style={{ background: 'var(--accent)' + '30' }} />
              : <MarkdownRenderer text={aiInsight} className="text-xs flex-1" />
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── THREE NUMBERS ── */}
      <ThreeNumbers
        todayHours={todayHours}
        targetHours={settings.dailyTargetHours || 8}
        streak={currentStreak}
        dueCards={dueCards}
      />

      {/* ── EXAM COUNTDOWN STRIP ── */}
      {examTimelines.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {examTimelines.map(exam => (
            <ExamStrip key={exam.id} exam={exam} scores={scores} subjectVelocity={subjectVelocity} />
          ))}
        </div>
      )}

      {/* ── INTELLIGENCE STRIP ── */}
      <IntelStrip ghostData={ghostData} subjectVelocity={subjectVelocity} sessions={sessions} />

      {/* ── Subject progress (compact) ── */}
      <div className="grid grid-cols-3 gap-3">
        {['Math', 'Physics', 'Chemistry'].map(subj => {
          const total = resolvedDefs.filter(c => c.subject === subj).length;
          const done = resolvedDefs.filter(c => c.subject === subj && chapters[c.id]?.done).length;
          const pct = total > 0 ? done / total : 0;
          const vel = subjectVelocity[subj] || 0;
          const velColor = vel > 0.3 ? '#22c55e' : vel < -0.3 ? '#ef4444' : 'var(--text-muted)';
          const r = 15; const circ = 2 * Math.PI * r;
          return (
            <button key={subj}
              onClick={() => navigate('/chapters', { state: { subject: subj } })}
              className="p-3 rounded-[14px] flex flex-col items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="relative w-10 h-10">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border-light)" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r={r} fill="none" stroke="var(--accent)" strokeWidth="3.5"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
                    className="transition-all duration-700" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold font-mono" style={{ color: 'var(--text)' }}>{Math.round(pct * 100)}%</span>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>{subj}</p>
                <p className="text-[10px]" style={{ color: velColor }}>{vel > 0.3 ? `+${vel.toFixed(1)}` : vel < -0.3 ? vel.toFixed(1) : '→'}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── MOOD PICKER ── */}
      <MoodPicker mood={mood} todayStr={todayStr} setMood={setMood} />

    </div>
  );
}
