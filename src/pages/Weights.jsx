import { useState, useMemo, useEffect } from 'react';
import { exams } from '../data/exams';
import { useEngineContext, resolveChapters } from '../hooks/useEngineContext';
import { useAppStore } from '../store/useAppStore';
import { useDebounce } from '../hooks/useDebounce';
import { getRetention } from '../engines/decayEngine';
import { ChevronDown, ChevronUp, Pencil, Check, X, StickyNote, HelpCircle } from 'lucide-react';
import { GLOBAL_SHORTCUTS } from '../config/shortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { AnimatePresence, motion } from 'motion/react';

const SUBJECTS = ['Math', 'Physics', 'Chemistry'];
const FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 't1',         label: 'T1 Only' },
  { id: 't2',         label: 'T2 Only' },
  { id: 't3',         label: 'T3 Only' },
  { id: 'high_value', label: 'High Value (T1 undone)' },
  { id: 'needs_work', label: 'Needs Work (fading)' },
  { id: 'not_started',label: 'Not Started' },
  { id: 'done',       label: 'Completed' },
];
const SORTS = [
  { id: 'weight', label: 'Weight %' },
  { id: 'tier',   label: 'Tier' },
  { id: 'name',   label: 'Name' },
  { id: 'bkt',    label: 'Retention' },
];

