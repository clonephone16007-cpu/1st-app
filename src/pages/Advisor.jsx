import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useEngineContext } from '../hooks/useEngineContext';
import { useAI } from '../hooks/useAI';
import { schedulerEngine, getTopologicalOrder, getKSTFrontier } from '../engines/schedulerEngine';
import { decayEngine, getRetention, getStatus, getBKTKnowledge } from '../engines/decayEngine';
import { predictorEngine } from '../engines/predictorEngine';
import { chapters as chapterDefs } from '../data/chapters';
import { exams } from '../data/exams';
import { burnoutEngine } from '../engines/burnoutEngine';
import { adaptiveEngine } from '../engines/adaptiveEngine';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowRight, Brain, Zap, TrendingDown, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';

const PRIORITY_STYLES = {
  red:    { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.20)',   icon: AlertTriangle, iconColor: 'rgb(220,38,38)',   textColor: 'rgb(185,28,28)' },
  amber:  { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.20)',  icon: AlertCircle,   iconColor: 'rgb(180,115,0)',   textColor: 'rgb(146,64,14)' },
  blue:   { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.20)',  icon: Info,          iconColor: 'rgb(37,99,235)',   textColor: 'rgb(30,58,138)' },
  green:  { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.20)',   icon: CheckCircle2,  iconColor: 'rgb(21,128,61)',   textColor: 'rgb(20,83,45)' },
};

