import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Timer, BookOpen, BarChart2, BrainCircuit,
  FileText, Sparkles, Settings2, Scale, CalendarDays,
} from 'lucide-react';

const LINKS = [
  { to: '/',           label: 'Home',    icon: LayoutDashboard, end: true  },
  { to: '/timer',      label: 'Timer',   icon: Timer,           end: false },
  { to: '/chapters',   label: 'Study',   icon: BookOpen,        end: false },
  { to: '/scores',     label: 'Scores',  icon: BarChart2,       end: false },
  { to: '/weights',    label: 'Weights', icon: Scale,           end: false },
  { to: '/planner',    label: 'Plan',    icon: CalendarDays,    end: false },
  { to: '/flashcards', label: 'Cards',   icon: BrainCircuit,    end: false },
  { to: '/advisor',    label: 'AI',      icon: Sparkles,        end: false },
  { to: '/settings',   label: 'More',    icon: Settings2,       end: false },
];

export default function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch h-[60px] bottom-nav no-print"
      style={{
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-light)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {LINKS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors min-w-0"
          style={({ isActive }) => ({
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            minHeight: '44px', // Touch target
          })}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className="text-[9px] font-medium leading-none truncate max-w-full px-0.5">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
