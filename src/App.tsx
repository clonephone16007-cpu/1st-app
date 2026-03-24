import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { useDailyReset } from './hooks/useDailyReset';
import Layout from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/react';

import Dashboard from './pages/Dashboard';
import Timer from './pages/Timer';
import Chapters from './pages/Chapters';
import Scores from './pages/Scores';
import Weights from './pages/Weights';
import Planner from './pages/Planner';
import Flashcards from './pages/Flashcards';
import Notes from './pages/Notes';
import Advisor from './pages/Advisor';
import Settings from './pages/Settings';

const DARK_THEMES = ['dark', 'dark-minimal', 'ocean', 'forest', 'high-contrast'];

// Fix: previously only checked 'dark' and 'dark-minimal', missing ocean/forest/high-contrast
function isDarkTheme(theme: string) {
  return DARK_THEMES.includes(theme);
}

export default function App() {
  const { settings } = useAppStore();
  
  useDailyReset();

  useEffect(() => {
    const root = document.documentElement;
    if (DARK_THEMES.includes(settings.theme)) {
      root.setAttribute('data-theme', settings.theme);
    } else {
      root.removeAttribute('data-theme');
    }

    if (settings.fontSize === 'small') root.style.fontSize = '14px';
    else if (settings.fontSize === 'large') root.style.fontSize = '18px';
    else root.style.fontSize = '16px';

    if (settings.density === 'compact') root.style.setProperty('--spacing-scale', '0.75');
    else if (settings.density === 'spacious') root.style.setProperty('--spacing-scale', '1.25');
    else root.style.setProperty('--spacing-scale', '1');

    if (settings.motion === 'none') {
      root.style.setProperty('--motion-duration', '0s');
    } else if (settings.motion === 'reduced') {
      root.style.setProperty('--motion-duration', '0.5s');
    } else {
      root.style.setProperty('--motion-duration', '1s');
    }

    // Restore custom accent color if saved
    if (settings.accentColor) {
      root.style.setProperty('--accent', settings.accentColor);
      root.style.setProperty('--accent-tint', settings.accentColor + '22');
    }
  }, [settings.theme, settings.fontSize, settings.density, settings.motion, settings.accentColor]);

  useEffect(() => {
    document.body.className = settings.bgTexture && settings.bgTexture !== 'none' 
      ? `bg-${settings.bgTexture}` 
      : '';
      
    if (settings.font) {
      if (settings.font === 'lora') document.body.style.fontFamily = '"Lora", serif';
      else if (settings.font === 'system') document.body.style.fontFamily = 'system-ui, sans-serif';
      else if (settings.font === 'mono') document.body.style.fontFamily = '"JetBrains Mono", monospace';
      else document.body.style.fontFamily = '"Inter", sans-serif';
    } else {
      document.body.style.fontFamily = '"Inter", sans-serif';
    }
  }, [settings.bgTexture, settings.font]);

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        theme={isDarkTheme(settings.theme) ? 'dark' : 'light'}
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text)',
            border: '1px solid var(--border-light)',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="timer" element={<ErrorBoundary><Timer /></ErrorBoundary>} />
          <Route path="chapters" element={<ErrorBoundary><Chapters /></ErrorBoundary>} />
          <Route path="scores" element={<ErrorBoundary><Scores /></ErrorBoundary>} />
          <Route path="weights" element={<ErrorBoundary><Weights /></ErrorBoundary>} />
          <Route path="planner" element={<ErrorBoundary><Planner /></ErrorBoundary>} />
          <Route path="flashcards" element={<ErrorBoundary><Flashcards /></ErrorBoundary>} />
          <Route path="notes" element={<ErrorBoundary><Notes /></ErrorBoundary>} />
          <Route path="advisor" element={<ErrorBoundary><Advisor /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          </Routes>
    <Analytics />
  </BrowserRouter>
);
}