export default function Advisor() {
  const store = useAppStore();
  const ec = useEngineContext();
  const { hasAI, explainInsight, loading: aiLoading } = useAI();
  const navigate = useNavigate();
  const [aiExplanation, setAiExplanation] = useState({});
  const [insights, setInsights] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Run all rule engines ────────────────────────────────────────────────────
  const runRules = () => {
    setIsRefreshing(true);
    const newInsights = [];
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];

    // ── Rule 0: Burnout / HMM state alert ─────────────────────────────────
    try {
      const burnoutState = burnoutEngine.detectStudyState(store.sessions, store.mood);
      if (burnoutState.currentState === 2) {
        newInsights.push({
          id: 'r0-burnout', priority: 0, type: 'red',
          title: 'Burnout Detected',
          message: burnoutState.description + (burnoutState.recommendation ? ` ${burnoutState.recommendation}` : ''),
          action: null, path: null,
          tag: `${burnoutState.daysInCurrentState}d in Burnout`,
        });
      } else if (burnoutState.currentState === 1 && burnoutState.daysInCurrentState >= 3) {
        newInsights.push({
          id: 'r0-declining', priority: 1, type: 'amber',
          title: `Declining State — ${burnoutState.daysInCurrentState} Days`,
          message: burnoutState.recommendation || burnoutState.description,
          action: 'Start Timer', path: '/timer',
          tag: 'HMM Signal',
        });
      }
    } catch (e) {}

    // ── Rule 1: Exam within 7 days ──────────────────────────────────────────
    exams.forEach(exam => {
      if (!store.settings.activeExams.includes(exam.id)) return;
      const diffDays = Math.ceil((new Date(exam.date) - now) / 86400000);
      if (diffDays >= 0 && diffDays <= 7) {
        newInsights.push({
          id: `r1-${exam.id}`, priority: 1, type: 'red',
          title: `${exam.name} is in ${diffDays} days`,
          message: 'Focus entirely on mock tests and high-yield revision. No new chapters.',
          action: 'Go to Scores', path: '/scores',
        });
      }
    });

    // ── Rule 2: No session today ────────────────────────────────────────────
    const hasSessionToday = store.sessions.some(s => (s.date || '').startsWith(todayKey));
    if (!hasSessionToday) {
      const suggested = adaptiveEngine.recommendSubject(store.sessions, store.scores, store.chapters);
      newInsights.push({
        id: 'r2', priority: 2, type: 'red',
        title: 'No Study Session Today',
        message: `You haven't logged any study time. Algorithm suggests starting with ${suggested} — your highest-momentum subject right now.`,
        action: 'Start Timer', path: '/timer',
        tag: `Suggested: ${suggested}`,
      });
    }

    // ── Rule 3: Fading chapters (BKT-based) ─────────────────────────────────
    const fadingChapters = chapterDefs.filter(def => {
      const ch = store.chapters[def.id];
      if (!ch || !ch.done) return false;
      const ret = getRetention(ch, def.subject);
      return getStatus(ret) === 'fading';
    });
    if (fadingChapters.length > 0) {
      newInsights.push({
        id: 'r3-fading', priority: 3, type: 'red',
        title: `${fadingChapters.length} Chapters Fading (BKT)`,
        message: `Bayesian Knowledge Tracing shows ${fadingChapters.length} chapters with P(known) < 45%. Top: ${fadingChapters.slice(0,2).map(c => c.name).join(', ')}.`,
        action: 'View Fading', path: '/chapters', filter: 'Fading',
        tag: 'BKT Alert',
      });
    }

    // ── Rule 4: Stale chapters ──────────────────────────────────────────────
    const staleChapters = chapterDefs.filter(def => {
      const ch = store.chapters[def.id];
      if (!ch || !ch.done) return false;
      return getStatus(getRetention(ch, def.subject)) === 'stale';
    });
    if (staleChapters.length > 0) {
      newInsights.push({
        id: 'r4-stale', priority: 4, type: 'amber',
        title: `${staleChapters.length} Chapters Stale`,
        message: `P(known) between 45–65% for ${staleChapters.length} chapters. Schedule a review session this week.`,
        action: 'View Chapters', path: '/chapters',
        tag: 'Review Due',
      });
    }

    // ── Rule 5: T1 chapters pending near exam ───────────────────────────────
    let hasNearExam = false;
    exams.forEach(exam => {
      if (!store.settings.activeExams.includes(exam.id)) return;
      const d = Math.ceil((new Date(exam.date) - now) / 86400000);
      if (d >= 0 && d <= 21) hasNearExam = true;
    });
    if (hasNearExam) {
      const pendingT1 = chapterDefs.filter(def =>
        def.tier === 'T1' && (!store.chapters[def.id] || !store.chapters[def.id].done)
      );
      if (pendingT1.length > 0) {
        newInsights.push({
          id: 'r5', priority: 5, type: 'red',
          title: `${pendingT1.length} T1 Chapters Incomplete`,
          message: `Exam in <21 days. KST suggests: ${pendingT1.slice(0,2).map(c=>c.name).join(', ')}.`,
          action: 'View Chapters', path: '/chapters',
          tag: 'KST Priority',
        });
      }
    }

    // ── Rule 6: Flashcards overdue ──────────────────────────────────────────
    const now_iso = new Date().toISOString();
    const overdueCards = store.flashcards.filter(c => c.dueDate && c.dueDate <= now_iso);
    if (overdueCards.length >= 10) {
      newInsights.push({
        id: 'r6', priority: 6, type: 'amber',
        title: `${overdueCards.length} Flashcards Overdue`,
        message: 'FSRS scheduler shows high memory risk. Review now to prevent retention collapse.',
        action: 'Review Cards', path: '/flashcards',
        tag: 'FSRS Alert',
      });
    }

    // ── Rule 7: Score trend declining (Kalman) ──────────────────────────────
    for (const [examId, examScores] of Object.entries(store.scores)) {
      if (examScores.length < 3) continue;
      const pred = predictorEngine.predictPercentile(store.scores, examId);
      if (pred && pred.trend === 'Downward' && pred.velocity < -5) {
        const exam = exams.find(e => e.id === examId);
        newInsights.push({
          id: `r7-${examId}`, priority: 7, type: 'amber',
          title: `${exam?.name || examId} Score Declining`,
          message: `Kalman filter shows a ${Math.abs(pred.velocity).toFixed(1)}-mark/session downward trend. Log a targeted mock this week.`,
          action: 'Log Score', path: '/scores',
          tag: `Kalman: ${pred.velocity.toFixed(1)}/session`,
        });
      }
    }

    // ── Rule 8: Thompson Sampling subject suggestion ─────────────────────────
    const subjectProfiles = adaptiveEngine.getSubjectProfile(store.sessions, store.scores, store.chapters);
    const weakest = subjectProfiles.sort((a, b) => a.successRate - b.successRate)[0];
    if (weakest && weakest.sessions > 5) {
      newInsights.push({
        id: 'r8', priority: 8, type: 'blue',
        title: `Focus on ${weakest.subject}`,
        message: `Thompson Sampling (β-distribution) shows ${weakest.subject} has a ${Math.round(weakest.successRate * 100)}% session success rate — the lowest of your subjects. Spend extra time there.`,
        action: 'Start Timer', path: '/timer',
        tag: `Success: ${Math.round(weakest.successRate * 100)}%`,
      });
    }

    // ── Rule 9: Positive — daily target hit ─────────────────────────────────
    const todayMins = store.sessions
      .filter(s => (s.date || '').startsWith(todayKey))
      .reduce((acc, s) => acc + s.mins, 0);
    if (todayMins >= (store.settings.dailyTargetHours || 8) * 60) {
      newInsights.push({
        id: 'r9', priority: 99, type: 'green',
        title: 'Daily Target Hit!',
        message: `You've studied ${Math.round(todayMins / 60 * 10) / 10}h today — target reached. Log a win and keep the streak.`,
        action: null, path: null,
      });
    }

    // Sort by priority
    newInsights.sort((a, b) => a.priority - b.priority);
    setInsights(newInsights);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => { runRules(); }, []);

  // ── KST Priority queue ──────────────────────────────────────────────────────
  const priorityQueue = useMemo(() => {
    const completedIds = Object.entries(store.chapters)
      .filter(([, state]) => state.done).map(([id]) => id);
    const frontier = schedulerEngine.getKSTFrontier(completedIds, chapterDefs);
    const budget = (store.settings.dailyTargetHours || 8) * 60 * 0.65;
    return schedulerEngine.knapsackAllocate(frontier, store.chapters, budget).slice(0, 6);
  }, [store.chapters, store.settings]);

  // ── Decay report ─────────────────────────────────────────────────────────────
  const decayReport = useMemo(() => {
    return decayEngine.getAlerts(store.chapters, chapterDefs).slice(0, 8);
  }, [store.chapters]);


  // ── Pre-exam checklist: T1+T2 undone chapters sorted by KST topo order ──────
  const preExamChecklist = useMemo(() => {
    const completedIds = Object.entries(store.chapters).filter(([,s]) => s.done).map(([id]) => id);
    const topoOrder = getTopologicalOrder(chapterDefs);
    const undoneT1T2 = chapterDefs.filter(c =>
      (c.tier === 'T1' || c.tier === 'T2') && !store.chapters[c.id]?.done
    );
    // Sort by topological position (earlier prereqs first)
    const topoIds = topoOrder.map(c => c.id ?? c); // handles both object and string formats
    undoneT1T2.sort((a, b) => topoIds.indexOf(a.id) - topoIds.indexOf(b.id));
    // Estimate hours: T1=90m, T2=60m
    const totalMins = undoneT1T2.reduce((acc, c) => acc + (c.tier === 'T1' ? 90 : 60), 0);
    return { chapters: undoneT1T2.slice(0, 15), totalMins, totalCount: undoneT1T2.length };
  }, [store.chapters]);

  // ── Subject profiles ─────────────────────────────────────────────────────────
  const subjectProfiles = useMemo(() =>
    adaptiveEngine.getSubjectProfile(store.sessions, store.scores, store.chapters),
    [store.sessions, store.scores, store.chapters]
  );

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold font-serif" style={{ color: 'var(--text)' }}>Advisor</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {todayStr} · Powered by FSRS, BKT, Kalman, HMM, KST
          </p>
        </div>
        <button
          onClick={runRules}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)' }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Insight cards */}
      <div className="space-y-3">
        {insights.length === 0 && !isRefreshing && (
          <div className="py-12 text-center rounded-[14px]"
            style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
            <Brain size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">All engines are running — no alerts right now.</p>
          </div>
        )}
        <AnimatePresence>
          {insights.map(insight => {
            const style = PRIORITY_STYLES[insight.type] || PRIORITY_STYLES.blue;
            const Icon = style.icon;
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-[14px] p-4"
                style={{ background: style.bg, border: `1px solid ${style.border}` }}
              >
                <div className="flex items-start gap-3">
                  <Icon size={16} className="shrink-0 mt-0.5" style={{ color: style.iconColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold" style={{ color: style.textColor }}>{insight.title}</h3>
                      {insight.tag && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                          style={{ background: style.border, color: style.textColor }}>
                          {insight.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: style.textColor, opacity: 0.85 }}>
                      {insight.message}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {insight.action && (
                        <button
                          onClick={() => navigate(insight.path, insight.filter ? { state: { filter: insight.filter } } : undefined)}
                          className="flex items-center gap-1.5 text-xs font-bold transition-all"
                          style={{ color: style.iconColor }}
                        >
                          {insight.action} <ArrowRight size={11} />
                        </button>
                      )}
                      {hasAI && (
                        <button
                          onClick={async () => {
                            const ctx = {
                              insightTitle: insight.title,
                              insightMessage: insight.message,
                              insightSeverity: insight.type,
                              relevantMetric: insight.tag || '',
                              daysToExam: ec.daysToExam,
                            };
                            const res = await explainInsight(ctx);
                            if (res) setAiExplanation(prev => ({ ...prev, [insight.id]: res }));
                          }}
                          disabled={aiLoading}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-all"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}
                        >
                          <Sparkles size={9} /> {aiLoading ? '...' : 'Why?'}
                        </button>
                      )}
                    </div>
                    {aiExplanation[insight.id] && (
                      <MarkdownRenderer text={aiExplanation[insight.id]} className="text-xs mt-2 p-2 rounded-lg italic" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* KST Priority Queue */}
        <div className="lg:col-span-2 rounded-[14px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-5 py-3.5" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Zap size={13} style={{ color: 'var(--accent)' }} />
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                KST Priority Queue · Knapsack Optimised
              </h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Only chapters with satisfied prerequisites · Ranked by value-density
            </p>
          </div>
          {priorityQueue.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">All available chapters complete!</p>
            </div>
          ) : (
            <div>
              {priorityQueue.map((chapter, i) => {
                const tierColors = { T1: 'rgb(220,38,38)', T2: 'rgb(180,115,0)', T3: 'rgb(107,114,128)' };
                return (
                  <div key={chapter.id}
                    className="flex items-center justify-between px-5 py-3.5 transition-colors"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sidebar)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono font-bold w-5 shrink-0"
                        style={{ color: 'var(--text-muted)' }}>#{i+1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{chapter.name}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase"
                            style={{ color: tierColors[chapter.tier], background: `${tierColors[chapter.tier]}15` }}>
                            {chapter.tier}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {chapter.subject} · {chapter.allocatedMinutes}m allocated · value-density {chapter.valueDensity?.toFixed(3)}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs font-mono shrink-0 ml-3" style={{ color: 'var(--accent)' }}>
                      {chapter.jeeWeight?.toFixed(1)}w
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pre-Exam Checklist */}
        <div className="rounded-[14px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Pre-Exam Checklist</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {preExamChecklist.totalCount} T1+T2 chapters remaining · ~{Math.round(preExamChecklist.totalMins / 60 * 10) / 10}h estimated
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-md font-semibold" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>
              KST Order
            </span>
          </div>
          <div className="divide-y" style={{ divideColor: 'var(--border-light)' }}>
            {preExamChecklist.chapters.map((ch, i) => (
              <div key={ch.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="text-xs font-mono w-5 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${ch.tier === 'T1' ? 'bg-red-500' : 'bg-amber-500'}`}/>
                <span className="flex-1 text-xs font-medium" style={{ color: 'var(--text)' }}>{ch.name}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ch.subject}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: ch.tier === 'T1' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', color: ch.tier === 'T1' ? 'rgb(220,38,38)' : 'rgb(180,115,0)' }}>
                  {ch.tier === 'T1' ? '90m' : '60m'}
                </span>
              </div>
            ))}
            {preExamChecklist.totalCount > 15 && (
              <p className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                + {preExamChecklist.totalCount - 15} more chapters not shown
              </p>
            )}
          </div>
        </div>

        {/* Subject Profiles (Thompson Sampling) */}
        <div className="rounded-[14px] p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Brain size={13} style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Thompson Sampling
            </h2>
          </div>
          <div className="space-y-4">
            {subjectProfiles.map(p => {
              const subjColors = { Math: '#D4870A', Physics: '#2471A3', Chemistry: '#7D3C98' };
              const color = subjColors[p.subject] || 'var(--accent)';
              return (
                <div key={p.subject}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{p.subject}</span>
                    <span className="text-xs font-mono font-bold" style={{ color }}>
                      {Math.round(p.successRate * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${p.successRate * 100}%`, background: color }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    α={p.alpha} β={p.beta} · {p.sessions} sessions
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BKT Decay Report */}
      {decayReport.length > 0 && (
        <div className="rounded-[14px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-5 py-3.5" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <TrendingDown size={13} style={{ color: 'rgb(220,38,38)' }} />
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                BKT Decay Report · Chapters by P(known)
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {decayReport.map((chapter, i) => {
              const pct = Math.round(chapter.retention * 100);
              const color = chapter.status === 'fading' ? 'rgb(220,38,38)' : 'rgb(180,115,0)';
              return (
                <div key={chapter.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors"
                  style={{ borderBottom: i < decayReport.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sidebar)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{chapter.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{chapter.subject}</p>
                  </div>
                  <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
