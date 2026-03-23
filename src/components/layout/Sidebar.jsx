import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import {
  LayoutDashboard, Timer, BookOpen, BarChart2, Scale,
  CalendarDays, BrainCircuit, FileText, Sparkles, Settings2,
  Zap, AlertTriangle
} from 'lucide-react';

const LINKS = [
  { to: '/',           label: 'Dashboard', icon: LayoutDashboard, end: true,  key: 'D' },
  { to: '/timer',      label: 'Timer',     icon: Timer,           end: false, key: 'T' },
  { to: '/chapters',   label: 'Chapters',  icon: BookOpen,        end: false, key: 'C' },
  { to: '/scores',     label: 'Scores',    icon: BarChart2,       end: false, key: 'S' },
  { to: '/weights',    label: 'Weights',   icon: Scale,           end: false, key: null },
  { to: '/planner',    label: 'Planner',   icon: CalendarDays,    end: false, key: null },
  { to: '/flashcards', label: 'Flashcards',icon: BrainCircuit,    end: false, key: 'F' },
  { to: '/notes',      label: 'Notes',     icon: FileText,        end: false, key: 'N' },
  { to: '/advisor',    label: 'Advisor',   icon: Sparkles,        end: false, key: 'I' },
  { to: '/settings',   label: 'Settings',  icon: Settings2,       end: false, key: null },
];

export default function Sidebar({ onOpenPanic, onOpenCommand }) {
  const { settings, sessions } = useAppStore();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayMins = sessions
    .filter(s => (s.date || '').startsWith(todayStr))
    .reduce((acc, s) => acc + (s.mins || 0), 0);

  const targetMins = (settings.dailyTargetHours || 8) * 60;
  const progressPct = Math.min(100, (todayMins / targetMins) * 100);
  const hoursCompleted = (todayMins / 60).toFixed(1);
  const targetHours = settings.dailyTargetHours || 8;

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen flex-shrink-0"
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)' }}>

      {/* Brand */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2.5 px-5 py-5 w-full text-left hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          <Zap size={16} strokeWidth={2.5} />
        </div>
        <div className="leading-none">
          <div className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>ExamHQ</div>
          <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>2026</div>
        </div>
      </button>

      {/* Command search hint */}
      <button
        onClick={onOpenCommand}
        className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all w-[calc(100%-24px)]"
        style={{ background: 'var(--bg)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity:0.5 }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="m12 12 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="flex-1 text-left">Search...</span>
        <kbd className="text-[9px] px-1 rounded font-mono" style={{ background:'var(--border-light)' }}>⌘K</kbd>
      </button>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        {LINKS.map(({ to, label, icon: Icon, end, key }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'nav-active'
                  : 'nav-default'
              }`
            }
            style={({ isActive }) => isActive ? {
              background: 'var(--accent-tint)',
              color: 'var(--accent)',
            } : {
              color: 'var(--text-secondary)',
            }}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                    style={{ background: 'var(--accent)' }} />
                )}
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2}
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                  className="shrink-0 transition-colors" />
                <span className="flex-1">{label}</span>
                {key && (
                  <kbd className="hidden group-hover:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono leading-none"
                    style={{ background: 'var(--border-light)', color: 'var(--text-muted)', fontSize: '10px' }}>
                    {key}
                  </kbd>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-3 space-y-3"
        style={{ borderTop: '1px solid var(--border-light)' }}>

        {/* Daily progress */}
        <div>
          <div className="flex justify-between items-center mb-1.5 text-xs">
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Today's grind</span>
            <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
              {hoursCompleted}<span style={{ color: 'var(--text-muted)' }}>/{targetHours}h</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPct}%`,
                background: progressPct >= 100
                  ? '#22c55e'
                  : progressPct >= 50
                  ? '#f59e0b'
                  : 'var(--accent)'
              }}
            />
          </div>
        </div>

        {/* Panic button */}
        <button
          onClick={onOpenPanic}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: 'rgb(220,38,38)',
            border: '1px solid rgba(239,68,68,0.15)',
          }}
        >
          <AlertTriangle size={14} strokeWidth={2.5} />
          Panic Mode
        </button>
      </div>
    </aside>
  );
}
