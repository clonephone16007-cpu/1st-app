import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useEngineContext } from '../hooks/useEngineContext';
import { exams } from '../data/exams';
import { predictorEngine } from '../engines/predictorEngine';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Edit3, X, HelpCircle } from 'lucide-react';
import { GLOBAL_SHORTCUTS } from '../config/shortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from 'sonner';

const INPUT_STYLE = {
  background: 'var(--bg-sidebar)',
  border: '1px solid var(--border-medium)',
  color: 'var(--text)',
  borderRadius: '10px',
  fontSize: '14px',
};

export default function Scores() {
  const { scores, addScore, updateScore, deleteScore, settings } = useAppStore();
  
  const getMostRecentExamId = () => {
    const active = exams.filter(e => settings.activeExams?.includes(e.id));
    if (!active.length) return exams[0].id;
    let mostRecentDate = -1;
    let latestExam = active[0].id;
    active.forEach(e => {
      const eScores = scores[e.id] || [];
      if (eScores.length > 0) {
        const maxDate = Math.max(...eScores.map(s => new Date(s.date).getTime()));
        if (maxDate > mostRecentDate) {
          mostRecentDate = maxDate;
          latestExam = e.id;
        }
      }
    });
    return latestExam;
  };
  
  const ec = useEngineContext();
  const [selectedExam, setSelectedExam] = useState(getMostRecentExamId);
  const [showAllExams, setShowAllExams] = useState(false);
  const [dateError, setDateError] = useState(false);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingScoreId, setEditingScoreId] = useState(null);
  const [newScore, setNewScore] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newNote, setNewNote] = useState('');
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts('GLOBAL', {
    'Show this help': () => setShowShortcuts(s => !s),
  });

  const examData = exams.find(e => e.id === selectedExam);
  const examScores = scores[selectedExam] || [];
  const sortedScores = [...examScores].sort((a, b) => new Date(a.date) - new Date(b.date));

  const handleDateChange = (e) => {
    const val = e.target.value;
    const today = new Date().toISOString().split('T')[0];
    if (val > today) {
      setDateError(true);
      setTimeout(() => setDateError(false), 500);
      return;
    }
    setDateError(false);
    setNewDate(val);
  };

  const handleAddScore = (e) => {
    e.preventDefault();
    const scoreVal = parseInt(newScore);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > examData.totalMarks) {
      toast.error(`Score must be 0–${examData.totalMarks}`);
      return;
    }
    if (editingScoreId) {
      updateScore(selectedExam, editingScoreId, { score: scoreVal, date: newDate, note: newNote });
      toast.success('Score updated');
    } else {
      addScore(selectedExam, { id: Date.now().toString(), score: scoreVal, date: newDate, note: newNote });
      toast.success('Score logged!');
    }
    setNewScore(''); setNewNote(''); setEditingScoreId(null); setIsAdding(false);
  };

  const handleEditScore = (score) => {
    setNewScore(score.score.toString()); setNewDate(score.date); setNewNote(score.note || '');
    setEditingScoreId(score.id); setIsAdding(true);
  };

  const cancelAdd = () => { setIsAdding(false); setEditingScoreId(null); setNewScore(''); setNewNote(''); };

  const getDaysRemaining = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

  const sparklineData = sortedScores.slice(-10).map((s, i) => ({
    name: `#${i + 1}`,
    score: s.score,
    pct: Math.round((s.score / examData.totalMarks) * 100),
    date: new Date(s.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
  }));

  const latestScore = sortedScores.length > 0 ? sortedScores[sortedScores.length - 1].score : null;
  const previousScore = sortedScores.length > 1 ? sortedScores[sortedScores.length - 2].score : null;
  const delta = latestScore !== null && previousScore !== null ? latestScore - previousScore : null;
  const latestPct = latestScore !== null ? ((latestScore / examData.totalMarks) * 100).toFixed(1) : null;

  const prediction = useMemo(() => {
    if (sortedScores.length < 2) return null;
    return predictorEngine.predictPercentile(scores, selectedExam);
  }, [scores, selectedExam, sortedScores.length]);

  // FIX: pass real sessions, chapters, eqLog instead of null — enables full
  // session pattern analysis (avg session length, subject distribution, etc.)
  const insights = useMemo(() => predictorEngine.generateInsights(
    scores,
    ec.chapters,
    ec.sessions,
    ec.eqLog ?? null,
  ), [scores, ec.chapters, ec.sessions]);

  const activeExams = exams.filter(e => settings.activeExams?.includes(e.id));
  const isDuplicateDate = sortedScores.some(s => s.date === newDate && s.id !== editingScoreId);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif" style={{ color: 'var(--text)' }}>Mock Scores</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Track performance and predict outcomes</p>
        </div>
        <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
          <HelpCircle size={16} />
        </button>
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

      {/* Exam selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(() => {
          const examsWithScores = activeExams.filter(e => (scores[e.id] || []).length > 0);
          const visibleExams = showAllExams || examsWithScores.length === 0 ? activeExams : examsWithScores;
          
          return (
            <>
              {visibleExams.map(exam => {
                const days = getDaysRemaining(exam.date);
                const isSelected = selectedExam === exam.id;
                const examScoresList = scores[exam.id] || [];
                const latest = examScoresList.length > 0 ? examScoresList[examScoresList.length - 1].score : null;
                return (
                  <button key={exam.id} onClick={() => setSelectedExam(exam.id)}
                    className="text-left p-4 rounded-[14px] transition-all duration-150 hover:-translate-y-0.5"
                    style={{
                      background: isSelected ? 'var(--bg-card)' : 'var(--bg-sidebar)',
                      border: isSelected ? `2px solid ${exam.color}` : '1px solid var(--border-light)',
                      boxShadow: isSelected ? `0 0 0 1px ${exam.color}30, var(--shadow-md)` : 'var(--shadow-xs)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>{exam.name}</h3>
                      <span className="w-2 h-2 rounded-full" style={{
                        background: days < 30 ? 'rgb(239,68,68)' : days < 90 ? 'rgb(245,158,11)' : 'rgb(34,197,94)'
                      }} />
                    </div>
                    <div className="font-mono text-lg font-bold" style={{ color: isSelected ? exam.color : 'var(--text)' }}>
                      {days > 0 ? `${days}d` : 'Done'}
                    </div>
                    {latest !== null && (
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Last: {latest}</div>
                    )}
                  </button>
                );
              })}
              {!showAllExams && examsWithScores.length > 0 && examsWithScores.length < activeExams.length && (
                <button onClick={() => setShowAllExams(true)}
                  className="flex flex-col items-center justify-center p-4 rounded-[14px] transition-all hover:-translate-y-0.5 h-full"
                  style={{ background: 'var(--bg-sidebar)', border: '1px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                  <Plus size={20} className="mb-1" />
                  <span className="text-xs font-semibold text-center leading-tight">Add scores for<br/>another exam</span>
                </button>
              )}
            </>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Stats + chart + history */}
        <div className="lg:col-span-2 space-y-4">

          {/* Latest score stat */}
          <div className="rounded-[14px] p-6 flex flex-col sm:flex-row items-center justify-between gap-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Latest Score</p>
              {latestScore !== null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-mono font-bold" style={{ color: 'var(--accent)' }}>{latestScore}</span>
                    <span className="text-lg" style={{ color: 'var(--text-muted)' }}>/ {examData.totalMarks}</span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{latestPct}%</p>
                </>
              ) : (
                <p className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>—</p>
              )}
            </div>
            {delta !== null && (
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>vs Previous</p>
                <div className={`flex items-center gap-1.5 text-2xl font-bold ${delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : ''}`}
                  style={delta === 0 ? { color: 'var(--text-muted)' } : {}}>
                  {delta > 0 ? <TrendingUp size={22} /> : delta < 0 ? <TrendingDown size={22} /> : <Minus size={22} />}
                  {delta > 0 ? '+' : ''}{delta}
                </div>
              </div>
            )}
          </div>

          {/* Area chart */}
          <div className="rounded-[14px] p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text)' }}>Score Trend</h2>
            {sparklineData.length >= 2 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData.map((d, i) => ({
                  ...d,
                  ghost: (() => {
                    const gDaily = ec.ghostData?.ghostDailyTarget ?? 0;
                    const vel = Object.values(ec.subjectVelocity || {})[0] ?? 0;
                    // Ghost score = previous score × (1 + simulated study improvement rate)
                    if (i === 0) return d.score;
                    return Math.min(examData?.totalMarks || 300, Math.round(d.score * (1 + gDaily * 0.001)));
                  })(),
                }))} margin={{ top: 5, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)', borderColor: 'var(--border-light)',
                        borderRadius: '10px', fontSize: '12px', boxShadow: 'var(--shadow-md)',
                      }}
                      formatter={v => [v, 'Score']}
                    />
                    <Area type="monotone" dataKey="ghost" stroke="var(--border-medium)" fill="transparent"
                      strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Ghost" />
                    <Area type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2.5}
                      fill="url(#scoreGrad)" dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center rounded-xl"
                style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                <TrendingUp size={28} className="mb-2 opacity-30" />
                <p className="text-sm">Add at least 2 scores to see trend</p>
              </div>
            )}
          </div>

          {/* Score history */}
          <div className="rounded-[14px] overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-light)' }}>
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Score History</h2>
              <button
                onClick={() => isAdding ? cancelAdd() : setIsAdding(true)}
                className="flex items-center gap-1.5 text-xs font-bold transition-colors"
                style={{ color: isAdding ? 'var(--text-muted)' : 'var(--accent)' }}
              >
                {isAdding ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add Score</>}
              </button>
            </div>

            <AnimatePresence>
              {isAdding && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <form onSubmit={handleAddScore} className="p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Score</label>
                        <input type="number" value={newScore} onChange={e => setNewScore(e.target.value)}
                          placeholder={`Max ${examData.totalMarks}`} required
                          className="w-24 px-3 py-2 focus:outline-none" style={INPUT_STYLE} />
                      </div>
                      <div className="relative">
                        <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Date</label>
                        <input type="date" value={newDate} onChange={handleDateChange}
                          max={new Date().toISOString().split('T')[0]}
                          className={`w-36 px-3 py-2 focus:outline-none ${dateError ? 'shake' : ''}`} style={{ ...INPUT_STYLE, borderColor: dateError ? 'rgb(239,68,68)' : 'var(--border-medium)' }} />
                        {dateError && <span className="absolute -bottom-5 left-0 text-[10px] text-red-500 whitespace-nowrap">Mock scores can't be future-dated</span>}
                      </div>
                      <div className="flex-1 min-w-40">
                        <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Note (optional)</label>
                        <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
                          placeholder="e.g. Silly mistakes in Chemistry"
                          className="w-full px-3 py-2 focus:outline-none" style={INPUT_STYLE} />
                      </div>
                      <button type="submit"
                        className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                        style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}>
                        {editingScoreId ? 'Update' : 'Save'}
                      </button>
                    </div>
                    {isDuplicateDate && (
                      <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: 'rgb(245,158,11)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        You already have a {examData.name} score for this date. Adding another will create a duplicate.
                      </div>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ divideColor: 'var(--border-light)' }}>
              {[...sortedScores].reverse().slice(0, 8).map((score, i) => (
                <div key={score.id}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors"
                  style={{ borderBottom: '1px solid var(--border-light)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sidebar)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold font-mono text-base" style={{ color: 'var(--text)' }}>{score.score}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {examData.totalMarks}</span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>
                        {((score.score / examData.totalMarks) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(score.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {score.note && <span className="italic ml-2">· {score.note}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEditScore(score)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => {
                        const snapshot = { ...score };
                        const examId = selectedExam;
                        deleteScore(examId, score.id);
                        toast('Score deleted', {
                          action: {
                            label: 'Undo',
                            onClick: () => addScore(examId, snapshot),
                          },
                          duration: 5000,
                        });
                      }}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'rgb(239,68,68)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {sortedScores.length === 0 && (
                <div className="py-12 m-4 text-center rounded-xl" style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                  <TrendingUp size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Log your first {examData.name} mock score to start tracking your AIR trajectory.</p>
                  <button onClick={() => setIsAdding(true)} className="mt-4 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5" style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}>
                    Add Score
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Predictor + Strategies */}
        <div className="space-y-4">

          {/* Predictor */}
          <div className="rounded-[14px] p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text)' }}>Outcome Predictor</h2>
            {prediction ? (
              <div className="space-y-3">
                {/* Kalman estimate */}
                <div className="p-4 rounded-xl text-center"
                  style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                    Kalman Estimate
                  </p>
                  <div className="text-4xl font-mono font-bold" style={{ color: 'var(--accent)' }}>
                    {Math.round(prediction.predicted)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    95% CI: {Math.round(prediction.low)}–{Math.round(prediction.high)}
                  </p>
                  {prediction.velocity !== undefined && (
                    <p className={`text-xs font-semibold mt-1 ${prediction.velocity >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {prediction.velocity >= 0 ? '+' : ''}{prediction.velocity} marks/session
                    </p>
                  )}
                </div>

                {/* Monte Carlo AIR */}
                {prediction.airEstimate && (
                  <div className="p-3 rounded-xl"
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Monte Carlo AIR (8,000 simulations)
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Optimistic', val: prediction.airEstimate.optimistic, color: 'rgb(34,197,94)' },
                        { label: 'Median', val: prediction.airEstimate.median, color: 'var(--accent)' },
                        { label: 'Pessimistic', val: prediction.airEstimate.pessimistic, color: 'rgb(239,68,68)' },
                      ].map(({ label, val, color }) => (
                        <div key={label}>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                          <p className="font-mono font-bold text-sm" style={{ color }}>
                            {val?.toLocaleString('en-IN')}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                      {(() => {
                        const target = settings?.targetAIR?.[selectedExam];
                        if (!target || !prediction.airEstimate) return null;
                        const { optimistic, pessimistic } = prediction.airEstimate;
                        const range = pessimistic - optimistic;
                        const hitPct = Math.max(0, Math.min(100,
                          ((pessimistic - target) / (range || 1)) * 100
                        ));
                        return (
                          <div className="h-full rounded-full" style={{
                            width: `${hitPct}%`,
                            background: hitPct > 50 ? 'rgb(34,197,94)' : hitPct > 25 ? 'rgb(245,158,11)' : 'rgb(239,68,68)',
                          }} />
                        );
                      })()}
                    </div>
                    {settings?.targetAIR?.[selectedExam] && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Target AIR {settings.targetAIR[selectedExam].toLocaleString('en-IN')} shown on bar
                      </p>
                    )}
                  </div>
                )}

                {/* Trend + velocity */}
                <div className="flex justify-between items-center p-3 rounded-xl"
                  style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Trend</span>
                  <span className={`font-bold text-sm flex items-center gap-1 ${
                    prediction.trend === 'Upward' ? 'text-green-500' :
                    prediction.trend === 'Downward' ? 'text-red-500' : ''
                  }`} style={prediction.trend === 'Stable' ? { color: 'var(--text-muted)' } : {}}>
                    {prediction.trend === 'Upward' ? <TrendingUp size={14} /> : prediction.trend === 'Downward' ? <TrendingDown size={14} /> : <Minus size={14} />}
                    {prediction.trend}
                  </span>
                </div>

                {/* Insights */}
                {insights && (
                  <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--border-light)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Insights</p>
                    <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <p><span className="font-bold text-green-500">↑</span> {insights.strengths}</p>
                      <p><span className="font-bold text-red-500">↓</span> {insights.weaknesses}</p>
                      <ul className="space-y-1 mt-1">
                        {insights.actionPlan.map((a, i) => (
                          <li key={i} className="pl-2" style={{ borderLeft: '2px solid var(--border-medium)' }}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center rounded-xl" style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                <p className="text-sm">Need ≥2 scores to run Kalman filter</p>
              </div>
            )}
          </div>

          {/* Strategies */}
          <div className="rounded-[14px] overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="px-5 py-3.5" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-light)' }}>
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Exam Strategy</h2>
            </div>
            {exams.map(exam => (
              <div key={exam.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <button
                  onClick={() => setExpandedStrategy(expandedStrategy === exam.id ? null : exam.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors text-sm font-semibold"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sidebar)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {exam.name}
                  {expandedStrategy === exam.id ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                </button>
                <AnimatePresence>
                  {expandedStrategy === exam.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="px-5 pb-4 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {exam.id === 'jee' && 'Focus on high-weightage topics like 3D Geometry and Current Electricity. Accuracy > speed. Attempt Chemistry first.'}
                        {exam.id === 'cet' && 'Speed is crucial — no negative marking, attempt all. State-board topics like Mathematical Logic are key.'}
                        {exam.id === 'met' && 'Balanced approach. English and Aptitude are scoring. Difficulty is generally lower than JEE.'}
                        {exam.id === 'ugee' && 'SUPR tests core concepts. REAP tests analytical skills. Focus on linguistics and logic for REAP.'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
