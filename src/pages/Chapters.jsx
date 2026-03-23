import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useLocation } from 'react-router-dom';
import { chapters as chapterDefs } from '../data/chapters';
import { getRetention, getStatus, getNextReviewDate } from '../engines/decayEngine';
import { PREREQUISITES } from '../engines/schedulerEngine';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Search, Star, Edit3, ChevronDown, ChevronUp, Zap, RefreshCw, X, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { CHAPTERS_SHORTCUTS } from '../config/shortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from 'sonner';
import { useAI } from '../hooks/useAI';
import { useEngineContext, resolveChapters } from '../hooks/useEngineContext';
import MarkdownRenderer from '../components/MarkdownRenderer';

const SUBJECT_COLORS = { Math: '#D4870A', Physics: '#2471A3', Chemistry: '#7D3C98' };
const TIER_STYLES = {
  T1: { bg: 'rgba(239,68,68,0.09)', color: 'rgb(220,38,38)' },
  T2: { bg: 'rgba(245,158,11,0.09)', color: 'rgb(180,115,0)' },
  T3: { bg: 'rgba(107,114,128,0.09)', color: 'rgb(107,114,128)' },
};

function confettiBurst() {
  const colors = ['#D4870A','#2471A3','#7D3C98','#1E8449','#C0392B'];
  if (!document.getElementById('confetti-style')) {
    const s = document.createElement('style');
    s.id = 'confetti-style';
    s.textContent = '@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}';
    document.head.appendChild(s);
  }
  Array.from({ length: 28 }).forEach((_, i) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:-10px;left:${Math.random()*100}vw;width:7px;height:7px;background:${colors[i%colors.length]};border-radius:2px;z-index:9999;pointer-events:none;animation:confettiFall ${1.5+Math.random()}s ease-out forwards;transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  });
}

function SubjectHeatmap({ sessions }) {
  const days = 40;
  const cells = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      const key = (s.date || '').slice(0, 10);
      map[key] = (map[key] || 0) + (s.mins || 0);
    });
    const now = new Date();
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (days - 1 - i));
      const dayStr = d.toISOString().split('T')[0];
      const mins = map[dayStr] || 0;
      const opacity = mins === 0 ? 0.07 : Math.min(1, 0.2 + mins / 120);
      const label = `${d.toLocaleDateString('en-IN',{month:'short',day:'numeric'})}: ${Math.round(mins/60*10)/10}h`;
      return { opacity, label };
    });
  }, [sessions.length]);

  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color:'var(--text-muted)' }}>
        Overall Activity — Last 40 Days
      </p>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
        {cells.map((cell, i) => (
          <div key={i} className="aspect-square rounded-[2px]"
            style={{ background: 'var(--accent)', opacity: cell.opacity }}
            title={cell.label}/>
        ))}
      </div>
    </div>
  );
}