export default function Weights() {
  const { chapters, subjectBKT } = useEngineContext();
  const { updateChapterOverride, clearChapterOverride, settings } = useAppStore();
  const overrides = settings.chapterOverrides ?? {};
  const resolvedDefs = resolveChapters(overrides);

  const [selectedExam, setSelectedExam] = useState(exams[0].id);
  const [selectedSubject, setSelectedSubject] = useState('Math');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('weight');
  const [expandedTip, setExpandedTip] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts('GLOBAL', {
    'Show this help': () => setShowShortcuts(s => !s),
  });
  
  const debouncedEditNote = useDebounce(editNote, 300);
  const debouncedEditWeight = useDebounce(editWeight, 300);

  const examData = exams.find(e => e.id === selectedExam);

  const tableData = useMemo(() => {
    let data = resolvedDefs.filter(c => c.subject === selectedSubject && c.exams?.includes(selectedExam));

    // Filter
    if (activeFilter === 't1') data = data.filter(c => c.tier === 'T1');
    else if (activeFilter === 't2') data = data.filter(c => c.tier === 'T2');
    else if (activeFilter === 't3') data = data.filter(c => c.tier === 'T3');
    else if (activeFilter === 'high_value') data = data.filter(c => c.tier === 'T1' && !chapters[c.id]?.done);
    else if (activeFilter === 'needs_work') data = data.filter(c => {
      if (!chapters[c.id]?.done) return false;
      const ret = getRetention(chapters[c.id], c.subject) ?? 0;
      return ret < 0.65;
    });
    else if (activeFilter === 'not_started') data = data.filter(c => !chapters[c.id]?.done);
    else if (activeFilter === 'done') data = data.filter(c => chapters[c.id]?.done);

    // Sort
    if (activeSort === 'weight') data = [...data].sort((a,b) => (b.jeeWeight||0)-(a.jeeWeight||0));
    else if (activeSort === 'tier') data = [...data].sort((a,b) => { const t={'T1':3,'T2':2,'T3':1}; return (t[b.tier]||0)-(t[a.tier]||0); });
    else if (activeSort === 'name') data = [...data].sort((a,b) => a.name.localeCompare(b.name));
    else if (activeSort === 'bkt') data = [...data].sort((a,b) => {
      const bktA = chapters[a.id]?.done ? getRetention(chapters[a.id], a.subject) : -1;
      const bktB = chapters[b.id]?.done ? getRetention(chapters[b.id], b.subject) : -1;
      return bktA - bktB; // Ascending: lowest BKT first (needs review the most)
    });

    return data;
  }, [selectedSubject, activeFilter, activeSort, resolvedDefs, chapters, subjectBKT]);

  const tierSummary = useMemo(() => {
    const s={T1:0,T2:0,T3:0}; tableData.forEach(c=>{ if(s[c.tier]!==undefined)s[c.tier]++; }); return s;
  }, [tableData]);

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditNote(overrides[c.id]?.personalNote ?? '');
    setEditWeight(overrides[c.id]?.customWeight ?? c.jeeWeight ?? '');
  };

  // Auto-save on debounce
  useEffect(() => {
    if (!editingId) return;
    const c = resolvedDefs.find(ch => ch.id === editingId);
    if (!c) return;

    const w = parseFloat(debouncedEditWeight);
    const text = debouncedEditNote.trim();
    
    // Only update if changed
    const currentW = overrides[c.id]?.customWeight;
    const currentN = overrides[c.id]?.personalNote;

    if (!isNaN(w) && w !== c.jeeWeight && w !== currentW) {
      updateChapterOverride(c.id, { customWeight: w });
    } else if (isNaN(w) || w === c.jeeWeight) {
      if (currentW !== undefined) updateChapterOverride(c.id, { customWeight: null });
    }

    if (text && text !== currentN) {
      updateChapterOverride(c.id, { personalNote: text });
    } else if (!text && currentN !== undefined) {
      updateChapterOverride(c.id, { personalNote: null });
    }

  }, [debouncedEditWeight, debouncedEditNote, editingId, resolvedDefs, overrides, updateChapterOverride]);

  const closeEdit = () => setEditingId(null);
  const clearEdit = (id) => { clearChapterOverride(id); setEditingId(null); };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color:'var(--text)' }}>Chapter Weights</h1>
          <p className="text-sm" style={{ color:'var(--text-secondary)' }}>Prioritize study based on exam data. Override weights to personalise.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
            <HelpCircle size={16} />
          </button>
          <div className="flex gap-1.5 bg-[var(--bg-sidebar)] p-1 rounded-lg border border-[var(--border-light)]">
            {exams.map(e => (
              <button key={e.id} onClick={() => setSelectedExam(e.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${selectedExam===e.id ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                {e.name}
              </button>
            ))}
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-52 shrink-0 space-y-4">
          {/* Subject selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:'var(--text-muted)' }}>Subject</p>
            <div className="flex flex-col gap-1.5">
              {SUBJECTS.map(s => (
                <button key={s} onClick={() => setSelectedSubject(s)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${selectedSubject===s ? 'bg-[var(--accent-tint)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--border-medium)]'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:'var(--text-muted)' }}>Filter</p>
            <div className="flex flex-col gap-1">
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setActiveFilter(f.id)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter===f.id ? 'bg-[var(--accent-tint)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar)]'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:'var(--text-muted)' }}>Sort by</p>
            <div className="flex flex-col gap-1">
              {SORTS.map(s => (
                <button key={s.id} onClick={() => setActiveSort(s.id)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeSort===s.id ? 'bg-[var(--accent-tint)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar)]'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tier summary */}
          <div className="bg-[var(--bg-sidebar)] rounded-xl p-3 border border-[var(--border-light)]">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:'var(--text-muted)' }}>Summary</p>
            {[['T1','bg-red-500'],['T2','bg-amber-500'],['T3','bg-green-500']].map(([t,c])=>(
              <div key={t} className="flex justify-between items-center text-xs mb-1.5">
                <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${c}`}/>{t}</span>
                <span className="font-mono font-bold" style={{ color:'var(--text)' }}>{tierSummary[t]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-sidebar)] border-b border-[var(--border-light)] text-xs" style={{ color:'var(--text-secondary)' }}>
                  <th className="px-4 py-3 font-semibold">Chapter</th>
                  <th className="px-4 py-3 font-semibold w-20 text-center">Weight</th>
                  <th className="px-4 py-3 font-semibold w-28">Tier</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Study Tip / Note</th>
                  <th className="px-4 py-3 font-semibold w-12 text-center">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {tableData.map(chapter => {
                  const ov = overrides[chapter.id];
                  const isEditing = editingId === chapter.id;
                  return (
                    <tr key={chapter.id} className="hover:bg-[var(--bg-sidebar)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{chapter.name}</div>
                        {ov?.personalNote && !isEditing && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color:'var(--accent)' }}>
                            <StickyNote size={10}/> {ov.personalNote}
                          </div>
                        )}
                        {chapters[chapter.id]?.done && (
                          <span className="text-[10px] text-green-600 font-medium">✓ done</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input type="number" step="0.1" value={editWeight} onChange={e=>setEditWeight(e.target.value)}
                            className="w-14 text-center text-xs rounded px-1 py-0.5 font-mono"
                            style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text)' }}/>
                        ) : (
                          <span className="font-mono font-bold text-sm" style={{ color: ov?.customWeight ? 'rgb(59,130,246)' : 'var(--accent)' }}>
                            {chapter.jeeWeight || 0}%
                            {ov?.customWeight && <span className="text-[9px] ml-0.5 opacity-60">★</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${chapter.tier==='T1'?'bg-red-500/10 text-red-600 border-red-500/20':chapter.tier==='T2'?'bg-amber-500/10 text-amber-600 border-amber-500/20':'bg-green-500/10 text-green-600 border-green-500/20'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${chapter.tier==='T1'?'bg-red-500':chapter.tier==='T2'?'bg-amber-500':'bg-green-500'}`}/>
                          Tier {chapter.tier.replace('T','')}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ maxWidth:'280px' }}>
                        {isEditing ? (
                          <input value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="Personal note..."
                            className="w-full text-xs rounded px-2 py-1"
                            style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text)' }}/>
                        ) : (
                          <button onClick={() => setExpandedTip(expandedTip===chapter.id?null:chapter.id)} className="text-left w-full group">
                            <p className={`text-xs transition-all ${expandedTip===chapter.id?'':'line-clamp-2'}`} style={{ color:'var(--text-secondary)' }}>{chapter.tip}</p>
                            <span className="text-[10px] font-semibold mt-0.5 inline-flex items-center gap-0.5" style={{ color:'var(--accent)' }}>
                              {expandedTip===chapter.id?<><ChevronUp size={10}/>Collapse</>:<><ChevronDown size={10}/>Show tip</>}
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={closeEdit} className="p-1 rounded" style={{ color:'var(--accent)' }}><Check size={13}/></button>
                            {ov && <button onClick={() => clearEdit(chapter.id)} className="p-1 rounded text-red-500"><X size={11}/></button>}
                          </div>
                        ) : (
                          <button onClick={() => startEdit(chapter)} className="p-1.5 rounded hover:bg-[var(--bg-sidebar)]" style={{ color:'var(--text-muted)' }}>
                            <Pencil size={12}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
