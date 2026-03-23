import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTimerStore } from '../store/useTimerStore';
import { useAppStore } from '../store/useAppStore';
import FocusMode from '../components/FocusMode';
import { Play, Pause, Square, Focus, Trash2, Sparkles, HelpCircle, X, Star } from 'lucide-react';
import { TIMER_SHORTCUTS } from '../config/shortcuts';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useEngineContext } from '../hooks/useEngineContext';
import { useAI } from '../hooks/useAI';
import { usePageActivity } from '../hooks/usePageActivity';
import { useIdleDetection } from '../hooks/useIdleDetection';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useDebriefSignals } from '../hooks/useDebriefSignals';
import MarkdownRenderer from '../components/MarkdownRenderer';

const MODES = [
  { id: 'pomodoro', label: 'Pomodoro', mins: 25 },
  { id: 'short',    label: 'Short',    mins: 15 },
  { id: 'long',     label: 'Long',     mins: 50 },
  { id: 'custom',   label: 'Custom',   mins: null },
  { id: 'free',     label: 'Free',     mins: 0 },
];

const SUBJECTS = ['Math', 'Physics', 'Chemistry', 'General'];

const SUBJECT_COLORS = {
  Math:      '#D4870A',
  Physics:   '#2471A3',
  Chemistry: '#7D3C98',
  General:   'var(--accent)',
};


// Session quality: duration × subject knapsack density × BKT signal
function sessionQuality(session, dailyPlan) {
  const mins = session.mins || 0;
  const planEntry = (dailyPlan || []).find(p => p.subject === session.subject);
  const valueDensity = planEntry ? (planEntry.valueDensity || 0.5) : 0.3;
  const raw = Math.min(1, (mins / 90) * 0.6 + valueDensity * 0.4);
  return raw;
}

