import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useEngineContext } from '../hooks/useEngineContext';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Calendar as CalendarIcon, HelpCircle, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PLANNER_SHORTCUTS } from '../config/shortcuts';
import { useAI } from '../hooks/useAI';
import MarkdownRenderer from '../components/MarkdownRenderer';

const SUBJECTS = ['Math', 'Physics', 'Chemistry', 'General'];
const SUBJ_COLORS = { Math:'#D4870A', Physics:'#2471A3', Chemistry:'#7D3C98', General:'var(--accent)' };

export default function Planner() {
  const {
    planner, addPlannerTask, togglePlannerTask, deletePlannerTask,
    sprints, addSprint, addSprintTask, toggleSprintTask, deleteSprint, deleteSprintTask,
    chapters, settings, sessions
  } = useAppStore();
  const ec = useEngineContext();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [taskText, setTaskText] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [subject, setSubject] = useState('Math');
  const [newSprintTask, setNewSprintTask] = useState({});
  const [showSprintInput, setShowSprintInput] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const taskInputRef = useRef(null);
  const { hasAI, narrativePlan, loading: aiLoading } = useAI();
  const [aiPlanText, setAiPlanText] = useState('');

  // autoFocus on mount
  useEffect(() => { setTimeout(() => taskInputRef.current?.focus(), 100); }, []);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') handlePrevDay();
      if (e.key === 'ArrowRight') handleNextDay();
      if (e.key === 't' || e.key === 'T') handleToday();
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); taskInputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentDate]);

  const todayKey = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local timezone
  const dateKey = currentDate.toLocaleDateString('en-CA');
  const isToday = dateKey === todayKey;

  // Carry-forward: uncompleted tasks from previous days (last 7)
  const carriedTasks = useMemo(() => {
    if (!isToday) return [];
    const carried = [];
    for (let d = 1; d <= 7; d++) {
      const pastDate = new Date(); 
      pastDate.setDate(pastDate.getDate() - d);
      const key = pastDate.toLocaleDateString('en-CA');
      (planner[key] || []).forEach(t => {
        if (!t.done) carried.push({ ...t, _carriedFrom: key, _daysAgo: d });
      });
    }
    return carried;
  }, [planner, isToday]);

  const todaysTasks = planner[dateKey] || [];
  const sortedTasks = [...todaysTasks].sort((a, b) => (a.startTime||'').localeCompare(b.startTime||''));

  const handlePrevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d); };
  const handleNextDay = () => { const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d); };
  const handleToday = () => setCurrentDate(new Date());

  const handleAddTask = (e, keepFocus = false) => {
    e?.preventDefault();
    if (!taskText.trim()) return;
    addPlannerTask(dateKey, { id:`task_${Date.now()}`, text:taskText, startTime, endTime, subject, done:false });
    setTaskText('');
    toast.success('Task added');
    if (keepFocus) taskInputRef.current?.focus();
  };

  const handleConfirmSprint = (e) => {
    e?.preventDefault();
    if (!newSprintName.trim()) return;
    addSprint({ id:`sprint_${Date.now()}`, name:newSprintName.trim(), tasks:[], createdAt:Date.now() });
    toast.success('Sprint created');
    setShowSprintInput(false); setNewSprintName('');
  };

  const handleAddSprintTask = (e, sprintId) => {
    e.preventDefault();
    const text = newSprintTask[sprintId];
    if (!text?.trim()) return;
    addSprintTask(sprintId, { id:`stask_${Date.now()}`, text:text.trim(), done:false });
    setNewSprintTask(prev => ({...prev, [sprintId]:''}));
  };

  const handleQuickAdd = (chapter) => { setTaskText(`Study ${chapter.name}`); setSubject(chapter.subject); taskInputRef.current?.focus(); };

  const INPUT_STYLE = { background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text)', borderRadius:'10px', fontSize:'14px' };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--text)' }}>Planner</h1>
          <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>Daily schedule · Sprint boards · KST suggestions</p>
        </div>
        <button onClick={() => setShowShortcuts(s=>!s)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-light)', color:'var(--text-muted)' }}>
          <HelpCircle size={12}/> Shortcuts
        </button>
      </div>

      {/* Shortcuts popover */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.15}}
            className="rounded-xl p-4" style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', boxShadow:'var(--shadow-md)' }}>
            <div className="flex justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Planner Shortcuts</p>
              <button onClick={() => setShowShortcuts(false)}><X size={13} style={{ color:'var(--text-muted)' }}/></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PLANNER_SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)' }}>{s.key}</kbd>
                  <span style={{ color:'var(--text-muted)' }}>{s.action}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date nav */}
      <div className="flex items-center justify-between">
        <button onClick={handlePrevDay} className="p-2 rounded-lg hover:bg-[var(--bg-sidebar)] transition-colors"><ChevronLeft size={18} style={{ color:'var(--text-secondary)' }}/></button>
        <div className="text-center">
          <div className="font-bold" style={{ color:'var(--text)' }}>
            {currentDate.toLocaleDateString('en-IN', { weekday:'long', month:'long', day:'numeric' })}
          </div>
          {!isToday && (
            <button onClick={handleToday} className="text-xs mt-0.5 hover:underline" style={{ color:'var(--accent)' }}>← Back to today</button>
          )}
          {isToday && <span className="text-xs font-semibold" style={{ color:'var(--accent)' }}>TODAY</span>}
        </div>
        <button onClick={handleNextDay} className="p-2 rounded-lg hover:bg-[var(--bg-sidebar)] transition-colors"><ChevronRight size={18} style={{ color:'var(--text-secondary)' }}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Tasks */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add task form — autoFocus */}
          <div className="rounded-[14px] p-4 space-y-3" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', boxShadow:'var(--shadow-sm)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Add Task</p>
            <input ref={taskInputRef} value={taskText} onChange={e=>setTaskText(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && !e.ctrlKey) handleAddTask(e); if(e.key==='Enter' && e.ctrlKey) handleAddTask(e, true); }}
              placeholder="Task description... (Enter to add)"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={INPUT_STYLE}/>
            <div className="grid grid-cols-3 gap-2">
              <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none" style={INPUT_STYLE}/>
              <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none" style={INPUT_STYLE}/>
              <select value={subject} onChange={e=>setSubject(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none" style={INPUT_STYLE}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddTask} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ background:'var(--accent)', color:'var(--bg-card)' }}>
                <Plus size={14}/> Add Task
              </button>
            </div>
          </div>

          {/* Carry-forward tasks */}
          {carriedTasks.length > 0 && (
            <div className="rounded-[14px] p-4 space-y-2" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.20)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'rgb(180,115,0)' }}>
                ↩ Carried forward ({carriedTasks.length})
              </p>
              {carriedTasks.map(t => (
                <div key={`${t._carriedFrom}-${t.id}`} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SUBJ_COLORS[t.subject] || 'var(--accent)' }}/>
                  <span className="flex-1" style={{ color:'var(--text-secondary)' }}>{t.text}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background:'rgba(245,158,11,0.12)', color:'rgb(180,115,0)' }}>
                    {t._daysAgo}d ago
                  </span>
                  <button onClick={() => { addPlannerTask(dateKey, { ...t, id:`carry_${Date.now()}`, _carriedFrom:undefined, _daysAgo:undefined, done:false }); toast.success('Task copied to today'); }}
                    className="text-xs px-2 py-0.5 rounded" style={{ background:'var(--accent-tint)', color:'var(--accent)' }}>+Today</button>
                </div>
              ))}
            </div>
          )}

          {/* Task list */}
          <div className="space-y-2">
            <AnimatePresence>
              {sortedTasks.length === 0 ? (
                <div className="py-12 my-2 text-center rounded-xl" style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                  <CalendarIcon size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No tasks for this day</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Add a task above or pick from KST suggestions</p>
                </div>
              ) : sortedTasks.map(task => (
                <motion.div key={task.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.15}}
                  className="flex items-center gap-3 px-4 py-3 rounded-[12px]"
                  style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', opacity: task.done ? 0.55 : 1 }}>
                  <button onClick={() => togglePlannerTask(dateKey, task.id)}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                    style={{ borderColor: task.done ? '#22c55e' : 'var(--border-medium)', background: task.done ? '#22c55e22' : 'transparent' }}>
                    {task.done && <Check size={10} className="text-green-500"/>}
                  </button>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SUBJ_COLORS[task.subject] || 'var(--accent)' }}/>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${task.done ? 'line-through' : ''}`} style={{ color:'var(--text)' }}>{task.text}</span>
                    {(task.startTime || task.endTime) && (
                      <span className="ml-2 text-xs font-mono" style={{ color:'var(--text-muted)' }}>{task.startTime}–{task.endTime}</span>
                    )}
                  </div>
                  <button onClick={() => { deletePlannerTask(dateKey, task.id); toast('Task deleted', { action:{ label:'Undo', onClick:()=>addPlannerTask(dateKey,task) } }); }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                    style={{ color:'var(--text-muted)' }}><Trash2 size={13}/></button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: KST suggestions + Sprints */}
        <div className="space-y-4">
          {/* KST Smart Suggestions */}
          {ec.dailyPlan.length > 0 && (
            <div className="rounded-[14px] p-4" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', boxShadow:'var(--shadow-sm)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--text-muted)' }}>KST Smart Suggestions</p>
              <div className="space-y-2">
                {ec.dailyPlan.map(chapter => (
                  <button key={chapter.id} onClick={() => handleQuickAdd(chapter)}
                    className="w-full flex items-center gap-2 text-left p-2.5 rounded-lg transition-all hover:-translate-y-0.5"
                    style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-light)' }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SUBJ_COLORS[chapter.subject] || 'var(--accent)' }}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color:'var(--text)' }}>{chapter.name}</div>
                      <div className="text-[10px]" style={{ color:'var(--text-muted)' }}>{chapter.subject} · {chapter.allocatedMinutes || 60}m</div>
                    </div>
                    <Plus size={12} style={{ color:'var(--accent)', shrink:0 }}/>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Plan Brief */}
          {hasAI && ec.dailyPlan.length > 0 && (
            <div className="rounded-[14px] p-4" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', boxShadow:'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>AI Daily Brief</p>
                <button onClick={async () => {
                    const ctx = {
                      todayPlan: ec.dailyPlan.map(c => ({ name: c.name, allocatedMinutes: c.allocatedMinutes || 60, subject: c.subject })),
                      totalBudgetMins: ec.dailyPlan.reduce((acc, c) => acc + (c.allocatedMinutes || 60), 0),
                      studyDebtHours: ec.studyDebt || 0,
                      smartPhase: ec.smartPhase,
                      daysToExam: ec.daysToExam,
                      burnoutStateLabel: ec.burnoutState?.label || 'Normal'
                    };
                    const res = await narrativePlan(ctx);
                    if (res) setAiPlanText(res); 
                  }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold transition-all"
                  style={{ background:'var(--accent-tint)', color:'var(--accent)' }}>
                  <Sparkles size={10}/> {aiLoading ? '…' : 'Generate'}
                </button>
              </div>
              {aiPlanText
                ? <MarkdownRenderer text={aiPlanText} className="text-xs leading-relaxed italic" style={{ color:'var(--text-secondary)' }} />
                : <p className="text-xs" style={{ color:'var(--text-muted)' }}>Click Generate for a personalised day briefing.</p>}
            </div>
          )}

          {/* Sprints */}
          <div className="rounded-[14px] p-4" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', boxShadow:'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Sprints</p>
              <button onClick={() => setShowSprintInput(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold transition-all"
                style={{ background:'var(--accent-tint)', color:'var(--accent)' }}><Plus size={11}/> New</button>
            </div>

            {/* Inline sprint name input */}
            <AnimatePresence>
              {showSprintInput && (
                <motion.form initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                  onSubmit={handleConfirmSprint} className="flex gap-2 mb-3 overflow-hidden">
                  <input autoFocus value={newSprintName} onChange={e=>setNewSprintName(e.target.value)}
                    placeholder="Sprint name..." className="flex-1 px-2 py-1.5 rounded-lg text-xs focus:outline-none" style={INPUT_STYLE}/>
                  <button type="submit" className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background:'var(--accent)', color:'var(--bg-card)' }}>Add</button>
                  <button type="button" onClick={() => setShowSprintInput(false)} className="px-2 py-1.5 rounded-lg text-xs" style={{ color:'var(--text-muted)' }}><X size={12}/></button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {sprints.length === 0 && !showSprintInput && (
                <div className="py-8 text-center rounded-xl" style={{ border: '2px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                  <CalendarIcon size={24} className="mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-medium">No sprints yet</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Create a focused sprint board</p>
                </div>
              )}
              {sprints.map(sprint => {
                const done = sprint.tasks.filter(t=>t.done).length;
                const pct = sprint.tasks.length > 0 ? done/sprint.tasks.length : 0;
                return (
                  <div key={sprint.id} className="rounded-xl p-3" style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-light)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color:'var(--text)' }}>{sprint.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono" style={{ color:'var(--text-muted)' }}>{done}/{sprint.tasks.length}</span>
                        <button onClick={() => deleteSprint(sprint.id)} className="opacity-40 hover:opacity-100"><Trash2 size={10} style={{ color:'var(--text-muted)' }}/></button>
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background:'var(--border-light)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width:`${pct*100}%`, background:'var(--accent)' }}/>
                    </div>
                    {sprint.tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-1.5 py-1">
                        <button onClick={() => toggleSprintTask(sprint.id, task.id)}
                          className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                          style={{ borderColor: task.done?'#22c55e':'var(--border-medium)', background: task.done?'#22c55e22':'transparent' }}>
                          {task.done && <Check size={9} className="text-green-500"/>}
                        </button>
                        <span className={`text-xs flex-1 ${task.done?'line-through opacity-50':''}`} style={{ color:'var(--text)' }}>{task.text}</span>
                        <button onClick={() => deleteSprintTask(sprint.id, task.id)}><Trash2 size={10} style={{ color:'var(--text-muted)' }} className="opacity-30 hover:opacity-100"/></button>
                      </div>
                    ))}
                    <form onSubmit={e=>handleAddSprintTask(e,sprint.id)} className="flex gap-1.5 mt-2">
                      <input value={newSprintTask[sprint.id]||''} onChange={e=>setNewSprintTask(p=>({...p,[sprint.id]:e.target.value}))}
                        placeholder="Add task..." className="flex-1 px-2 py-1 rounded text-xs focus:outline-none"
                        style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'var(--text)' }}/>
                      <button type="submit" className="px-2 py-1 rounded text-xs font-semibold" style={{ background:'var(--accent)', color:'var(--bg-card)' }}>+</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
