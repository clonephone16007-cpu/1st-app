import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Timer, BookOpen, BarChart2, Scale,
  CalendarDays, BrainCircuit, FileText, Sparkles, Settings2,
  AlertTriangle, Music2, Trophy, Search, ArrowRight, Hash
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { chapters as chapterDefs } from '../data/chapters';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useDebounce } from '../hooks/useDebounce';

const NAV_ITEMS = [
  { label: 'Dashboard',  to: '/',           icon: LayoutDashboard, group: 'Pages' },
  { label: 'Timer',      to: '/timer',       icon: Timer,           group: 'Pages' },
  { label: 'Chapters',   to: '/chapters',    icon: BookOpen,        group: 'Pages' },
  { label: 'Scores',     to: '/scores',      icon: BarChart2,       group: 'Pages' },
  { label: 'Weights',    to: '/weights',     icon: Scale,           group: 'Pages' },
  { label: 'Planner',    to: '/planner',     icon: CalendarDays,    group: 'Pages' },
  { label: 'Flashcards', to: '/flashcards',  icon: BrainCircuit,    group: 'Pages' },
  { label: 'Notes',      to: '/notes',       icon: FileText,        group: 'Pages' },
  { label: 'AI Advisor', to: '/advisor',     icon: Sparkles,        group: 'Pages' },
  { label: 'Settings',   to: '/settings',    icon: Settings2,       group: 'Pages' },
];

export default function CommandPalette({ isOpen, onClose, onOpenPanic, onOpenSound, onOpenWin }) {
  const navigate = useNavigate();
  const { chapters } = useAppStore();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [activeIdx, setActiveIdx] = useState(0);
  const [historyLabels, setHistoryLabels] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('examhq_cp_history') || '[]'); } catch { return []; }
  });
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const containerRef = useRef(null);
  useFocusTrap(containerRef, isOpen);

  // Build chapter items from store + defs
  const chapterItems = useMemo(() => {
    return chapterDefs.slice(0, 60).map(c => ({
      label: c.name,
      sub: c.subject,
      to: '/chapters',
      state: { search: c.name, subject: c.subject },
      icon: BookOpen,
      group: 'Chapters',
    }));
  }, []);

  const actionItems = [
    { label: 'Panic Mode',   icon: AlertTriangle, group: 'Actions', action: () => { onClose(); onOpenPanic(); } },
    { label: 'Ambient Audio',icon: Music2,        group: 'Actions', action: () => { onClose(); onOpenSound(); } },
    { label: 'Log a Win',    icon: Trophy,        group: 'Actions', action: () => { onClose(); onOpenWin(); } },
  ];

  const all = [...NAV_ITEMS, ...actionItems, ...chapterItems];
  const recentItems = historyLabels.map(label => all.find(i => i.label === label)).filter(Boolean).map(i => ({...i, group: 'Recent'}));

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) {
      if (recentItems.length > 0) {
        const remaining = all.filter(i => i.group === 'Pages' && !historyLabels.includes(i.label)).slice(0, 8);
        return [...recentItems, ...remaining];
      }
      return all.filter(i => i.group !== 'Chapters').slice(0, 12);
    }
    return all.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.sub && i.sub.toLowerCase().includes(q)) ||
      (i.group && i.group.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [debouncedQuery, all, recentItems, historyLabels]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIdx];
        if (!item) return;
        if (item.action) { item.action(); return; }
        navigate(item.to, item.state ? { state: item.state } : undefined);
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, filtered, activeIdx, navigate, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Reset active index when debounced query changes
  useEffect(() => { setActiveIdx(0); }, [debouncedQuery]);

  // Group items
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((item, idx) => {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push({ ...item, _idx: idx });
    });
    return map;
  }, [filtered]);

  const handleSelect = (item) => {
    try {
      let h = historyLabels.filter(label => label !== item.label);
      h.unshift(item.label);
      h = h.slice(0, 4);
      sessionStorage.setItem('examhq_cp_history', JSON.stringify(h));
      setHistoryLabels(h);
    } catch(e){}

    if (item.action) { item.action(); return; }
    navigate(item.to, item.state ? { state: item.state } : undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={containerRef}
            key="cp-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[18%] left-1/2 -translate-x-1/2 z-[201] w-full max-w-[560px] rounded-2xl overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: '1px solid var(--border-light)' }}>
              <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search pages, chapters, actions..."
                className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:font-normal"
                style={{ color: 'var(--text)' }}
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'var(--border-light)', color: 'var(--text-muted)' }}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No results for "{query}"
                </div>
              ) : (
                Object.entries(groups).map(([group, items]) => (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)' }}>
                      {group}
                    </div>
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item._idx === activeIdx;
                      return (
                        <button
                          key={item._idx}
                          onMouseEnter={() => setActiveIdx(item._idx)}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                          style={{
                            background: isActive ? 'var(--accent-tint)' : 'transparent',
                            color: isActive ? 'var(--accent)' : 'var(--text)',
                          }}
                        >
                          <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{
                              background: isActive ? 'var(--accent)' : 'var(--border-light)',
                              color: isActive ? 'var(--bg-card)' : 'var(--text-muted)',
                            }}>
                            <Icon size={13} strokeWidth={2} />
                          </span>
                          <span className="flex-1 font-medium">{item.label}</span>
                          {item.sub && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.sub}</span>
                          )}
                          {isActive && <ArrowRight size={13} style={{ color: 'var(--accent)', opacity: 0.7 }} />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 flex items-center gap-4 text-[10px] font-mono"
              style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
              <span><kbd className="bg-transparent border border-current rounded px-1">↑↓</kbd> navigate</span>
              <span><kbd className="bg-transparent border border-current rounded px-1">↵</kbd> open</span>
              <span><kbd className="bg-transparent border border-current rounded px-1">esc</kbd> close</span>
              <span className="ml-auto flex items-center gap-1">
                <Hash size={10} /> ExamHQ
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
