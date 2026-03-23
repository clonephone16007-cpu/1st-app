import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { srsEngine } from '../engines/srsEngine';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Plus, Trash2, ArrowLeft, CheckCircle2, Pencil, Check, X, BookOpen, HelpCircle } from 'lucide-react';
import { FLASHCARD_SHORTCUTS } from '../config/shortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from 'sonner';
import { allFormulaCards } from '../data/formulaCards/index';

const SUBJECTS = ['Math', 'Physics', 'Chemistry', 'General'];
const SUBJECT_COLORS = { Math:'#D4870A', Physics:'#2471A3', Chemistry:'#7D3C98', General:'var(--accent)' };
const RATE_BUTTONS = [
  { rating:1, label:'Again', color:'#EF4444', bg:'rgba(239,68,68,0.09)', border:'rgba(239,68,68,0.25)', info:'<1m', key:'1' },
  { rating:2, label:'Hard',  color:'#F59E0B', bg:'rgba(245,158,11,0.09)', border:'rgba(245,158,11,0.25)', info:'1d',  key:'2' },
  { rating:3, label:'Good',  color:'#22C55E', bg:'rgba(34,197,94,0.09)',  border:'rgba(34,197,94,0.25)',  info:'3d',  key:'3' },
  { rating:4, label:'Easy',  color:'#3B82F6', bg:'rgba(59,130,246,0.09)', border:'rgba(59,130,246,0.25)', info:'7d',  key:'4' },
];
const INPUT_STYLE = { background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text)', borderRadius:'10px', fontSize:'14px', width:'100%', padding:'8px 12px' };

