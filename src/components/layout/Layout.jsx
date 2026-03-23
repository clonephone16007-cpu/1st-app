import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import SoundPanel from '../SoundPanel';
import PanicMode from '../PanicMode';
import WinLogger from '../WinLogger';
import CommandPalette from '../CommandPalette';
import { useAppStore } from '../../store/useAppStore';
import { useTimerStore } from '../../store/useTimerStore';
import { toast } from 'sonner';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppStore();
  const { paused, resume, pause, running } = useTimerStore();

  const [isSoundPanelOpen, setIsSoundPanelOpen]   = useState(false);
  const [isPanicModeOpen, setIsPanicModeOpen]     = useState(false);
  const [isWinLoggerOpen, setIsWinLoggerOpen]     = useState(false);
  const [isCommandOpen, setIsCommandOpen]         = useState(false);
  const [isNightShiftActive, setIsNightShiftActive] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!settings.nightShift) { setIsNightShiftActive(false); return; }
      const h = new Date().getHours();
      setIsNightShiftActive(h >= 21 || h < 7);
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [settings.nightShift]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsCommandOpen(p => !p); return; }
      if (e.key === '/' && !isCommandOpen) { e.preventDefault(); setIsCommandOpen(true); return; }
      switch (e.key.toLowerCase()) {
        case 'a': setIsSoundPanelOpen(p => !p); break;
        case 'p': setIsPanicModeOpen(true); break;
        case 'w': setIsWinLoggerOpen(true); break;
        case ' ': if (running) { e.preventDefault(); paused ? resume() : pause(); } break;
        case 'd': navigate('/'); break;
        case 't': navigate('/timer'); break;
        case 'c': navigate('/chapters'); break;
        case 's': navigate('/scores'); break;
        case 'f': navigate('/flashcards'); break;
        case 'n': navigate('/notes'); break;
        case 'i': navigate('/advisor'); break;
        case 'escape':
          setIsSoundPanelOpen(false); setIsPanicModeOpen(false);
          setIsWinLoggerOpen(false); setIsCommandOpen(false);
          break;
        case '?':
          toast('Shortcuts', { description: '⌘K: Search  ·  D T C S F N I: Pages  ·  A: Audio  ·  P: Panic  ·  W: Win  ·  Space: Play/Pause' });
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, paused, resume, pause, running, isCommandOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans relative"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {isNightShiftActive && (
        <div className="fixed inset-0 pointer-events-none z-[9999]"
          style={{ background: 'rgba(120,60,0,0.08)', mixBlendMode: 'multiply' }}/>
      )}

      <Sidebar onOpenPanic={() => setIsPanicModeOpen(true)} onOpenCommand={() => setIsCommandOpen(true)}/>

      <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative z-0">
        {/* AnimatePresence outside, motion.div keyed inside — prevents blank flash */}
        <AnimatePresence initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ willChange: 'opacity, transform' }}
            className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav />
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)}
        onOpenPanic={() => setIsPanicModeOpen(true)}
        onOpenSound={() => setIsSoundPanelOpen(true)}
        onOpenWin={() => setIsWinLoggerOpen(true)}/>
      <SoundPanel isOpen={isSoundPanelOpen} onClose={() => setIsSoundPanelOpen(false)}/>
      <PanicMode isOpen={isPanicModeOpen} onClose={() => setIsPanicModeOpen(false)}/>
      <WinLogger isOpen={isWinLoggerOpen} onClose={() => setIsWinLoggerOpen(false)}/>
    </div>
  );
}
