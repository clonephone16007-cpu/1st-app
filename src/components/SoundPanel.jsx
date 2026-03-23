import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Volume2, VolumeX, CloudRain, Zap, Coffee, Flame, Waves, Trees, Wind, Music, Bell, Keyboard, BookOpen } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import { useFocusTrap } from '../hooks/useFocusTrap';

const sounds = [
  { id: 'rain', name: 'Rain', icon: CloudRain },
  { id: 'thunder', name: 'Thunder', icon: Zap },
  { id: 'cafe', name: 'Café', icon: Coffee },
  { id: 'fireplace', name: 'Fireplace', icon: Flame },
  { id: 'ocean', name: 'Ocean', icon: Waves },
  { id: 'forest', name: 'Forest', icon: Trees },
  { id: 'white', name: 'White Noise', icon: Wind },
  { id: 'brown', name: 'Brown Noise', icon: Wind },
  { id: 'lofi', name: 'Lo-Fi Beat', icon: Music },
  { id: 'bells', name: 'Chimes', icon: Bell },
  { id: 'keyboard', name: 'Typing', icon: Keyboard },
  { id: 'library', name: 'Library', icon: BookOpen }
];

const presets = [
  { name: 'Deep Focus', mix: { brown: 0.6, rain: 0.4 } },
  { name: 'Cozy Study', mix: { fireplace: 0.7, cafe: 0.3, rain: 0.2 } },
  { name: 'Nature', mix: { forest: 0.5, ocean: 0.4, bells: 0.2 } },
  { name: 'Coding', mix: { lofi: 0.6, keyboard: 0.4 } }
];

export default function SoundPanel({ isOpen, onClose }) {
  const { play, stop, stopAll, setVolume, setMaster, isPlaying, volumes, masterVol } = useAudio();
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
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleToggle = (id) => {
    if (isPlaying(id)) {
      stop(id);
    } else {
      play(id);
    }
  };

  const applyPreset = (preset) => {
    stopAll();
    Object.entries(preset.mix).forEach(([id, vol]) => {
      setVolume(id, vol);
      play(id);
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          <motion.div
            ref={containerRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t border-[var(--border-light)] rounded-t-3xl shadow-2xl z-50 p-6 max-h-[80vh] overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                  <Volume2 className="w-6 h-6 text-[var(--accent)]" /> Ambient Sounds
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-[var(--bg-sidebar)] rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-8 bg-[var(--bg-sidebar)] p-4 rounded-xl border border-[var(--border-light)]">
                <VolumeX className="w-5 h-5 text-[var(--text-muted)]" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={masterVol}
                  onChange={(e) => setMaster(parseFloat(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                />
                <Volume2 className="w-5 h-5 text-[var(--text)]" />
                <button 
                  onClick={stopAll}
                  className="ml-4 px-3 py-1 text-xs font-bold bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors"
                >
                  Stop All
                </button>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Presets</h3>
                <div className="flex flex-wrap gap-2">
                  {presets.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="px-4 py-2 bg-[var(--bg-sidebar)] border border-[var(--border-medium)] rounded-full text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sounds.map(sound => {
                  const Icon = sound.icon;
                  const active = isPlaying(sound.id);
                  const vol = volumes[sound.id] ?? 0.5;

                  return (
                    <div 
                      key={sound.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        active ? 'bg-[var(--accent-tint)] border-[var(--accent)]' : 'bg-[var(--bg-sidebar)] border-[var(--border-light)]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <button 
                          onClick={() => handleToggle(sound.id)}
                          className={`flex items-center gap-2 font-medium ${active ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
                        >
                          <Icon className="w-5 h-5" /> {sound.name}
                        </button>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01"
                        value={vol}
                        onChange={(e) => setVolume(sound.id, parseFloat(e.target.value))}
                        disabled={!active}
                        className={`w-full accent-[var(--accent)] ${!active && 'opacity-30'}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