export default function Chapters() {
  const { chapters, updateChapter, addFlashcard, logEvent, flashcards, sessions, settings } = useAppStore();
  const ec = useEngineContext();
  const { aiContext } = ec;
  const { hasAI, explainChapter, loading: aiLoading } = useAI();
  const [chapterAI, setChapterAI] = useState({});
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts('CHAPTERS', {
    'Focus search box': () => document.getElementById('chapter-search')?.focus(),
  });

  useKeyboardShortcuts('GLOBAL', {
    'Show this help': () => setShowShortcuts(s => !s),
  });
  
  const subjectsList = ['Math', 'Physics', 'Chemistry'];
  const [expandedSubjects, setExpandedSubjects] = useState(subjectsList);

  useEffect(() => {
    if (location.state?.filter) setActiveFilter(location.state.filter);
    if (location.state?.search) setSearchTerm(location.state.search);
    if (location.state?.subject) setExpandedSubjects([location.state.subject]);
  }, [location.state]);

  const [expandedTip, setExpandedTip] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [creatingFlashcardFor, setCreatingFlashcardFor] = useState(null);
  const [flashcardFront, setFlashcardFront] = useState('');
  const [flashcardBack, setFlashcardBack] = useState('');

  const filters = ['All', 'Pending', 'Done', 'T1 Critical', 'Fading', 'Needs Revision'];

  const resolvedDefs = useMemo(() => resolveChapters(settings.chapterOverrides || {}), [settings.chapterOverrides]);

  const handleToggleDone = (chapterId, currentDone) => {
    const newDone = !currentDone;
    // If marking undone, also clear needsRevision so it doesn't linger
    updateChapter(chapterId, { done: newDone, doneAt: newDone ? Date.now() : null, needsRevision: false });
    if (newDone) {
      logEvent({ type: 'chapter_done', chapterId, timestamp: Date.now() });
      const def = resolvedDefs.find(c => c.id === chapterId);
      if (def?.tier === 'T1') {
        confettiBurst();
        toast.success('T1 chapter complete! 🎉');
      } else {
        toast.success('Chapter done!');
      }
    } else {
      toast.info('Marked as pending');
    }
  };

  const handleConfidence = (chapterId, conf) => updateChapter(chapterId, { confidence: conf });

  const handleCreateFlashcardClick = (chapter) => {
    setCreatingFlashcardFor(chapter.id);
    setFlashcardFront(`What is ${chapter.name}?`);
    setFlashcardBack(chapter.tip);
  };

  const handleSaveFlashcard = (chapter) => {
    if (!flashcardFront.trim() || !flashcardBack.trim()) { toast.error('Both fields required'); return; }
    if (flashcards.some(fc => fc.front === flashcardFront)) { toast.error('Card already exists'); return; }
    addFlashcard({
      id: `fc_${Date.now()}`, front: flashcardFront, back: flashcardBack,
      deck: chapter.subject, subject: chapter.subject, chapterId: chapter.id, createdAt: Date.now(),
      nextReview: Date.now(), interval: 0, ease: 2.5,
    });
    toast.success('Flashcard created!');
    setCreatingFlashcardFor(null);
  };

  const handleSaveNote = (chapterId) => {
    updateChapter(chapterId, { note: noteText });
    setEditingNote(null);
    toast.success('Note saved');
  };

  const bktMap = useMemo(() => {
    const map = {};
    resolvedDefs.forEach(def => {
      const state = chapters[def.id];
      if (state?.done) map[def.id] = getRetention(state, def.subject);
    });
    return map;
  }, [chapters, resolvedDefs]);

  // Grouped and filtered chapters
  const filteredGroups = useMemo(() => {
    const groups = { Math: [], Physics: [], Chemistry: [] };
    
    resolvedDefs.forEach(c => {
      const state = chapters[c.id] || {};
      const isDone = !!state.done;
      
      if (activeFilter === 'Pending' && isDone) return;
      if (activeFilter === 'Done' && !isDone) return;
      if (activeFilter === 'T1 Critical' && c.tier !== 'T1') return;
      if (activeFilter === 'Needs Revision' && !state.needsRevision) return;
      if (activeFilter === 'Fading') {
        if (!isDone) return;
        const ret = bktMap[c.id] ?? 0;
        if (ret >= 0.65) return; // not fading
      }
      
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (!c.name.toLowerCase().includes(t) && !c.tip.toLowerCase().includes(t)) return;
      }
      
      if (groups[c.subject]) groups[c.subject].push(c);
    });
    
    return groups;
  }, [searchTerm, activeFilter, chapters, bktMap, resolvedDefs]);

  const globalStats = useMemo(() => {
    const total = resolvedDefs.length;
    const doneCount = resolvedDefs.filter(c => chapters[c.id]?.done).length;
    const t1Total = resolvedDefs.filter(c => c.tier === 'T1').length;
    const t1Done = resolvedDefs.filter(c => c.tier === 'T1' && chapters[c.id]?.done).length;
    const progress = total > 0 ? (doneCount / total) * 100 : 0;
    return { total, doneCount, t1Total, t1Done, progress };
  }, [chapters, resolvedDefs]);

  const toggleSubject = (subj) => {
    setExpandedSubjects(prev => prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold font-serif" style={{ color: 'var(--text)' }}>Chapters</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Track your syllabus progress and retention</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
            <HelpCircle size={16} />
          </button>
          <div className="text-right">
             <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
               {globalStats.doneCount} / {globalStats.total} done
             </div>
             <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
               T1 done: {globalStats.t1Done}/{globalStats.t1Total}
             </div>
          </div>
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bg-sidebar)" strokeWidth="3.5"/>
              <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" strokeWidth="3.5"
                strokeDasharray={2*Math.PI*16} strokeDashoffset={2*Math.PI*16 * (1 - globalStats.progress/100)} strokeLinecap="round"
                className="transition-all duration-700"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono" style={{ color: 'var(--text)' }}>
              {Math.round(globalStats.progress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Shortcuts popover */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="rounded-xl p-4 z-50 relative" style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', boxShadow:'var(--shadow-md)' }}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Chapters Shortcuts</p>
              <button onClick={() => setShowShortcuts(false)}><X size={14} style={{ color:'var(--text-muted)' }}/></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CHAPTERS_SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-[11px]">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[9px]" style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)' }}>{s.key}</kbd>
                  <span style={{ color:'var(--text-muted)' }}>{s.action}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SubjectHeatmap sessions={sessions} />

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
              style={{
                background: activeFilter === f ? 'var(--accent)' : 'var(--bg-card)',
                color: activeFilter === f ? 'var(--bg-card)' : 'var(--text-secondary)',
                border: activeFilter === f ? '1px solid var(--accent)' : '1px solid var(--border-medium)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              const fading = resolvedDefs.filter(c => {
                const ch = chapters[c.id] || {};
                if (!ch.done) return false;
                const s = getStatus(getRetention(ch, c.subject));
                return s === 'fading' || s === 'stale';
              });
              if (!fading.length) { toast.info('No fading chapters!'); return; }
              fading.forEach(c => updateChapter(c.id, { doneAt: Date.now() }));
              toast.success(`Refreshed ${fading.length} chapters`);
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 hover:-translate-y-0.5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            Refresh Fading
          </button>
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              id="chapter-search"
              type="text" placeholder="Search chapters…"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Chapter lists by subject */}
      <div className="space-y-6">
        {subjectsList.map(subj => {
          const list = filteredGroups[subj] || [];
          if (list.length === 0) return null; // Hide subject block if completely filtered out
          
          const isExpanded = expandedSubjects.includes(subj);
          const color = SUBJECT_COLORS[subj];
          const totalInSubj = resolvedDefs.filter(c => c.subject === subj).length;
          const doneInSubj = resolvedDefs.filter(c => c.subject === subj && chapters[c.id]?.done).length;
          
          return (
            <div key={subj} className="space-y-3">
              {/* Accordion Header */}
              <button onClick={() => toggleSubject(subj)}
                className="w-full flex items-center justify-between p-4 rounded-[14px] transition-all duration-200"
                style={{ background: 'var(--bg-card)', border: `1px solid ${isExpanded ? color : 'var(--border-light)'}`, borderLeft: `4px solid ${color}`, boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center gap-4">
                  <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{subj}</h2>
                  <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-muted)' }}>
                    {list.length} {list.length === 1 ? 'chapter' : 'chapters'} shown
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                     {doneInSubj}/{totalInSubj} completed
                     <div className="w-16 h-1.5 ml-2 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(totalInSubj > 0 ? doneInSubj/totalInSubj*100 : 0)}%`, background: color }} />
                     </div>
                  </div>
                  {isExpanded ? <ChevronUp size={20} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={20} style={{ color: 'var(--text-muted)' }} />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-1 pb-3 pl-1 md:pl-4">
                      {list.map(chapter => {
                        const state = chapters[chapter.id] || {};
                        const isDone = !!state.done;
                        const needsRevision = !!state.needsRevision;
                        const confidence = state.confidence || 0;
                        const note = state.note || '';

                        let retention = 0, status = 'fresh', reviewDays = 0;
                        let statusColor = 'rgb(34,197,94)';
                        if (isDone) {
                          retention = getRetention(state, chapter.subject);
                          status = getStatus(retention);
                          reviewDays = getNextReviewDate(state, chapter.subject);
                          if (status === 'fading' || status === 'stale') statusColor = status === 'fading' ? 'rgb(220,38,38)' : 'rgb(245,158,11)';
                          else if (status === 'good') statusColor = 'rgb(34,197,94)';
                          else statusColor = 'rgb(59,130,246)';
                        }
                        
                        if (needsRevision) {
                           statusColor = 'rgb(220,38,38)';
                        }

                        const isFading = isDone && (status === 'fading' || status === 'stale' || needsRevision);

                        return (
                          <div key={chapter.id}
                            className="rounded-[14px] transition-all duration-150 relative"
                            style={{
                              background: 'var(--bg-card)',
                              border: `1px solid ${isFading ? (status === 'fading' || needsRevision ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)') : 'var(--border-light)'}`,
                              boxShadow: 'var(--shadow-xs)',
                            }}
                          >
                            <div className="flex items-start gap-3 p-4">
                              {/* Checkbox */}
                              <button
                                onClick={() => handleToggleDone(chapter.id, isDone)}
                                className="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 z-10"
                                style={{
                                  background: isDone ? 'var(--accent)' : 'transparent',
                                  border: `2px solid ${isDone ? 'var(--accent)' : 'var(--border-medium)'}`,
                                }}
                              >
                                {isDone && <Check size={11} strokeWidth={3} style={{ color: 'var(--bg-card)' }} />}
                              </button>

                              <div className="flex-1 min-w-0">
                                {/* Title row */}
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-sm leading-tight"
                                    style={{ color: isDone ? 'var(--text-muted)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
                                    {chapter.name}
                                  </h3>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                                    style={{ background: TIER_STYLES[chapter.tier]?.bg, color: TIER_STYLES[chapter.tier]?.color }}>
                                    {chapter.tier}
                                  </span>
                                  {chapter.exams?.map(exam => (
                                    <span key={exam} className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase"
                                      style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                                      {exam}
                                    </span>
                                  ))}
                                  {needsRevision && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                                      style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(220,38,38)' }}>
                                      NEEDS REVISION
                                    </span>
                                  )}
                                </div>

                                {/* Study tip toggle */}
                                <button
                                  onClick={() => setExpandedTip(expandedTip === chapter.id ? null : chapter.id)}
                                  className="flex items-center gap-1 text-xs transition-colors mb-1"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {expandedTip === chapter.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                  {chapter._overridden && chapter._personalNote ? 'Notes' : 'Tip'}
                                </button>
                                
                                {chapter._overridden && chapter._personalNote && expandedTip !== chapter.id && (
                                   <div className="text-xs truncate italic" style={{ color: 'var(--text-secondary)' }}>
                                      {chapter._personalNote}
                                   </div>
                                )}

                                {expandedTip === chapter.id && (
                                  <div className="overflow-hidden" style={{ animation: 'fadeIn 0.15s ease' }}>
                                    <div className="mt-2 p-3 rounded-lg text-sm space-y-2"
                                      style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                                      <p>{chapter.tip}</p>
                                      {chapter._overridden && chapter._personalNote && (
                                        <div className="pt-2" style={{ borderTop: '1px solid var(--border-medium)' }}>
                                          <p className="font-semibold text-xs mb-1" style={{ color: 'var(--text)' }}>Personal Note:</p>
                                          <p className="italic">{chapter._personalNote}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Done state details */}
                                {isDone && (
                                  <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                                    {/* Confidence & Revision Toggle */}
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex gap-0.5">
                                          {[1,2,3,4,5].map(star => (
                                            <button key={star} onClick={() => handleConfidence(chapter.id, star)}
                                              className="transition-all duration-100 hover:scale-125"
                                              style={{ color: star <= confidence ? 'rgb(251,191,36)' : 'var(--border-medium)' }}>
                                              <Star size={13} fill={star <= confidence ? 'currentColor' : 'none'} />
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <div className="w-[1px] h-3" style={{ background: 'var(--border-medium)' }} />
                                      
                                      <button onClick={() => updateChapter(chapter.id, { needsRevision: !needsRevision })}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold transition-colors z-10"
                                        style={{ background: needsRevision ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)', border: `1px solid ${needsRevision ? 'rgba(239,68,68,0.2)' : 'var(--border-medium)'}`, color: needsRevision ? 'rgb(220,38,38)' : 'var(--text-muted)' }}>
                                        <AlertCircle size={11} /> {needsRevision ? 'Revision Flagged' : 'Flag Revision'}
                                      </button>
                                    </div>

                                    {/* Retention */}
                                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                                      BKT {Math.round(retention * 100)}% P(known) · review in {reviewDays}d
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 ml-auto z-10 relative">
                                        {hasAI && (
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const prereqIds = PREREQUISITES[chapter.id] || [];
                                              const unlockIds = Object.entries(PREREQUISITES).filter(([, deps]) => deps.includes(chapter.id)).map(([id]) => id);
                                              const ctx = {
                                                chapterName: chapter.name,
                                                subject: chapter.subject,
                                                tier: chapter.tier,
                                                jeeWeight: chapter.jeeWeight,
                                                bktRetention: Math.round(retention * 100),
                                                daysToExam: ec.daysToExam,
                                                prerequisiteChapters: prereqIds.map(id => chapterDefs.find(c => c.id === id)?.name).filter(Boolean),
                                                unlocksChapters: unlockIds.map(id => chapterDefs.find(c => c.id === id)?.name).filter(Boolean),
                                              };
                                              const res = await explainChapter(ctx);
                                              if (res) setChapterAI(p => ({ ...p, [chapter.id]: res }));
                                            }}
                                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-all hover:bg-black/5"
                                            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}
                                          >
                                            <Sparkles size={9} /> {aiLoading ? '…' : 'Explain'}
                                          </button>
                                        )}
                                      <button
                                        onClick={() => handleCreateFlashcardClick(chapter)}
                                        className="text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-70"
                                        style={{ color: 'var(--accent)' }}
                                      >
                                        <Zap size={11} /> Auto-card
                                      </button>
                                      <button
                                        onClick={() => { setEditingNote(editingNote === chapter.id ? null : chapter.id); setNoteText(note); }}
                                        className="relative transition-colors hover:opacity-70"
                                        style={{ color: note ? 'var(--accent)' : 'var(--text-muted)' }}
                                        title="Notes"
                                      >
                                        <Edit3 size={14} />
                                        {note && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* AI Explanation Bubble */}
                                {chapterAI[chapter.id] && (
                                  <div className="mt-3 p-3 rounded-lg text-sm mb-1 leading-relaxed relative" style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent)', color: 'var(--text)' }}>
                                    <button onClick={() => setChapterAI(p => { const n = {...p}; delete n[chapter.id]; return n; })} className="absolute top-2 right-2 p-1" style={{ color: 'var(--accent)' }}><X size={12}/></button>
                                    <div className="flex items-center gap-1.5 mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}><Sparkles size={11}/> AI Explanation</div>
                                    <MarkdownRenderer text={chapterAI[chapter.id]} className="text-sm" />
                                  </div>
                                )}

                                {/* Note editor */}
                                {editingNote === chapter.id && (
                                    <div className="overflow-hidden mt-2 relative z-10">
                                      <div className="flex gap-2">
                                        <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                                          placeholder="Quick note…"
                                          className="flex-1 p-2.5 rounded-lg text-sm resize-none focus:outline-none"
                                          style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text)', height: '72px' }}
                                        />
                                        <div className="flex flex-col gap-1">
                                          <button onClick={() => handleSaveNote(chapter.id)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:opacity-90 active:scale-95"
                                            style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}>Save</button>
                                          <button onClick={() => setEditingNote(null)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90 active:scale-95"
                                            style={{ background: 'var(--bg-sidebar)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                {/* Flashcard creator */}
                                {creatingFlashcardFor === chapter.id && (
                                    <div className="overflow-hidden mt-2 relative z-10">
                                      <div className="p-3 rounded-xl space-y-3" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)' }}>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>New Flashcard</span>
                                          <button onClick={() => setCreatingFlashcardFor(null)} style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
                                        </div>
                                        <div>
                                          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Front</label>
                                          <input value={flashcardFront} onChange={e => setFlashcardFront(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text)' }} />
                                        </div>
                                        <div>
                                          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Back</label>
                                          <textarea value={flashcardBack} onChange={e => setFlashcardBack(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
                                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text)', height: '64px' }} />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                          <button onClick={() => setCreatingFlashcardFor(null)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-colors" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                                          <button onClick={() => handleSaveFlashcard(chapter)}
                                            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors hover:opacity-90 active:scale-95"
                                            style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}>Save Card</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {Object.values(filteredGroups).every(g => g.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 rounded-[14px]"
            style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
            <Search size={32} className="mb-3 opacity-30" />
            <p className="font-medium">No chapters match your filter</p>
            <button onClick={() => { setActiveFilter('All'); setSearchTerm(''); }}
              className="text-sm mt-2 underline underline-offset-2" style={{ color: 'var(--accent)' }}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