// Simple inline LaTeX renderer for flashcard display
function CardText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith('$$') && p.endsWith('$$')) {
          const math = p.slice(2, -2);
          return <span key={i} className="block text-center my-2" dangerouslySetInnerHTML={{ __html: window.katex ? window.katex.renderToString(math, { displayMode:true, throwOnError:false }) : `$$${math}$$` }}/>;
        }
        if (p.startsWith('$') && p.endsWith('$')) {
          const math = p.slice(1, -1);
          return <span key={i} dangerouslySetInnerHTML={{ __html: window.katex ? window.katex.renderToString(math, { displayMode:false, throwOnError:false }) : `$${math}$` }}/>;
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

export default function Flashcards() {
  const { flashcards, addFlashcard, updateFlashcard, deleteFlashcard, formulaProgress, updateFormulaProgress } = useAppStore();
  const [view, setView] = useState('hub'); // hub | review | formula
  const [tab, setTab] = useState('My Cards'); // My Cards | Formula Library
  const [subject, setSubject] = useState('Math');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [activeTab, setActiveTab] = useState('Math');
  const [formulaSubject, setFormulaSubject] = useState('Math');
  const [sessionCards, setSessionCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed:0, correct:0, again:0, newCards:0, maturedCards:0, totalEase:0 });
  const [editingCard, setEditingCard] = useState(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [isFormula, setIsFormula] = useState(false); // reviewing formula cards
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts('FLASHCARDS', {
    'Flip card': () => { if (view === 'review') setFlipped(f => !f); },
  });

  useKeyboardShortcuts('GLOBAL', {
    'Show this help': () => setShowShortcuts(s => !s),
  });

  const dueCards = useMemo(() => srsEngine.getDueCards(flashcards), [flashcards]);
  const newCardsCount = flashcards.filter(c => !c.reps || c.reps===0).length;
  const learnedCardsCount = flashcards.filter(c => c.reps>0 && c.interval<21).length;
  const matureCardsCount = flashcards.filter(c => c.interval>=21).length;

  const filteredUserCards = useMemo(() => flashcards.filter(c => c.subject===activeTab), [flashcards, activeTab]);
  const filteredFormulaCards = useMemo(() => allFormulaCards.map(c => ({
    ...c,
    ...(formulaProgress[c.id] || { reps:0, interval:0, ease:2.5, dueDate:new Date().toISOString() })
  })).filter(c => c.subject===formulaSubject), [formulaSubject, formulaProgress]);

  const dueFormulaCards = useMemo(() => srsEngine.getDueCards(filteredFormulaCards), [filteredFormulaCards]);

  const handleAddCard = (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    addFlashcard({ id:`card_${Date.now()}`, subject, front:question.trim(), back:answer.trim(), createdAt:Date.now(), reps:0, interval:0, ease:2.5, dueDate:new Date().toISOString() });
    setQuestion(''); setAnswer('');
    toast.success('Flashcard added');
  };

  const startSession = (cards, formula=false) => {
    const shuffled = [...cards].sort(() => Math.random()-0.5);
    setSessionCards(shuffled); setCurrentIndex(0); setFlipped(false);
    setSessionStats({ reviewed:0, correct:0, again:0, newCards:0, maturedCards:0, totalEase:0 });
    setIsFormula(formula); setView('review');
  };

  const handleRate = (rating) => {
    const card = sessionCards[currentIndex];
    if (!isFormula) {
      const updated = srsEngine.rateCard(card, rating);
      updateFlashcard(card.id, updated);
      setSessionStats(prev => ({
        ...prev, reviewed: prev.reviewed+1, correct: prev.correct+(rating>=3?1:0),
        again: prev.again+(rating===1?1:0), newCards: prev.newCards+(card.reps===0?1:0),
        maturedCards: prev.maturedCards+(updated.interval>=21?1:0),
      }));
    } else {
      const updated = srsEngine.rateCard(card, rating);
      updateFormulaProgress(card.id, updated);
      setSessionStats(prev => ({
        ...prev, reviewed: prev.reviewed+1, correct: prev.correct+(rating>=3?1:0),
        again: prev.again+(rating===1?1:0), newCards: prev.newCards+(card.reps===0?1:0),
        maturedCards: prev.maturedCards+(updated.interval>=21?1:0),
      }));
    }
    if (currentIndex < sessionCards.length-1) { setCurrentIndex(i=>i+1); setFlipped(false); }
    else setView('done');
  };

  const startEditCard = (card) => { setEditingCard(card.id); setEditFront(card.front); setEditBack(card.back); };
  const saveEditCard = (id) => {
    updateFlashcard(id, { front:editFront.trim(), back:editBack.trim() });
    setEditingCard(null); toast.success('Card updated');
  };

  const handleDeleteCard = (id) => {
    const card = flashcards.find(c=>c.id===id);
    deleteFlashcard(id);
    toast('Card deleted', { action:{ label:'Undo', onClick:()=>addFlashcard(card) } });
  };

  useEffect(() => {
    const handler = (e) => {
      if (view!=='review') return;
      if (e.key===' ') { e.preventDefault(); setFlipped(f=>!f); }
      if (flipped && ['1','2','3','4'].includes(e.key)) handleRate(parseInt(e.key));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, flipped, currentIndex]);

  if (view==='review') {
    const card = sessionCards[currentIndex];
    const progress = (currentIndex)/(sessionCards.length||1);
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('hub')} className="flex items-center gap-2 text-sm" style={{ color:'var(--text-muted)' }}><ArrowLeft size={16}/>Exit</button>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowShortcuts(s => !s)} className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
              <HelpCircle size={14} />
            </button>
            <span className="text-sm font-mono" style={{ color:'var(--text-muted)' }}>{currentIndex+1}/{sessionCards.length}</span>
          </div>
        </div>
        
        {/* Shortcuts popover (Review Mode) */}
        <AnimatePresence>
          {showShortcuts && (
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
              className="rounded-xl p-4 z-50 relative" style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', boxShadow:'var(--shadow-md)' }}>
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Flashcards Shortcuts</p>
                <button onClick={() => setShowShortcuts(false)}><X size={14} style={{ color:'var(--text-muted)' }}/></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FLASHCARD_SHORTCUTS.map(s => (
                  <div key={s.key} className="flex items-center gap-2 text-[11px]">
                    <kbd className="px-1.5 py-0.5 rounded font-mono text-[9px]" style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)' }}>{s.key}</kbd>
                    <span style={{ color:'var(--text-muted)' }}>{s.action}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background:'var(--border-light)' }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width:`${progress*100}%`, background:'var(--accent)' }}/>
        </div>
        <div onClick={() => setFlipped(f=>!f)} className="flashcard-flip cursor-pointer min-h-[260px] rounded-[18px]"
          style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', boxShadow:'var(--shadow-md)' }}>
          <div className={`flashcard-flip-inner min-h-[260px] rounded-[18px] ${flipped ? 'flipped' : ''}`}>
            <div className="flashcard-flip-front text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color:'var(--text-muted)' }}>{card?.subject} · {card?.category || 'Question'}</p>
                <p className="text-xl font-medium leading-relaxed" style={{ color:'var(--text)' }}><CardText text={card?.front}/></p>
                <p className="text-xs mt-6" style={{ color:'var(--text-muted)' }}>Tap or press Space to flip</p>
              </div>
            </div>
            <div className="flashcard-flip-back text-center rounded-[18px]" style={{ background:'var(--bg-card)' }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-4 text-green-500">Answer</p>
                <p className="text-lg leading-relaxed" style={{ color:'var(--text)' }}><CardText text={card?.back}/></p>
              </div>
            </div>
          </div>
        </div>
        {flipped && (
          <div className="grid grid-cols-4 gap-2">
            {RATE_BUTTONS.map(btn => (
              <button key={btn.rating} onClick={() => handleRate(btn.rating)}
                className="py-3 rounded-[12px] text-sm font-semibold flex flex-col items-center gap-0.5 transition-all hover:-translate-y-0.5"
                style={{ background:btn.bg, border:`1px solid ${btn.border}`, color:btn.color }}>
                {btn.label}<span className="text-[10px] opacity-60">{btn.info} · {btn.key}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view==='done') {
    const acc = sessionStats.reviewed > 0 ? Math.round(sessionStats.correct/sessionStats.reviewed*100) : 0;
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-16">
        <CheckCircle2 size={48} className="mx-auto text-green-500"/>
        <h2 className="text-2xl font-bold" style={{ color:'var(--text)' }}>Session Complete</h2>
        <div className="grid grid-cols-3 gap-3">
          {[['Reviewed',sessionStats.reviewed],['Accuracy',`${acc}%`],['Again',sessionStats.again]].map(([l,v])=>(
            <div key={l} className="rounded-xl p-3" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)' }}>
              <div className="text-xl font-bold font-mono" style={{ color:'var(--accent)' }}>{v}</div>
              <div className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{l}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setView('hub')} className="px-6 py-2.5 rounded-xl font-semibold" style={{ background:'var(--accent)', color:'var(--bg-card)' }}>Back to Hub</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
            <HelpCircle size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color:'var(--text)' }}>Flashcards</h1>
            <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>FSRS v4.5 spaced repetition · Formula Library</p>
          </div>
        </div>
        <div className="flex gap-1.5 bg-[var(--bg-sidebar)] p-1 rounded-lg border border-[var(--border-light)]">
          {['My Cards','Formula Library'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab===t?'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm':'text-[var(--text-muted)]'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab==='My Cards' ? (
        <>
          {/* Stats + start session */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Due',dueCards.length,'var(--accent)'],['New',newCardsCount,'#3b82f6'],['Learning',learnedCardsCount,'#f59e0b'],['Mature',matureCardsCount,'#22c55e']].map(([l,v,c])=>(
              <div key={l} className="p-3 rounded-[12px] text-center" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)' }}>
                <div className="text-2xl font-bold font-mono" style={{ color:c }}>{v}</div>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => dueCards.length>0 ? startSession(dueCards) : toast.info('No cards due')}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: dueCards.length>0?'var(--accent)':'var(--bg-sidebar)', color: dueCards.length>0?'var(--bg-card)':'var(--text-muted)', border:'1px solid var(--border-light)' }}>
              {dueCards.length>0 ? `Review ${dueCards.length} Due Cards` : 'No Cards Due'}
            </button>
            <button onClick={() => startSession(flashcards)}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5"
              style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-light)', color:'var(--text-secondary)' }}>
              All Cards
            </button>
          </div>

          {/* Add card form */}
          <div className="rounded-[14px] p-5" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', boxShadow:'var(--shadow-sm)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--text-muted)' }}>Add New Card</p>
            <form onSubmit={handleAddCard} className="space-y-3">
              <select value={subject} onChange={e=>setSubject(e.target.value)} style={INPUT_STYLE}>
                {SUBJECTS.map(s=><option key={s}>{s}</option>)}
              </select>
              <textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Front — question or term ($LaTeX$ supported)" rows={2}
                className="resize-none focus:outline-none" style={INPUT_STYLE}/>
              <textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Back — answer or definition ($$block LaTeX$$ supported)" rows={2}
                className="resize-none focus:outline-none" style={INPUT_STYLE}/>
              <button type="submit" className="w-full py-2 rounded-xl font-semibold text-sm" style={{ background:'var(--accent)', color:'var(--bg-card)' }}>
                <Plus size={14} className="inline mr-1.5"/>Add Card
              </button>
            </form>
          </div>

          {/* Card library */}
          <div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {SUBJECTS.map(s => (
                <button key={s} onClick={() => setActiveTab(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${activeTab===s?'text-[var(--bg-card)]':'text-[var(--text-muted)] bg-[var(--bg-sidebar)]'}`}
                  style={{ background: activeTab===s ? SUBJECT_COLORS[s] : undefined }}>
                  {s} ({flashcards.filter(c=>c.subject===s).length})
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredUserCards.length===0 ? (
                <div className="py-12 text-center rounded-xl" style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                  <Brain size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No {activeTab} cards yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Create your first card above to begin spaced repetition</p>
                </div>
              ) : filteredUserCards.map(card => (
                <div key={card.id} className="rounded-[12px] p-3" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)' }}>
                  {editingCard===card.id ? (
                    <div className="space-y-2">
                      <textarea value={editFront} onChange={e=>setEditFront(e.target.value)} rows={2} className="resize-none focus:outline-none text-sm" style={INPUT_STYLE}/>
                      <textarea value={editBack} onChange={e=>setEditBack(e.target.value)} rows={2} className="resize-none focus:outline-none text-sm" style={INPUT_STYLE}/>
                      <div className="flex gap-2">
                        <button onClick={() => saveEditCard(card.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold" style={{ background:'var(--accent)', color:'var(--bg-card)' }}><Check size={11}/>Save</button>
                        <button onClick={() => setEditingCard(null)} className="px-3 py-1 rounded-lg text-xs" style={{ color:'var(--text-muted)' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color:'var(--text)' }}><CardText text={card.front}/></p>
                        <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}><CardText text={card.back}/></p>
                        <div className="flex gap-2 mt-1 text-[10px] font-mono" style={{ color:'var(--text-muted)' }}>
                          <span>R:{card.reps||0}</span><span>I:{card.interval||0}d</span>
                          {card.dueDate && <span style={{ color: new Date(card.dueDate)<=new Date()?'#ef4444':'inherit' }}>Due:{new Date(card.dueDate).toLocaleDateString('en-IN')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEditCard(card)} className="p-1.5 rounded-lg" style={{ color:'var(--text-muted)' }}><Pencil size={12}/></button>
                        <button onClick={() => handleDeleteCard(card.id)} className="p-1.5 rounded-lg" style={{ color:'var(--text-muted)' }}><Trash2 size={12}/></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Formula Library tab */
        <div className="space-y-4">
          <div className="rounded-[14px] p-4" style={{ background:'var(--accent-tint)', border:'1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={14} style={{ color:'var(--accent)' }}/>
              <span className="text-sm font-semibold" style={{ color:'var(--accent)' }}>Formula Library</span>
            </div>
            <p className="text-xs" style={{ color:'var(--text-secondary)' }}>
              Read-only cards from <code className="font-mono text-[11px]">src/data/formulaCards/</code>. Add cards by pasting structured data into those files. LaTeX renders inline.
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {SUBJECTS.filter(s=>s!=='General').map(s => (
              <button key={s} onClick={() => setFormulaSubject(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors`}
                style={{ background: formulaSubject===s ? SUBJECT_COLORS[s] : 'var(--bg-sidebar)', color: formulaSubject===s ? 'white' : 'var(--text-muted)', border:'1px solid var(--border-light)' }}>
                {s} ({allFormulaCards.filter(c=>c.subject===s).length})
              </button>
            ))}
            {filteredFormulaCards.length > 0 && (
              <div className="ml-auto flex gap-2">
                <button onClick={() => startSession(dueFormulaCards, true)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 ${dueFormulaCards.length > 0 ? 'bg-[var(--accent)] text-[var(--bg-card)]' : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)]'}`}>
                  Review {dueFormulaCards.length} Due
                </button>
                <button onClick={() => startSession(filteredFormulaCards, true)}
                   className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 bg-[var(--bg-sidebar)] text-[var(--text-secondary)] border border-[var(--border-light)]">
                  All {filteredFormulaCards.length}
                </button>
              </div>
            )}
          </div>
          {filteredFormulaCards.length===0 ? (
            <div className="text-center py-16 space-y-2">
              <BookOpen size={36} className="mx-auto opacity-20"/>
              <p className="text-sm" style={{ color:'var(--text-muted)' }}>No {formulaSubject} formula cards yet.</p>
              <p className="text-xs" style={{ color:'var(--text-muted)' }}>Paste AI-generated cards into <code className="font-mono">src/data/formulaCards/{formulaSubject.toLowerCase()}.js</code></p>
            </div>
          ) : filteredFormulaCards.map(card => (
            <div key={card.id} className="rounded-[12px] p-3" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)' }}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold mb-1" style={{ color:'var(--text-muted)' }}>{card.category}</p>
                  <p className="text-sm font-medium" style={{ color:'var(--text)' }}><CardText text={card.front}/></p>
                  <p className="text-sm mt-2 p-2 rounded-lg" style={{ color:'var(--text-secondary)', background:'var(--bg-sidebar)' }}><CardText text={card.back}/></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
