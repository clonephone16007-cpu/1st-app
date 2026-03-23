import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { useTimerStore } from '../store/useTimerStore';
import { schedulerEngine } from '../engines/schedulerEngine';
import { chapters as chapterDefs } from '../data/chapters';
import { useNavigate } from 'react-router-dom';
import { X, HeartPulse, AlertTriangle, ArrowRight } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export default function PanicMode({ isOpen, onClose }) {
  const { settings, chapters } = useAppStore();
  const { setSubject, start } = useTimerStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [breathePhase, setBreathePhase] = useState('inhale');
  const [urgentTasks, setUrgentTasks] = useState([]);
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
      setStep(1);
      setBreathePhase('inhale');
      
      // Vibrate on open if enabled
      if (settings.haptic && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      // Breathing cycle
      const cycle = setInterval(() => {
        setBreathePhase(prev => {
          if (prev === 'inhale') return 'hold';
          if (prev === 'hold') return 'exhale';
          return 'inhale';
        });
      }, 4000);

      // Fetch urgent tasks for step 2
      const tasks = schedulerEngine.getTopChapters(chapters, chapterDefs, settings, 3);
      setUrgentTasks(tasks);

      return () => {
        clearInterval(cycle);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, settings.haptic, onClose]);

  const handleNext = () => setStep(2);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-red-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-xl w-full text-center">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="space-y-12"
              >
                <div className="space-y-4">
                  <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
                  <h2 className="text-4xl font-bold font-serif text-white">Panic Mode Activated</h2>
                  <p className="text-red-200 text-lg">Don't worry. We've got this. Just breathe.</p>
                </div>

                <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
                  <motion.div
                    animate={{
                      scale: breathePhase === 'inhale' ? 1.5 : breathePhase === 'hold' ? 1.5 : 1,
                      opacity: breathePhase === 'hold' ? 0.8 : 0.5
                    }}
                    transition={{ duration: 4, ease: "easeInOut" }}
                    className="absolute inset-0 bg-red-500 rounded-full blur-3xl"
                  />
                  <div className="relative z-10 text-3xl font-bold text-white uppercase tracking-widest">
                    {breathePhase}
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  className="mx-auto flex items-center gap-2 bg-white text-red-950 px-8 py-4 rounded-full font-bold text-lg hover:bg-red-100 transition-colors"
                >
                  I'm calmer now <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-white/10 border border-white/20 rounded-3xl p-8 backdrop-blur-lg text-left"
              >
                <h3 className="text-2xl font-bold font-serif text-white mb-6 flex items-center gap-3">
                  <HeartPulse className="w-8 h-8 text-red-400" /> Action Plan
                </h3>
                <p className="text-red-100 mb-8">Here is exactly what you need to do right now. Ignore everything else.</p>
                
                <div className="space-y-4 mb-8">
                  {urgentTasks.map((task, i) => (
                    <div key={i} className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-white font-bold text-lg">{task.name}</div>
                          <div className="text-red-200 text-sm">{task.subject} • {task.tier} Priority</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSubject(task.subject);
                          start(25 * 60, 'pomodoro', task.subject);
                          onClose();
                          navigate('/timer');
                        }}
                        className="shrink-0 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition-colors whitespace-nowrap"
                      >
                        Start 25min →
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onClose}
                  className="w-full bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
