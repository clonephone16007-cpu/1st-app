import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { chapters as chapterDefs } from '../data/chapters';
import { exams } from '../data/exams';

// Cap eqLog at 500 entries to prevent localStorage overflow
// Permanent signal events are preserved; high-frequency events are trimmed.
const MAX_EQ_LOG = 500;
function appendEq(log, entry) {
  const next = [...log, entry];
  if (next.length <= MAX_EQ_LOG) return next;
  
  const permanentTypes = ['chapter_completed', 'score_added', 'win_logged'];
  const permanent = next.filter(e => permanentTypes.includes(e.type));
  const highFreq = next.filter(e => !permanentTypes.includes(e.type));
  
  const allowedHighFreq = Math.max(0, MAX_EQ_LOG - permanent.length);
  const trimmedHighFreq = allowedHighFreq > 0 ? highFreq.slice(-allowedHighFreq) : [];
  
  return [...permanent, ...trimmedHighFreq].sort((a, b) => a.timestamp - b.timestamp);
}

// Current store schema version — increment when shape changes
const CURRENT_VERSION = 2;

// Default settings shape — used for resets and as reference
const DEFAULT_SETTINGS = {
  activeExams: ['jee', 'cet', 'met', 'ugee'],
  theme: 'warm',
  accentColor: null,
  cardStyle: 'subtle',
  borderRadius: 'default',
  bgTexture: 'none',
  font: 'inter',
  fontSize: 'medium',
  density: 'comfortable',
  motion: 'normal',
  ghostAIR: 2000,
  dailyTargetHours: 8,
  keepAwake: false,
  haptic: true,
  sound: false,
  notifications: false,
  nightShift: false,
  targetAIR: { jee: 5000, cet: 3000, met: 10000, ugee: 500 },
  examDates: {
    jee: '2026-04-02',
    cet: '2026-04-11',
    met: '2026-04-13',
    ugee: '2026-05-02',
  },
  geminiApiKey: '',
  aiProvider: 'gemini',
  chapterOverrides: {},
};

