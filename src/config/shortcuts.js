// ─── Shortcuts Config ─────────────────────────────────────────────────────────
// Single source of truth for ALL keyboard shortcuts in ExamHQ.
// Each page imports its own slice. Edit here to change shortcuts app-wide.

export const GLOBAL_SHORTCUTS = [
  { key: 'Cmd+K or /', action: 'Open Command Palette' },
  { key: 'D', action: 'Go to Dashboard' },
  { key: 'T', action: 'Go to Timer' },
  { key: 'C', action: 'Go to Chapters' },
  { key: 'S', action: 'Go to Scores' },
  { key: 'F', action: 'Go to Flashcards' },
  { key: 'N', action: 'Go to Notes' },
  { key: 'I', action: 'Go to Advisor' },
  { key: 'A', action: 'Toggle Ambient Audio' },
  { key: 'P', action: 'Open Panic Mode' },
  { key: 'W', action: 'Log a Win' },
  { key: 'Space', action: 'Play / Pause Timer (when running)' },
  { key: '?', action: 'Show this help' },
];

export const TIMER_SHORTCUTS = [
  { key: 'Space', action: 'Play / Pause' },
  { key: 'Enter', action: 'Start timer' },
  { key: 'Escape', action: 'Exit fullscreen / Focus mode' },
  { key: '1–4', action: 'Switch mode (Pomodoro / Short / Long / Free)' },
  { key: 'M', action: 'Switch subject (cycles Math → Physics → Chemistry)' },
  { key: 'F', action: 'Enter Focus Mode' },
];

export const PLANNER_SHORTCUTS = [
  { key: 'Enter', action: 'Add task (when in task input)' },
  { key: '← →', action: 'Previous / Next day' },
  { key: 'T', action: 'Jump to today' },
  { key: 'Ctrl+Enter', action: 'Add task + stay in input' },
  { key: 'N', action: 'Focus task input' },
];

export const CHAPTERS_SHORTCUTS = [
  { key: '/', action: 'Focus search box' },
  { key: '1–3', action: 'Switch subject (Math / Physics / Chemistry)' },
];

export const FLASHCARD_SHORTCUTS = [
  { key: 'Space', action: 'Flip card' },
  { key: '1', action: 'Rate: Again' },
  { key: '2', action: 'Rate: Hard' },
  { key: '3', action: 'Rate: Good' },
  { key: '4', action: 'Rate: Easy' },
];

export const NOTES_SHORTCUTS = [
  { key: 'Ctrl+S', action: 'Save note' },
  { key: 'Ctrl+B', action: 'Bold selected text' },
  { key: 'Ctrl+P', action: 'Toggle Preview mode' },
  { key: 'Ctrl+/', action: 'Insert LaTeX block' },
];
export const PAGE_SHORTCUTS = {
  GLOBAL: {
    'Open Command Palette': ['k', 'K', '/'],
    'Go to Dashboard': ['d', 'D'],
    'Go to Timer': ['t', 'T'],
    'Go to Chapters': ['c', 'C'],
    'Go to Scores': ['s', 'S'],
    'Go to Flashcards': ['f', 'F'],
    'Go to Notes': ['n', 'N'],
    'Go to Advisor': ['i', 'I'],
    'Toggle Ambient Audio': ['a', 'A'],
    'Open Panic Mode': ['p', 'P'],
    'Log a Win': ['w', 'W'],
    'Show this help': ['?'],
  },
  TIMER: {
    'Play / Pause': [' '],
    'Start timer': ['Enter'],
    'Exit fullscreen / Focus mode': ['Escape'],
    'Enter Focus Mode': ['f', 'F'],
  },
  PLANNER: {
    'Previous day': ['ArrowLeft'],
    'Next day': ['ArrowRight'],
    'Jump to today': ['t', 'T'],
    'Focus task input': ['n', 'N'],
  },
  CHAPTERS: {
    'Focus search box': ['/'],
  },
  FLASHCARDS: {
    'Flip card': [' '],
    'Rate: Again': ['1'],
    'Rate: Hard': ['2'],
    'Rate: Good': ['3'],
    'Rate: Easy': ['4'],
  },
  NOTES: {
    'Save note': ['Cmd+S', 's', 'S'],
    'Bold selected text': ['Cmd+B', 'b', 'B'],
    'Toggle Preview mode': ['Cmd+P', 'p', 'P'],
    'Insert LaTeX block': ['Cmd+/', '/'],
  }
};
