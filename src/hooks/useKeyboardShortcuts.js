import { useEffect } from 'react';
import { PAGE_SHORTCUTS } from '../config/shortcuts';

export function useKeyboardShortcuts(pageKey, handlers) {
  useEffect(() => {
    const config = PAGE_SHORTCUTS[pageKey];
    if (!config || !handlers) return;

    const handleKeyDown = (e) => {
      // Don't trigger inside inputs or textareas
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const keyCombo = (e.ctrlKey || e.metaKey ? 'Cmd+' : '') + 
                       (e.shiftKey ? 'Shift+' : '') + 
                       (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      const exactKey = e.key;

      let actionName = null;
      for (const [action, keys] of Object.entries(config)) {
        if (Array.isArray(keys)) {
          if (keys.includes(exactKey) || keys.includes(keyCombo) || keys.includes(exactKey.toLowerCase())) {
            actionName = action;
          }
        } else if (keys === exactKey || keys === keyCombo || keys === exactKey.toLowerCase()) {
          actionName = action;
        }
      }

      if (actionName && handlers[actionName]) {
        e.preventDefault();
        handlers[actionName]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageKey, handlers]);
}
