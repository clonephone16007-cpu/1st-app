import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pause, Play, Square, Minimize } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

const SUBJECT_COLORS = {
  Math: '#D4870A', Physics: '#2471A3', Chemistry: '#7D3C98', General: 'var(--accent)',
};

function fmt(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function FullscreenTimer({ isOpen, running, paused, elapsed, target, subject, mode, onPause, onResume, onStop, onClose, onOpen }) {
  const color = SUBJECT_COLORS[subject] || 'var(--accent)';
  const displaySecs = mode === 'free' ? elapsed : Math.max(0, target - elapsed);
  const progress = target > 0 ? Math.min(1, elapsed / target) : elapsed / 3600;
  const radius = 120;
  const circ = 2 * Math.PI * radius;

  const containerRef = useRef(null);
  useFocusTrap(containerRef, isOpen);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); paused ? onResume() : onPause(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, paused, onPause, onResume, onClose]);

  // Set/remove data-overlay on body so sidebar & nav hide via CSS
  // requestFullscreen is NOT called here — it must come from a direct user-gesture (onOpen prop)
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-overlay', 'true');
    } else {
      document.body.removeAttribute('data-overlay');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
    return () => document.body.removeAttribute('data-overlay');
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          key="fullscreen-timer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          {/* Subject label */}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-12 opacity-60" style={{ color }}>
            {subject} — {mode}
          </p>

          {/* Ring */}
          <div className="relative" style={{ width: 300, height: 300 }}>
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 280 280"
              style={{ '--glow-color': color }}
            >
              <defs>
                <filter id="fs-glow">
                  <feGaussianBlur stdDeviation="4" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <circle cx="140" cy="140" r={radius} fill="none" stroke="var(--border-light)" strokeWidth="8"/>
              <circle cx="140" cy="140" r={radius} fill="none"
                stroke={color} strokeWidth="8"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - progress)}
                strokeLinecap="round"
                filter="url(#fs-glow)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-6xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                {fmt(displaySecs)}
              </span>
              {paused && (
                <span className="text-xs uppercase tracking-widest mt-2 opacity-50" style={{ color: 'var(--text-muted)' }}>paused</span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 mt-14">
            <button
              onClick={paused ? onResume : onPause}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: color + '22', border: `2px solid ${color}`, color }}
            >
              {paused ? <Play size={22} strokeWidth={2.5}/> : <Pause size={22} strokeWidth={2.5}/>}
            </button>
            <button
              onClick={() => { onStop(); onClose(); }}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 opacity-50 hover:opacity-100"
              style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}
            >
              <Square size={16}/>
            </button>
          </div>

          {/* Exit hint */}
          <button onClick={onClose} className="absolute top-5 right-5 opacity-30 hover:opacity-70 transition-opacity flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--text-muted)' }}>
            <Minimize size={14}/> Press Esc to exit
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
