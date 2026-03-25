import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize, Minimize, Clock, Target, Play, Pause } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useTimerStore } from '../store/useTimerStore';
import { useFocusTrap } from '../hooks/useFocusTrap';

const QUOTES = [
  "Focus is a muscle. Train it.",
  "One thing at a time.",
  "Deep work is the superpower of the 21st century.",
  "Distraction is the enemy of progress.",
  "You are capable of more than you know.",
  "The secret of getting ahead is getting started.",
  "Discipline is the bridge between goals and achievement.",
  "Work hard in silence. Let success make the noise.",
];

const SUBJECT_COLORS = {
  Math:      '#D4870A',
  Physics:   '#2471A3',
  Chemistry: '#7D3C98',
  General:   '#10B981',
};

export default function FocusMode({ isOpen, onClose, currentSubject }) {
  const { settings } = useAppStore();
  // Read timer state DIRECTLY from store — no more prop drilling of target/elapsed
  const { running, paused, elapsed, target, pause, resume } = useTimerStore();
  const [quote, setQuote] = useState(QUOTES[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useFocusTrap(containerRef, isOpen);

  // Sync isFullscreen with actual browser fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Set/remove data-overlay on body so sidebar & nav hide via CSS
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-overlay', 'true');
    } else {
      document.body.removeAttribute('data-overlay');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
    return () => document.body.removeAttribute('data-overlay');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      const interval = setInterval(() => {
        setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      }, 30000);

      if (settings.keepAwake && 'wakeLock' in navigator) {
        let wakeLock = null;
        navigator.wakeLock.request('screen').then(wl => { wakeLock = wl; }).catch(() => {});
        return () => {
          clearInterval(interval);
          if (wakeLock) wakeLock.release().catch(() => {});
        };
      }
      return () => clearInterval(interval);
    }
  }, [isOpen, settings.keepAwake]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { handleClose(); }
      if (e.code === 'Space' && running) {
        e.preventDefault();
        if (paused) resume(); else pause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, running, paused, pause, resume]);

  const handleClose = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(safeSeconds / 3600);
    const m = Math.floor((safeSeconds % 3600) / 60);
    const s = safeSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const radius = 180;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  let dashoffset = circumference;
  if (running || paused) {
    if (target > 0) {
      dashoffset = circumference * (1 - Math.min(1, elapsed / target));
    } else {
      dashoffset = circumference * (1 - (elapsed % 3600) / 3600);
    }
  }

  const accentColor = SUBJECT_COLORS[currentSubject] || '#10B981';
  // Safe display time calculation
  const displayTime = (running || paused)
    ? (target > 0 ? Math.max(0, target - elapsed) : elapsed)
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-white"
          style={{ background: '#0A0A0A' }}
        >
          {/* Top controls */}
          <div className="absolute top-6 right-6 flex gap-3 z-50">
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <button
              onClick={handleClose}
              className="p-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center -mt-10">
            {/* Subject Badge */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full mb-12"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <Target size={15} style={{ color: accentColor }} />
              <span className="font-bold tracking-widest uppercase text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {currentSubject || 'Deep Focus'}
              </span>
              {paused && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(245,158,11,0.2)', color: 'rgb(245,158,11)' }}>
                  PAUSED
                </span>
              )}
              {!running && !paused && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(100,100,100,0.3)', color: 'rgba(255,255,255,0.5)' }}>
                  NOT STARTED
                </span>
              )}
            </motion.div>

            {/* Giant Timer Ring */}
            <div className="relative flex items-center justify-center w-[400px] h-[400px]">
              <svg
                className={`absolute inset-0 w-full h-full -rotate-90${running && !paused ? ' timer-glow-strong' : ''}`}
                viewBox="0 0 400 400"
                style={{ '--glow-color': accentColor }}
              >
                <circle cx="200" cy="200" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
                <circle
                  cx="200" cy="200" r={radius} fill="none"
                  stroke={accentColor}
                  strokeWidth={stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>

              <div
                className="absolute font-mono font-bold tracking-tighter tabular-nums z-10"
                style={{
                  fontSize: '5.5rem',
                  color: paused ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)',
                  transition: 'color 0.3s ease',
                  textShadow: paused ? 'none' : '0 0 40px rgba(255,255,255,0.15)',
                }}
              >
                {formatTime(displayTime)}
              </div>
            </div>

            {/* Pause/Resume button */}
            {running && (
              <motion.div
                className="mt-12"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <button
                  onClick={() => { if (paused) resume(); else pause(); }}
                  className="flex items-center gap-2 mx-auto px-8 py-3.5 rounded-full font-bold text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  style={{
                    background: paused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = paused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}
                >
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                  {paused ? 'Resume Session' : 'Pause Session'}
                </button>
              </motion.div>
            )}

            {/* If timer not started yet */}
            {!running && !paused && (
              <p className="mt-12 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Start a timer session first, then enter Focus Mode.
              </p>
            )}
          </div>

          <div className="absolute bottom-12 w-full text-center px-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={quote}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="text-lg font-serif italic max-w-lg mx-auto"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                "{quote}"
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="absolute bottom-6 flex items-center gap-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.15)' }}>
            <Clock size={12} />
            <span>Esc to exit</span>
            {running && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                <span>Space to {paused ? 'resume' : 'pause'}</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
