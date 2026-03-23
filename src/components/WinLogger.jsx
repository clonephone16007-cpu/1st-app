import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { Trophy, X, Star, Zap, Flame, Target } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFocusTrap } from '../hooks/useFocusTrap';

const winTypes = [
  { id: 'milestone', icon: Trophy, label: 'Milestone Reached', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { id: 'breakthrough', icon: Zap, label: 'Concept Breakthrough', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { id: 'streak', icon: Flame, label: 'Consistency Streak', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { id: 'target', icon: Target, label: 'Target Crushed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { id: 'other', icon: Star, label: 'Small Win', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' }
];

export default function WinLogger({ isOpen, onClose }) {
  const { addWin } = useAppStore();
  const [selectedType, setSelectedType] = useState(winTypes[0].id);
  const [description, setDescription] = useState('');
  const containerRef = useRef(null);
  useFocusTrap(containerRef, isOpen);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setSelectedType(winTypes[0].id);
      setDescription('');
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    addWin({
      id: Date.now().toString(),
      type: selectedType,
      description: description.trim(),
      date: new Date().toISOString()
    });

    // Trigger confetti
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-sidebar)]">
              <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> Log a Win
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-card)] rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  What kind of win?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {winTypes.map(type => {
                    const Icon = type.icon;
                    const isSelected = selectedType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setSelectedType(type.id)}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                          isSelected 
                            ? `${type.bg} ${type.border} ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-card)]` 
                            : 'bg-[var(--bg-sidebar)] border-[var(--border-light)] hover:border-[var(--border-medium)]'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-2 ${isSelected ? type.color : 'text-[var(--text-muted)]'}`} />
                        <span className={`text-xs font-bold text-center ${isSelected ? 'text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  Describe your win
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="I finally understood rotational mechanics..."
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-medium)] rounded-xl p-4 text-sm focus:outline-none focus:border-[var(--accent)] resize-none h-24"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!description.trim()}
                className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5" /> Celebrate!
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