export default function Timer() {
  const { running, paused, elapsed, target, mode, subject, start, pause, resume, stop, setMode, setSubject, tick } =
    useTimerStore();

  // FIX: merged two separate useAppStore() calls into one
  const { sessions, addSession, updateSession, deleteSession, settings, scores, chapters } = useAppStore();

  const ec = useEngineContext();
  const { hasAI, debriefSession, loading: aiLoading } = useAI();
  const [aiDebrief, setAiDebrief] = useState(null);

  const { processDebriefSignals } = useDebriefSignals();
  const [showDebrief, setShowDebrief] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [debriefAnswers, setDebriefAnswers] = useState({ clarity: null, practice: null, energy: null, confidence: 0 });

  // Thompson Sampling subject suggestion (from engine context)
  const suggestedSubject = ec.suggestedSubject;

  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [customMins, setCustomMins] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts('GLOBAL', {
    'Show this help': () => setShowShortcuts(s => !s),
  });
  const wakeLockRef = useRef(null);
  const customInputRef = useRef(null);
  
  usePageActivity('Timer');

  useIdleDetection(300000, () => {
    if (running && !paused) {
      pause();
      toast.error('Timer auto-paused after 5 mins of inactivity.');
    }
  });

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  const requestWakeLock = async () => {
    if (settings.keepAwake && 'wakeLock' in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
    }
  };
  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    let interval;
    if (running && !paused) {
      interval = setInterval(() => tick(), 1000);
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => { clearInterval(interval); releaseWakeLock(); };
  }, [running, paused, tick, settings.keepAwake]);

  const handleSaveAndStop = useCallback(() => {
    if (elapsed >= 30) {
      const sessionId = Date.now().toString();
      addSession({
        id: sessionId,
        subject,
        mins: Math.max(1, Math.floor(elapsed / 60)),
        date: new Date().toISOString(),
        mode,
      });
      setPendingSessionId(sessionId);
      setDebriefAnswers({ clarity: null, practice: null, energy: null, confidence: 0 });
      setShowDebrief(true);
    } else if (elapsed > 0) {
      toast.info('Session too short to save (min 30 seconds)');
    }
    stop();
  }, [elapsed, subject, mode, addSession, stop]);

  const submitDebrief = (skipped = false) => {
    setShowDebrief(false);
    if (!pendingSessionId) return;
    
    const sessionForDebrief = sessions.find(s => s.id === pendingSessionId) || { id: pendingSessionId, subject, mins: Math.max(1, Math.floor(elapsed / 60)), mode };

    if (!skipped) {
      updateSession(pendingSessionId, { debrief: debriefAnswers });
      processDebriefSignals(debriefAnswers, sessionForDebrief);
    }

    const subjectProfile = ec.subjectProfiles?.[sessionForDebrief.subject] || { velocity: 1.0 };
    const bktLevel = ec.bktState?.[sessionForDebrief.subject]?.knowledge || 0.5;
    const airMovement = Math.max(1, Math.round((sessionForDebrief.mins / 60) * 20 * Math.max(0.2, subjectProfile.velocity) * (1 + bktLevel)));
    
    toast.success('Session saved! 🚀', {
      description: `Estimated +${airMovement} AIR spots trajectory gain.`,
      duration: 5000
    });
    
    if (hasAI) {
      setAiDebrief(null);
      const ctx = {
        sessionMins: sessionForDebrief.mins,
        subject: sessionForDebrief.subject,
        subjectBKT: Math.round(bktLevel * 100),
        subjectVelocity: subjectProfile.velocity,
        daysToExam: ec.daysToExam,
        nextRecommendedSubject: ec.suggestedSubject,
        studyDebtHours: ec.studyDebt || 0
      };
      debriefSession(ctx).then(res => { if (res) setAiDebrief(res); });
    }
    setPendingSessionId(null);
  };

  // FIX: handleSaveAndStop is now in the dep array — no more stale closure
  useEffect(() => {
    if (running && target > 0 && elapsed >= target) {
      playBeep();
      toast.success('Session complete! Great work 🎉');
      if (settings.notifications && Notification.permission === 'granted') {
        new Notification('ExamHQ', { body: 'Timer completed!' });
      }
      handleSaveAndStop();
    }
  }, [elapsed, target, running, handleSaveAndStop, settings.notifications]);

  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [showCustomInput]);

  const handleModeSelect = (modeId) => {
    if (running) return;
    setMode(modeId);
    setShowCustomInput(modeId === 'custom');
  };

  const handleStart = () => {
    if (Notification.permission === 'default' && settings.notifications) {
      Notification.requestPermission();
    }
    let targetSecs = 0;
    const selectedMode = MODES.find(m => m.id === mode);
    if (mode === 'custom') {
      const val = parseInt(customMins);
      if (!val || val <= 0 || val > 720) {
        toast.error('Enter a valid time between 1 and 720 minutes');
        return;
      }
      targetSecs = val * 60;
    } else if (selectedMode) {
      targetSecs = selectedMode.mins * 60;
    }
    start(targetSecs, mode, subject);
  };

  useKeyboardShortcuts('TIMER', {
    'Play / Pause': () => { if (running) { paused ? resume() : pause(); } },
    'Start timer': () => { if (!running && !showCustomInput) handleStart(); },
    'Exit fullscreen / Focus mode': () => { setShowFullscreen(false); setShowFocusMode(false); },
    'Enter Focus Mode': () => setShowFocusMode(true)
  });

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const radius = 90;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  let dashoffset = circumference; // empty by default
  if (running || paused) {
    if (target > 0) {
      dashoffset = circumference * (1 - Math.min(1, elapsed / target));
    } else {
      dashoffset = circumference * (1 - (elapsed % 3600) / 3600);
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.date.startsWith(todayStr)).reverse();
  const totalMins = todaySessions.reduce((acc, s) => acc + s.mins, 0);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapData = weekDays.map((d, i) => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = day.toISOString().split('T')[0];
    const currentDayIdx = (now.getDay() + 6) % 7;
    const isToday = i === currentDayIdx;
    const mins = sessions
      .filter(s => (s.date || '').startsWith(dayStr))
      .reduce((acc, s) => acc + (s.mins || 0), 0);
    return { day: d, mins, isToday };
  });

  const accentColor = SUBJECT_COLORS[subject] || 'var(--accent)';

  const getQualityColor = (clarity, defaultColor) => {
    switch (clarity) {
      case 'clicked': return '#22c55e';
      case 'confused': return '#f59e0b';
      case 'struggling': return '#ef4444';
      default: return 'var(--text-muted)'; // okay or null/skipped
    }
  };

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-6 pb-8">

      {showFocusMode && (
        <FocusMode
          isOpen={showFocusMode}
          onClose={() => setShowFocusMode(false)}
          timer={target > 0 ? target - elapsed : elapsed}
          currentSubject={subject}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-serif" style={{ color: 'var(--text)' }}>Timer</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
            <HelpCircle size={16} />
          </button>
          <button
            onClick={() => setShowFocusMode(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Focus size={15} /> Focus Mode
          </button>
        </div>
      </div>

      {/* Shortcuts popover */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="rounded-xl p-4 z-50 relative" style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', boxShadow:'var(--shadow-md)' }}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Timer Shortcuts</p>
              <button onClick={() => setShowShortcuts(false)}><X size={14} style={{ color:'var(--text-muted)' }}/></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIMER_SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-[11px]">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[9px]" style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)' }}>{s.key}</kbd>
                  <span style={{ color:'var(--text-muted)' }}>{s.action}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Timer Card */}
      <div className="rounded-[18px] p-6 md:p-10 flex flex-col items-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>

        {/* Subject selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-7">
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => !running && setSubject(s)}
              disabled={running}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150"
              style={{
                background: subject === s ? accentColor : 'var(--bg-sidebar)',
                color: subject === s && s !== 'General' ? '#fff'
                  : subject === s ? 'var(--bg)'
                  : 'var(--text-secondary)',
                opacity: running && subject !== s ? 0.4 : 1,
                cursor: running ? 'not-allowed' : 'pointer',
                border: subject === s ? 'none' : '1px solid var(--border-light)',
              }}
            >
              {s}
            </button>
          ))}
          {!running && (
            <button
              onClick={() => { setSubject(suggestedSubject); toast.success(`Smart suggest: ${suggestedSubject}`); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 hover:scale-105"
              style={{ background: 'var(--accent-tint)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
              title="Thompson Sampling recommendation"
            >
              <Sparkles size={11} /> Suggest
            </button>
          )}
        </div>

        {/* Mode chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleModeSelect(m.id)}
              disabled={running}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150"
              style={{
                background: mode === m.id ? 'var(--accent-tint)' : 'transparent',
                color: mode === m.id ? 'var(--accent)' : 'var(--text-muted)',
                border: mode === m.id ? '1px solid var(--accent)' : '1px solid var(--border-medium)',
                opacity: running && mode !== m.id ? 0.4 : 1,
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {m.label}{m.mins ? ` · ${m.mins}m` : ''}
            </button>
          ))}
        </div>

        {/* Custom time input */}
        {showCustomInput && !running && (
          <div className="flex items-center gap-2 mb-6">
            <input
              ref={customInputRef}
              type="number"
              min="1"
              max="720"
              value={customMins}
              onChange={e => setCustomMins(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="Minutes"
              className="w-28 text-center rounded-lg px-3 py-2 font-mono text-sm font-bold"
              style={{
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text)',
              }}
            />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>min</span>
          </div>
        )}

        {/* Timer ring */}
        <div className="relative w-60 h-60 mb-8 flex items-center justify-center">
          <svg
            className={`absolute inset-0 w-full h-full -rotate-90 ${running && !paused ? 'timer-glow' : ''}`}
            viewBox="0 0 200 200"
          >
            <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--border-light)" strokeWidth={stroke} />
            <circle
              cx="100" cy="100" r={radius} fill="none"
              stroke={accentColor}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 linear"
            />
          </svg>
          <div className="flex flex-col items-center z-10 gap-1">
            <span className="font-mono text-5xl font-bold tracking-tighter" style={{ color: 'var(--text)' }}>
              {running
                ? (target > 0 ? formatTime(target - elapsed) : formatTime(elapsed))
                : mode === 'free'
                  ? '00:00'
                  : mode === 'custom'
                    ? (customMins ? formatTime(parseInt(customMins) * 60) : '00:00')
                    : formatTime((MODES.find(m => m.id === mode)?.mins || 25) * 60)
              }
            </span>
            {running && (
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {paused ? 'Paused' : `Studying ${subject}`}
              </span>
            )}
            {!running && (
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {mode === 'free' ? 'Count up · no limit' : 'Ready to start'}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {!running ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-base transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg active:shadow-sm"
              style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}
            >
              <Play size={18} strokeWidth={2.5} />
              Start Session
            </button>
          ) : (
            <>
              <button
                onClick={paused ? resume : pause}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text)',
                }}
              >
                {paused ? <Play size={18} /> : <Pause size={18} />}
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleSaveAndStop}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}
              >
                <Square size={18} />
                Save & Stop
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* AI Debrief */}
      {hasAI && aiDebrief && (
        <div className="rounded-[14px] p-4 space-y-2 animate-fade-in-up"
          style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={13} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>AI Debrief</span>
            <button onClick={() => setAiDebrief(null)} className="ml-auto opacity-40 hover:opacity-100"><span style={{ fontSize: 14 }}>×</span></button>
          </div>
          <MarkdownRenderer text={aiDebrief} className="text-sm leading-relaxed" />
        </div>
      )}

      {/* Today's Sessions */}
        <div className="rounded-[14px] p-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text)' }}>Today's Sessions</h3>

          {todaySessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
              <Play size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No sessions logged today</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Start your first session above</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {todaySessions.map(s => (
                <div
                  key={s.id}
                  className="flex justify-between items-center px-3 py-2.5 rounded-lg"
                  style={{
                    background: 'var(--bg-sidebar)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                      background: s.debrief ? getQualityColor(s.debrief.clarity, SUBJECT_COLORS[s.subject] || 'var(--accent)') : 'transparent',
                      border: `1px solid ${s.debrief ? getQualityColor(s.debrief.clarity, SUBJECT_COLORS[s.subject] || 'var(--accent)') : 'var(--border-medium)'}`
                    }} />
                    <span
                      className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{
                        background: SUBJECT_COLORS[s.subject] ? `${SUBJECT_COLORS[s.subject]}18` : 'var(--accent-tint)',
                        color: SUBJECT_COLORS[s.subject] || 'var(--accent)',
                      }}
                    >
                      {s.subject}
                    </span>
                    <span className="font-mono text-sm font-bold" style={{ color: 'var(--text)' }}>{s.mins}m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(s.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      <div className="ml-auto flex items-center gap-1 mt-0.5">
                        <div className="h-1 w-12 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round(sessionQuality(s, ec.dailyPlan) * 100)}%`, background: getQualityColor(s.debrief?.clarity, SUBJECT_COLORS[s.subject] || 'var(--text-muted)'), opacity: 0.8 }}/>
                        </div>
                      </div>
                    </span>
                    <button
                      onClick={() => {
                        const snapshot = { ...s };
                        deleteSession(s.id);
                        toast('Session deleted', {
                          action: {
                            label: 'Undo',
                            onClick: () => addSession(snapshot),
                          },
                          duration: 5000,
                        });
                      }}
                      className="p-1 rounded transition-colors hover:bg-red-500/10"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 flex justify-between items-center font-bold"
            style={{ borderTop: '1px solid var(--border-light)' }}>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Today</span>
            <span className="font-mono" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{totalMins}m</span>
          </div>
        </div>

        {/* Week overview */}
        <div className="rounded-[14px] p-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text)' }}>This Week</h3>
          <div className="flex justify-between items-end gap-1 h-36">
            {heatmapData.map((d, i) => {
              const targetMins = settings.dailyTargetHours * 60;
              const heightPct = Math.min(100, (d.mins / targetMins) * 100);
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)', minWidth: 0 }}>
                    {d.mins > 0 ? `${Math.round(d.mins / 60 * 10) / 10}h` : ''}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{
                        height: `${heightPct}%`,
                        minHeight: d.mins > 0 ? '4px' : '0',
                        background: d.isToday ? 'var(--accent)' : 'var(--border-medium)',
                        opacity: d.isToday ? 1 : 0.6,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: d.isToday ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>

    <AnimatePresence>
      {showDebrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md rounded-[20px] shadow-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
            
            <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-sidebar)' }}>
              <div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Session Debrief</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>How did your session go?</p>
              </div>
              <button onClick={() => submitDebrief(true)} className="p-2 rounded-lg opacity-50 hover:opacity-100 transition-all">
                <X size={16} style={{ color: 'var(--text)' }} />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>How did it feel?</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Clicked', 'Okay', 'Confused', 'Struggling'].map(opt => (
                    <button key={opt}
                      onClick={() => setDebriefAnswers(prev => ({ ...prev, clarity: opt.toLowerCase() }))}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: debriefAnswers.clarity === opt.toLowerCase() ? 'var(--accent)' : 'var(--bg-sidebar)',
                        color: debriefAnswers.clarity === opt.toLowerCase() ? 'var(--bg-card)' : 'var(--text-muted)',
                        border: debriefAnswers.clarity === opt.toLowerCase() ? '1px solid var(--accent)' : '1px solid var(--border-medium)'
                      }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Did you solve problems?</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Many', 'A Few', 'Just Read'].map(opt => {
                    const val = opt.toLowerCase() === 'just read' ? 'none' : opt.toLowerCase();
                    return (
                      <button key={opt}
                        onClick={() => setDebriefAnswers(prev => ({ ...prev, practice: val }))}
                        className="py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: debriefAnswers.practice === val ? 'var(--accent)' : 'var(--bg-sidebar)',
                          color: debriefAnswers.practice === val ? 'var(--bg-card)' : 'var(--text-muted)',
                          border: debriefAnswers.practice === val ? '1px solid var(--accent)' : '1px solid var(--border-medium)'
                        }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Energy level?</p>
                <div className="grid grid-cols-3 gap-2">
                  {['High', 'Normal', 'Tired'].map(opt => (
                    <button key={opt}
                      onClick={() => setDebriefAnswers(prev => ({ ...prev, energy: opt.toLowerCase() }))}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: debriefAnswers.energy === opt.toLowerCase() ? 'var(--accent)' : 'var(--bg-sidebar)',
                        color: debriefAnswers.energy === opt.toLowerCase() ? 'var(--bg-card)' : 'var(--text-muted)',
                        border: debriefAnswers.energy === opt.toLowerCase() ? '1px solid var(--accent)' : '1px solid var(--border-medium)'
                      }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold mb-3 flex justify-between items-center" style={{ color: 'var(--text)' }}>
                  Confidence <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{debriefAnswers.confidence > 0 ? `${debriefAnswers.confidence}/5` : ''}</span>
                </p>
                <div className="flex gap-2 justify-between">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => setDebriefAnswers(prev => ({...prev, confidence: star}))}
                      className="p-2 transition-all hover:scale-110" style={{ color: debriefAnswers.confidence >= star ? '#f59e0b' : 'var(--border-medium)' }}>
                      <Star size={24} fill={debriefAnswers.confidence >= star ? '#f59e0b' : 'transparent'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => submitDebrief(true)} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)' }}>
                  Skip
                </button>
                <button onClick={() => submitDebrief(false)}
                  disabled={!debriefAnswers.clarity || !debriefAnswers.practice || !debriefAnswers.energy || !debriefAnswers.confidence}
                  className="flex-[2] py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}>
                  Save Debrief
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
