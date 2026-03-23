import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEngineContext } from '../hooks/useEngineContext';
import { useAI } from '../hooks/useAI';
import { useAppStore } from '../store/useAppStore';
import { quotes } from '../data/quotes';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Flame, Clock, BookOpen, Target, BrainCircuit,
  AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertCircle, Zap, Sparkles, HelpCircle, X, Info
} from 'lucide-react';
import { GLOBAL_SHORTCUTS } from '../config/shortcuts';
import { AnimatePresence, motion } from 'motion/react';
import { usePageActivity } from '../hooks/usePageActivity';
import { useSessionMetrics } from '../hooks/useSessionMetrics';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useExamCountdown } from '../hooks/useExamCountdown';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { predictorEngine } from '../engines/predictorEngine';

function ExamCountdownCard({ exam, subjectVelocity, scores }) {
  const navigate = useNavigate();
  const { days, hours, mins } = useExamCountdown(exam.id);
  
  const isDecl = Object.values(subjectVelocity).some(v => v < -0.3);
  let badge = 'AHEAD'; let badgeBg = 'rgba(34,197,94,0.10)'; let badgeColor = 'rgb(21,128,61)';
  if (days < 14) { badge = 'URGENT'; badgeBg = 'rgba(239,68,68,0.10)'; badgeColor = 'rgb(220,38,38)'; }
  else if (days < 30 || isDecl) { badge = isDecl ? 'WATCH' : 'NEAR'; badgeBg = 'rgba(245,158,11,0.10)'; badgeColor = 'rgb(180,115,0)'; }
  
  const prediction = useMemo(() => predictorEngine.predictPercentile(scores, exam.id), [scores, exam.id]);
  const velocity = prediction?.velocity || 0;
  
  let borderColor = '#f59e0b'; // stable
  let TrendIcon = Minus;
  let trendColor = '#f59e0b';
  let isPulsing = false;
  
  if (velocity > 0) {
    borderColor = '#22c55e'; // trending-up
    TrendIcon = TrendingUp;
    trendColor = '#22c55e';
  } else if (velocity < 0) {
    borderColor = '#ef4444'; // trending-down
    TrendIcon = TrendingDown;
    trendColor = '#ef4444';
    if (days >= 0 && days < 30) isPulsing = true;
  }
  
  return (
    <button onClick={() => navigate('/scores')}
      className={`text-left p-4 rounded-[14px] transition-all duration-200 hover:-translate-y-0.5 ${isPulsing ? 'animate-pulse' : ''}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderLeft: `4px solid ${borderColor}`, boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
          {exam.name}
          <TrendIcon size={14} color={trendColor} />
        </h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide" style={{ background: badgeBg, color: badgeColor }}>{badge}</span>
      </div>
      <div className="font-mono text-xl font-bold" style={{ color: 'var(--text)' }}>
        {days}<span className="text-sm font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>d</span>
        {' '}{String(hours).padStart(2,'0')}<span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>:</span>{String(mins).padStart(2,'0')}
      </div>
    </button>
  );
}

function StatCard({ title, value, icon: Icon, sub, valueColor, onClick }) {
  return (
    <div onClick={onClick} className="flex flex-col p-4 rounded-[14px] transition-all duration-200"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none'; }}}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-tint)' }}>
          <Icon size={14} style={{ color: 'var(--accent)' }} />
        </span>
      </div>
      <span className={`text-2xl font-bold font-mono leading-none mb-1 ${valueColor || ''}`} style={!valueColor ? { color: 'var(--text)' } : {}}>{value}</span>
      {sub && <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const ec = useEngineContext();
  const { setMood, updateSettings } = useAppStore();
  const { hasAI, briefMe, loading: aiLoading } = useAI();
  const [aiDailyBrief, setAiDailyBrief] = useState('');
  const {
    sessions, chapters, scores, flashcards, mood, settings,
    examTimelines, daysToExam, smartPhase,
    subjectVelocity, burnoutState, decayAlerts,
    ghostData, grindIndex, dueCards, studyDebt,
    dailyPlan, todayStr, todayMins, todayHours, resolvedDefs, aiContext
  } = ec;

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(sessions.length === 0);

  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const [quoteIdx, setQuoteIdx] = useState(Math.floor(Math.random() * quotes.length));
  useEffect(() => { const t = setInterval(() => setQuoteIdx(Math.floor(Math.random() * quotes.length)), 45000); return () => clearInterval(t); }, []);

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

  const { longestStreak, currentStreak } = useSessionMetrics();
  const streak = currentStreak;

  const chaptersDone = Object.values(chapters).filter(c => c.done).length;
  let totalScore = 0, scoreCount = 0;
  Object.values(scores).forEach(es => es.forEach(s => { totalScore += s.score; scoreCount++; }));
  const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

  const subjectStats = useMemo(() => {
    const stats = { Math: { done: 0, total: 0 }, Physics: { done: 0, total: 0 }, Chemistry: { done: 0, total: 0 } };
    resolvedDefs.forEach(c => { if (stats[c.subject]) { stats[c.subject].total++; if (chapters[c.id]?.done) stats[c.subject].done++; } });
    return stats;
  }, [chapters, resolvedDefs]);

  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Phase color
  const phaseColor = smartPhase === 'Final Sprint' ? '#ef4444' : smartPhase === 'Revision Phase' ? '#f59e0b' : smartPhase === 'Intensive Phase' ? '#3b82f6' : 'var(--accent)';

  // Subject velocity indicator
  const VelIcon = ({ v }) => v > 0.3 ? <TrendingUp size={11} className="text-green-500" /> : v < -0.3 ? <TrendingDown size={11} className="text-red-500" /> : <Minus size={11} style={{ color: 'var(--text-muted)' }} />;

  // Mood history for trend
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const ds = d.toLocaleDateString('en-CA');
      return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), mood: mood[ds] };
    });
  }, [mood]);

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 pb-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <div>
          <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
            {greeting} · <span style={{ color: phaseColor }}>{smartPhase}</span>
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{dateStr} · {timeStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
            <HelpCircle size={16} />
          </button>
          {studyDebt > 1 && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: 'rgb(220,38,38)' }}>
              <AlertCircle size={12} /> {studyDebt}h debt
            </div>
          )}
          <div className="text-xs px-2.5 py-1.5 rounded-lg font-mono" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>
            {daysToExam < 999 ? `${daysToExam}d to exam` : 'No exam set'}
          </div>
        </div>
      </div>

      {/* Shortcuts popover */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="rounded-xl p-4 z-50 relative" style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', boxShadow:'var(--shadow-md)' }}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Global Shortcuts</p>
              <button onClick={() => setShowShortcuts(false)}><X size={14} style={{ color:'var(--text-muted)' }}/></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GLOBAL_SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-[11px]">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[9px]" style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)' }}>{s.key}</kbd>
                  <span style={{ color:'var(--text-muted)' }}>{s.action}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding banner */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}
            className="px-4 py-3 rounded-xl flex items-center justify-between gap-4"
            style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            <div className="flex items-center gap-3">
              <Sparkles size={18} />
              <div>
                <p className="font-bold text-sm">Welcome to ExamHQ! 🚀</p>
                <p className="text-xs opacity-90">Start by setting your exam dates in <Link to="/settings" className="font-bold underline">Settings</Link> and logging your first session in the <Link to="/timer" className="font-bold underline">Timer</Link>.</p>
              </div>
            </div>
            <button onClick={() => setShowOnboarding(false)} className="p-1 hover:bg-black/5 rounded-full"><X size={16}/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Burnout banner */}
      {burnoutState && burnoutState.currentState >= 1 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: burnoutState.currentState === 2 ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${burnoutState.currentState === 2 ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'}`, color: burnoutState.currentState === 2 ? 'rgb(220,38,38)' : 'rgb(180,115,0)' }}>
          <span className="flex items-center gap-2 font-medium"><AlertTriangle size={14} />{burnoutState.label}: {burnoutState.recommendation || burnoutState.description}</span>
        </div>
      )}

      {/* Decay alert */}
      {decayAlerts.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: 'rgb(220,38,38)' }}>
          <span className="flex items-center gap-2 font-medium"><AlertTriangle size={14} />{decayAlerts.length} {decayAlerts.length === 1 ? 'chapter is' : 'chapters are'} fading from memory</span>
          <Link to="/chapters" className="font-semibold underline underline-offset-2">Review →</Link>
        </div>
      )}

      {/* Exam countdowns */}
      {examTimelines.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {examTimelines.map(exam => (
            <ExamCountdownCard key={exam.id} exam={exam} subjectVelocity={subjectVelocity} scores={scores} />
          ))}
        </div>
      )}

      {/* Grind Index + Daily Brief */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grind Index */}
        <div className="rounded-[14px] p-6 flex flex-col items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="w-full flex items-center justify-between mb-4">
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>Grind Index</h3>
            <span className={`text-xs font-medium flex items-center gap-1 ${grindIndex.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {grindIndex.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {grindIndex.delta >= 0 ? '+' : ''}{grindIndex.delta}
            </span>
          </div>
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="1"/>
                  <stop offset="100%" stopColor="var(--accent-hover)" stopOpacity="0.7"/>
                </linearGradient>
              </defs>
              <circle cx="80" cy="80" r="70" fill="none" stroke="var(--border-light)" strokeWidth="10"/>
              <circle cx="80" cy="80" r="70" fill="none" stroke="url(#ringGrad)" strokeWidth="10"
                strokeDasharray={2 * Math.PI * 70}
                strokeDashoffset={2 * Math.PI * 70 * (1 - grindIndex.score / 1000)}
                strokeLinecap="round" filter="url(#glow)"
                className="transition-all duration-1000 ease-out"/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-bold" style={{ color: 'var(--text)' }}>{grindIndex.score}</span>
              <span className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{grindIndex.label}</span>
            </div>
          </div>
          {/* Subject velocity indicators */}
          <div className="w-full mt-4 grid grid-cols-3 gap-1 text-xs">
            {['Math','Physics','Chemistry'].map(s => (
              <div key={s} className="flex flex-col items-center gap-0.5">
                <VelIcon v={subjectVelocity[s]} />
                <span style={{ color: 'var(--text-muted)' }}>{s.slice(0,4)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Brief */}
        <div className="lg:col-span-2 rounded-[14px] p-6 flex flex-col justify-between"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>Daily Brief</h3>
              <div className="flex items-center gap-2">
                {hasAI && (
                  <button onClick={async () => {
                    const bktBySubj = {};
                    ['Math','Physics','Chemistry'].forEach(s => {
                      const subjChapters = resolvedDefs.filter(c => c.subject === s);
                      const doneChapters = subjChapters.filter(c => chapters[c.id]?.done);
                      if (doneChapters.length > 0) {
                        const avgRet = doneChapters.reduce((sum, c) => sum + (chapters[c.id]?.confidence || 0.5), 0) / doneChapters.length;
                        bktBySubj[s] = Math.round(avgRet * 100);
                      }
                    });
                    const lowestSubj = Object.entries(bktBySubj).sort((a,b) => a[1] - b[1])[0];
                    const nearestExam = examTimelines[0];
                    const ctx = {
                      smartPhase,
                      daysToNearestExam: daysToExam,
                      nearestExamName: nearestExam?.name || 'Unknown',
                      studyDebtHours: studyDebt,
                      todayPlanChapters: dailyPlan.slice(0,3).map(c => c.name),
                      subjectWithLowestBKT: lowestSubj ? lowestSubj[0] : 'N/A',
                      burnoutStateLabel: burnoutState?.label || 'Normal',
                    };
                    const res = await briefMe(ctx);
                    if (res) setAiDailyBrief(res);
                  }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all"
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                    <Sparkles size={9}/> {aiLoading ? '…' : 'Brief me'}
                  </button>
                )}
                <span className="text-xs px-2 py-1 rounded-md font-semibold" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>{smartPhase}</span>
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Priority Chapters (KST + Score-Weighted)</p>
            {aiDailyBrief && (
              <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent)' }}>
                <MarkdownRenderer text={aiDailyBrief} className="text-sm" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {dailyPlan.length > 0 ? dailyPlan.slice(0,5).map(c => (
                <button key={c.id} onClick={() => navigate('/chapters', { state: { search: c.name, subject: c.subject } })}
                  className="text-xs px-2.5 py-1 rounded-md font-medium transition-all duration-150 hover:-translate-y-0.5"
                  style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-medium)'; e.currentTarget.style.color='var(--text-secondary)'; }}>
                  {c.isReview && <span className="mr-1 opacity-60">↻</span>}{c.name}
                  {c.allocatedMinutes && <span className="ml-1.5 opacity-50">{c.allocatedMinutes}m</span>}
                </button>
              )) : <span className="text-sm" style={{ color: 'var(--text-muted)' }}>All caught up!</span>}
            </div>
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>How are you feeling?</p>
                <div className="flex gap-2">
                  {['😩','😴','😐','😊','🔥'].map(m => (
                    <button key={m} onClick={() => setMood(todayStr, m)}
                      className="text-xl p-2 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95"
                      style={{ background: mood[todayStr] === m ? 'var(--accent-tint)' : 'var(--bg-sidebar)', border: mood[todayStr] === m ? '1px solid var(--accent)' : '1px solid transparent' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 max-w-[200px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-right" style={{ color: 'var(--text-muted)' }}>Mood Trend</p>
                <div className="flex justify-between items-center gap-1 h-8">
                  {last7Days.map((d, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 group relative">
                      <div className="text-[14px] opacity-80 group-hover:opacity-100 transition-opacity">
                        {d.mood || <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-medium)]"/>}
                      </div>
                      <span className="text-[8px] mt-0.5 uppercase hidden group-hover:block absolute -bottom-3 bg-[var(--bg-card)] px-1 rounded border border-[var(--border-light)] z-10" style={{ color: 'var(--text-muted)' }}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Target */}
      <div className="rounded-[14px] px-5 py-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Today's Target</span>
          <div className="flex items-center gap-3">
            {studyDebt > 0 && <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>debt: {studyDebt}h</span>}
            <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>
              {todayHours.toFixed(1)}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{settings.dailyTargetHours}h</span>
            </span>
          </div>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-sidebar)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (todayHours / settings.dailyTargetHours) * 100)}%`, background: todayHours >= settings.dailyTargetHours ? '#22c55e' : todayHours >= settings.dailyTargetHours * 0.5 ? '#f59e0b' : 'var(--accent)' }}/>
        </div>
        <div className="flex justify-between mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{todayHours >= settings.dailyTargetHours ? '🎯 Target reached!' : `${(settings.dailyTargetHours - todayHours).toFixed(1)}h remaining`}</span>
          <span>{Math.round((todayHours / settings.dailyTargetHours) * 100)}%</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard title="Streak" value={`${streak}d`} icon={Flame} sub="consecutive days" onClick={() => navigate('/timer')}/>
        <StatCard title="Today" value={`${todayHours.toFixed(1)}h`} icon={Clock} sub="studied today" onClick={() => navigate('/timer')}/>
        <StatCard title="Chapters" value={chaptersDone} icon={BookOpen} sub={`of ${resolvedDefs.length} total`} onClick={() => navigate('/chapters')}/>
        <StatCard title="Avg Mock" value={avgScore || '—'} icon={Target} sub={`${scoreCount} attempts`} onClick={() => navigate('/scores')}/>
        <StatCard title="Due Cards" value={dueCards} icon={BrainCircuit} sub="for review" onClick={() => navigate('/flashcards')}/>
      </div>

      {/* Subject progress rings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {['Math','Physics','Chemistry'].map(subj => {
          const st = subjectStats[subj];
          const pct = st.total > 0 ? st.done / st.total : 0;
          const r = 15; const circ = 2 * Math.PI * r;
          const vel = subjectVelocity[subj];
          const velLabel = vel > 0.3 ? `+${vel.toFixed(1)}` : vel < -0.3 ? vel.toFixed(1) : '→';
          const velColor = vel > 0.3 ? '#22c55e' : vel < -0.3 ? '#ef4444' : 'var(--text-muted)';
          return (
            <button key={subj} onClick={() => navigate('/chapters', { state: { subject: subj } })}
              className="p-4 rounded-[14px] transition-all duration-200 text-left hover:-translate-y-0.5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border-light)" strokeWidth="3.5"/>
                    <circle cx="18" cy="18" r={r} fill="none" stroke="var(--accent)" strokeWidth="3.5"
                      strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
                      className="transition-all duration-700"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold font-mono" style={{ color: 'var(--text)' }}>{Math.round(pct * 100)}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{subj}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{st.done}/{st.total} chapters</div>
                </div>
                <div className="text-xs font-mono font-bold" style={{ color: velColor }}>{velLabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ghost competitor */}
      {ghostData && (
        <div className="rounded-[14px] p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Ghost Competitor</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }}/>You</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full opacity-40" style={{ background: 'var(--text-muted)' }}/>Ghost</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-xs p-3 rounded-xl" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)' }}>
             <div className="flex items-center gap-1.5">
               <Target size={13} style={{ color: 'var(--text-muted)' }} />
               <span style={{ color: 'var(--text-muted)' }}>Pace:</span> 
               <span className="font-mono font-bold" style={{ color: 'var(--text)' }}>{ghostData.ghostDailyTarget}h/d</span>
             </div>
             <div className="flex items-center gap-1.5">
               <BookOpen size={13} style={{ color: 'var(--text-muted)' }} />
               <span style={{ color: 'var(--text-muted)' }}>Focusing on:</span> 
               <span className="font-bold" style={{ color: 'var(--text)' }}>{ghostData.ghostFocusSubject || 'General'}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <BrainCircuit size={13} style={{ color: 'var(--text-muted)' }} />
               <span style={{ color: 'var(--text-muted)' }}>Completion est:</span> 
               <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{Math.round(ghostData.ghostCompletionRatio * 100)}%</span>
             </div>
          </div>
          <p className="text-xs mb-3" style={{ color: ghostData.delta >= 0 ? '#22c55e' : '#ef4444' }}>{ghostData.message}</p>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={ghostData.weeklyBars} barGap={2} barSize={14}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 11 }} formatter={(v, n) => [`${v}h`, n === 'userHours' ? 'You' : 'Ghost']}/>
              <Bar dataKey="ghostHours" fill="var(--border-medium)" radius={[3,3,0,0]}/>
              <Bar dataKey="userHours" fill="var(--accent)" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Study Heatmap */}
      <div className="rounded-[14px] p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Activity — Last 30 Days</h3>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (29 - i));
            const dayStr = d.toISOString().split('T')[0];
            const dayMins = sessions.filter(s => s.date?.startsWith(dayStr)).reduce((a, s) => a + (s.mins || 0), 0);
            const pct = Math.min(1, dayMins / ((settings.dailyTargetHours || 8) * 60));
            const opacity = pct === 0 ? 0.08 : 0.15 + pct * 0.85;
            return (
              <div key={i} className="aspect-square rounded-[3px] transition-all hover:scale-125"
                style={{ background: `var(--accent)`, opacity, cursor: 'default' }}
                title={`${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}: ${Math.round(dayMins / 60 * 10) / 10}h`}/>
            );
          })}
        </div>
      </div>

      {/* Quote */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <p className="text-sm italic flex-1" style={{ color: 'var(--text-secondary)' }}>"{quotes[quoteIdx] || 'Keep grinding.'}"</p>
        <button onClick={() => setQuoteIdx(Math.floor(Math.random() * quotes.length))}
          className="p-1.5 rounded-lg transition-all hover:rotate-180 duration-300"
          style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={13}/>
        </button>
      </div>

    </div>
  );
}