export const useAppStore = create(
  persist(
    (set, get) => ({
      // State
      sessions: [],
      chapters: {},
      scores: {},
      flashcards: [],
      notes: {},
      pinnedNotes: {},
      formulaProgress: {},
      planner: {},
      sprints: [],
      mood: {},
      wins: [],
      eqLog: [],
      undoStack: [], // Last 5 destructive actions for undo
      weeklyReviewLastDate: null,
      onboardingDismissed: false,
      missionAcceptedToday: null,
      conversionDismissedAt: null,
      settings: { ...DEFAULT_SETTINGS },

      // ─── Actions ─────────────────────────────────────────────────────────

      addSession: (session) => set((state) => {
        // Schema validation: Impossible durations
        if (!session || typeof session.mins !== 'number' || session.mins < 1 || session.mins > 720) return state;
        // Schema validation: Future dates — use YYYY-MM-DD string comparison
        const todayStr = new Date().toISOString().split('T')[0];
        const sessionDateStr = (session.date || '').split('T')[0];
        if (sessionDateStr > todayStr) return state;
        return {
          sessions: [...state.sessions, session],
          eqLog: appendEq(state.eqLog, { type: 'session_added', timestamp: Date.now(), data: session })
        };
      }),

      updateSession: (id, data) => set((state) => ({
        sessions: state.sessions.map(s => s.id === id ? { ...s, ...data } : s)
      })),

      deleteSession: (id) => set((state) => {
        const session = state.sessions.find(s => s.id === id);
        return {
          sessions: state.sessions.filter(s => s.id !== id),
          undoStack: session
            ? [...state.undoStack.slice(-4), { type: 'delete_session', data: session, timestamp: Date.now() }]
            : state.undoStack,
        };
      }),

      undoLastAction: () => set((state) => {
        if (state.undoStack.length === 0) return state;
        const last = state.undoStack[state.undoStack.length - 1];
        const newStack = state.undoStack.slice(0, -1);
        switch (last.type) {
          case 'delete_session':
            return { sessions: [...state.sessions, last.data], undoStack: newStack };
          case 'delete_score': {
            const { examId, scoreData } = last.data;
            return {
              scores: {
                ...state.scores,
                [examId]: [...(state.scores[examId] || []), scoreData],
              },
              undoStack: newStack,
            };
          }
          case 'chapter_undone': {
            const { id, prevState } = last.data;
            return {
              chapters: { ...state.chapters, [id]: prevState },
              undoStack: newStack,
            };
          }
          case 'delete_flashcard':
            return { flashcards: [...state.flashcards, last.data], undoStack: newStack };
          default:
            return { undoStack: newStack };
        }
      }),
      
      updateChapter: (id, data) => set((state) => {
        const isNowDone = data.done && (!state.chapters[id] || !state.chapters[id].done);
        const wasUndone = data.done === false && state.chapters[id]?.done;
        return {
          chapters: {
            ...state.chapters,
            [id]: {
              ...state.chapters[id],
              ...data,
              ...(isNowDone ? { doneAt: Date.now() } : {}),
            },
          },
          eqLog: isNowDone
            ? appendEq(state.eqLog, { type: 'chapter_completed', timestamp: Date.now(), chapterId: id })
            : state.eqLog,
          // Track undone for undo
          undoStack: wasUndone
            ? [...state.undoStack.slice(-4), { type: 'chapter_undone', data: { id, prevState: state.chapters[id] }, timestamp: Date.now() }]
            : state.undoStack,
        };
      }),
      
      addScore: (examId, scoreData) => set((state) => {
        const exam = exams.find(e => e.id === examId);
        if (!exam) return state;
        
        // Schema validation: Score bounds
        const scoreVal = Number(scoreData.score);
        if (isNaN(scoreVal) || scoreVal < -50 || scoreVal > exam.totalMarks) return state;
        
        // Schema validation: Future dates — use YYYY-MM-DD string comparison
        const todayStr = new Date().toISOString().split('T')[0];
        const scoreDateStr = (scoreData.date || '').split('T')[0];
        if (scoreDateStr > todayStr) return state;
        
        return {
          scores: {
            ...state.scores,
            [examId]: [...(state.scores[examId] || []), scoreData]
          },
          eqLog: appendEq(state.eqLog, { type: 'score_added', timestamp: Date.now(), examId, scoreData })
        };
      }),

      updateScore: (examId, scoreId, scoreData) => set((state) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const scoreDateStr = (scoreData.date || '').split('T')[0];
        if (scoreDateStr > todayStr) return state;

        return {
          scores: {
            ...state.scores,
            [examId]: (state.scores[examId] || []).map(s => s.id === scoreId ? { ...s, ...scoreData } : s)
          }
        };
      }),

      deleteScore: (examId, scoreId) => set((state) => {
        const scoreData = (state.scores[examId] || []).find(s => s.id === scoreId);
        return {
          scores: {
            ...state.scores,
            [examId]: (state.scores[examId] || []).filter(s => s.id !== scoreId)
          },
          undoStack: scoreData
            ? [...state.undoStack.slice(-4), { type: 'delete_score', data: { examId, scoreData }, timestamp: Date.now() }]
            : state.undoStack,
        };
      }),
      
      addFlashcard: (card) => set((state) => ({ flashcards: [...state.flashcards, card] })),
      updateFlashcard: (id, data) => set((state) => {
        const isRating = data.reps !== undefined;
        return {
          flashcards: state.flashcards.map(c => c.id === id ? { ...c, ...data } : c),
          eqLog: isRating ? appendEq(state.eqLog, { type: 'flashcard_rated', timestamp: Date.now(), cardId: id }) : state.eqLog
        };
      }),
      deleteFlashcard: (id) => set((state) => {
        const card = state.flashcards.find(c => c.id === id);
        return {
          flashcards: state.flashcards.filter(c => c.id !== id),
          undoStack: card
            ? [...state.undoStack.slice(-4), { type: 'delete_flashcard', data: card, timestamp: Date.now() }]
            : state.undoStack,
        };
      }),
      
      updateNote: (subject, content) => set((state) => ({
        notes: { ...state.notes, [subject]: content }
      })),
      pinNote: (subject, content) => set((state) => ({
        pinnedNotes: { ...state.pinnedNotes, [subject]: content }
      })),
      unpinNote: (subject) => set((state) => {
        const updated = { ...state.pinnedNotes };
        delete updated[subject];
        return { pinnedNotes: updated };
      }),
      
      addPlannerTask: (date, task) => set((state) => ({
        planner: {
          ...state.planner,
          [date]: [...(state.planner[date] || []), task]
        }
      })),
      togglePlannerTask: (date, taskId) => set((state) => ({
        planner: {
          ...state.planner,
          [date]: (state.planner[date] || []).map(t => t.id === taskId ? { ...t, done: !t.done } : t)
        }
      })),
      deletePlannerTask: (date, taskId) => set((state) => ({
        planner: {
          ...state.planner,
          [date]: (state.planner[date] || []).filter(t => t.id !== taskId)
        }
      })),
      
      addSprint: (sprint) => set((state) => ({ sprints: [...state.sprints, sprint] })),
      addSprintTask: (sprintId, task) => set((state) => ({
        sprints: state.sprints.map(s => s.id === sprintId ? { ...s, tasks: [...s.tasks, task] } : s)
      })),
      toggleSprintTask: (sprintId, taskId) => set((state) => ({
        sprints: state.sprints.map(s => s.id === sprintId ? {
          ...s,
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t)
        } : s)
      })),
      deleteSprint: (sprintId) => set((state) => ({
        sprints: state.sprints.filter(s => s.id !== sprintId)
      })),
      deleteSprintTask: (sprintId, taskId) => set((state) => ({
        sprints: state.sprints.map(s => s.id === sprintId ? {
          ...s,
          tasks: s.tasks.filter(t => t.id !== taskId)
        } : s)
      })),
      
      setMood: (date, mood) => set((state) => ({
        mood: { ...state.mood, [date]: mood },
        eqLog: appendEq(state.eqLog, { type: 'mood_logged', timestamp: Date.now(), date, mood })
      })),
      addWin: (win) => set((state) => ({
        wins: [...state.wins, win],
        eqLog: appendEq(state.eqLog, { type: 'win_logged', timestamp: Date.now(), win })
      })),
      
      updateChapterOverride: (chapterId, data) => set((state) => ({
        settings: {
          ...state.settings,
          chapterOverrides: {
            ...state.settings.chapterOverrides,
            [chapterId]: { ...(state.settings.chapterOverrides[chapterId] ?? {}), ...data }
          }
        }
      })),
      clearChapterOverride: (chapterId) => set((state) => {
        const updated = { ...state.settings.chapterOverrides };
        delete updated[chapterId];
        return { settings: { ...state.settings, chapterOverrides: updated } };
      }),
      
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      updateFormulaProgress: (cardId, data) => set((state) => ({
        formulaProgress: {
          ...state.formulaProgress,
          [cardId]: { ...(state.formulaProgress[cardId] || {}), ...data }
        }
      })),
      
      logEvent: (event) => set((state) => ({ eqLog: appendEq(state.eqLog, event) })),

      setWeeklyReviewLastDate: (date) => set({ weeklyReviewLastDate: date }),
      setOnboardingDismissed: (v) => set({ onboardingDismissed: v }),
      setMissionAcceptedToday: (date) => set({ missionAcceptedToday: date }),
      setConversionDismissedAt: (ts) => set({ conversionDismissedAt: ts }),

      // ─── Data Export / Import ──────────────────────────────────────────
      exportData: () => {
        const state = get();
        return {
          _exportedAt: new Date().toISOString(),
          _version: CURRENT_VERSION,
          sessions: state.sessions,
          chapters: state.chapters,
          scores: state.scores,
          flashcards: state.flashcards,
          notes: state.notes,
          pinnedNotes: state.pinnedNotes,
          formulaProgress: state.formulaProgress,
          planner: state.planner,
          sprints: state.sprints,
          mood: state.mood,
          wins: state.wins,
          eqLog: state.eqLog,
          settings: state.settings,
          weeklyReviewLastDate: state.weeklyReviewLastDate,
        };
      },

      importData: (data) => set((state) => {
        if (!data || typeof data !== 'object') return state;
        return {
          sessions: Array.isArray(data.sessions) ? data.sessions : state.sessions,
          chapters: data.chapters && typeof data.chapters === 'object' ? data.chapters : state.chapters,
          scores: data.scores && typeof data.scores === 'object' ? data.scores : state.scores,
          flashcards: Array.isArray(data.flashcards) ? data.flashcards : state.flashcards,
          notes: data.notes && typeof data.notes === 'object' ? data.notes : state.notes,
          pinnedNotes: data.pinnedNotes && typeof data.pinnedNotes === 'object' ? data.pinnedNotes : state.pinnedNotes,
          formulaProgress: data.formulaProgress && typeof data.formulaProgress === 'object' ? data.formulaProgress : state.formulaProgress,
          planner: data.planner && typeof data.planner === 'object' ? data.planner : state.planner,
          sprints: Array.isArray(data.sprints) ? data.sprints : state.sprints,
          mood: data.mood && typeof data.mood === 'object' ? data.mood : state.mood,
          wins: Array.isArray(data.wins) ? data.wins : state.wins,
          eqLog: Array.isArray(data.eqLog) ? data.eqLog : state.eqLog,
          settings: data.settings && typeof data.settings === 'object'
            ? { ...DEFAULT_SETTINGS, ...data.settings }
            : state.settings,
        };
      }),

      // ─── Reset ─────────────────────────────────────────────────────────
      resetAll: () => set((state) => ({
        // Complete reset — preserve ONLY geminiApiKey and aiProvider
        sessions: [],
        chapters: {},
        scores: {},
        flashcards: [],
        notes: {},
        pinnedNotes: {},
        formulaProgress: {},
        planner: {},
        sprints: [],
        mood: {},
        wins: [],
        eqLog: [],
        undoStack: [],
        weeklyReviewLastDate: null,
        onboardingDismissed: false,
        missionAcceptedToday: null,
        conversionDismissedAt: null,
        settings: {
          ...DEFAULT_SETTINGS,
          geminiApiKey: state.settings.geminiApiKey,
          aiProvider: state.settings.aiProvider,
        },
      })),

      // Selective clear per data type
      clearSessions: () => set({ sessions: [] }),
      clearScores: () => set({ scores: {} }),
      clearChapters: () => set({ chapters: {} }),
      clearFlashcards: () => set({ flashcards: [] }),
      clearPlanner: () => set({ planner: {}, sprints: [] }),
      clearNotes: () => set({ notes: {}, pinnedNotes: {} }),
    }),
    {
      name: 'examhq-storage',
      version: CURRENT_VERSION,
      migrate: (persistedState, version) => {
        let state = { ...persistedState };
        
        // Migration from version 0 or 1 to 2
        if (version < 2) {
          // Flatten chapterOverrides if they were at the root
          if (state.chapterOverrides && (!state.settings || !state.settings.chapterOverrides)) {
            state.settings = state.settings || {};
            state.settings.chapterOverrides = state.chapterOverrides;
            delete state.chapterOverrides;
          }
          if (!state.settings) state.settings = {};
          if (!state.settings.chapterOverrides) state.settings.chapterOverrides = {};
          
          // Add missing settings fields
          if (!state.settings.examDates) {
            state.settings.examDates = DEFAULT_SETTINGS.examDates;
          }
          if (state.settings.sound === undefined) {
            state.settings.sound = false;
          }
          
          // Add missing top-level fields
          if (!state.undoStack) state.undoStack = [];
          if (!state.weeklyReviewLastDate) state.weeklyReviewLastDate = null;
          if (state.onboardingDismissed === undefined) state.onboardingDismissed = false;
          if (!state.missionAcceptedToday) state.missionAcceptedToday = null;
          if (!state.conversionDismissedAt) state.conversionDismissedAt = null;
          if (!state.formulaProgress) state.formulaProgress = {};
        }

        // Orphan cleanup — remove chapter IDs that no longer exist in chapterDefs
        const validChapterIds = new Set(chapterDefs.map(c => c.id));
        
        if (state.chapters) {
          Object.keys(state.chapters).forEach(id => {
            if (!validChapterIds.has(id)) delete state.chapters[id];
          });
        }
        
        if (state.settings && state.settings.chapterOverrides) {
          Object.keys(state.settings.chapterOverrides).forEach(id => {
            if (!validChapterIds.has(id)) delete state.settings.chapterOverrides[id];
          });
        }
        
        return state;
      }
    }
  )
);
