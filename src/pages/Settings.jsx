import { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exams as defaultExams } from '../data/exams';
import { Download, Upload, Trash2, Copy, Check, Moon, Sun, Bell, Smartphone, FileJson, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { AI_PROVIDER_OPTIONS } from '../services/aiService';
import { useAI } from '../hooks/useAI';
import { useEngineContext } from '../hooks/useEngineContext';

const SECTION = ({ title, children, id }) => (
  <section id={id} className="space-y-4 pt-4 scroll-mt-8">
    <h2 className="text-lg font-bold font-serif pb-3" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border-light)' }}>
      {title}
    </h2>
    {children}
  </section>
);

const TOGGLE = ({ icon: Icon, iconColor, label, description, checked, onChange }) => (
  <label className="flex items-center justify-between p-4 rounded-[14px] cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
  >
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${iconColor}15` }}>
        <Icon size={16} style={{ color: iconColor }} />
      </span>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
    </div>
    <div
      className="relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      style={{ background: checked ? 'var(--accent)' : 'var(--border-medium)' }}
    >
      <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
    </div>
  </label>
);

const SELECT = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</label>
    <select value={value} onChange={onChange}
      className="w-full px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text)' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export default function Settings() {
  const { settings, updateSettings, sessions, eqLog, resetAll } = useAppStore();
  const { tuneSetting } = useAI();
  const ec = useEngineContext();
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const fileInputRef = useRef(null);
  const patchInputRef = useRef(null);

  const activeExamsList = settings.activeExams || [];
  const examDates = settings.examDates || {};

  const themes = [
    { id: 'warm',          name: 'Warm Scholar', color: '#F5F0E8' },
    { id: 'dark',          name: 'Dark Scholar', color: '#1A1814' },
    { id: 'dark-minimal',  name: 'Dark Minimal', color: '#111111' },
    { id: 'ocean',         name: 'Ocean',        color: '#EFF6FF' },
    { id: 'forest',        name: 'Forest',       color: '#EEF7EE' },
    { id: 'high-contrast', name: 'High Contrast',color: '#FFFFFF' },
  ];

  const accentColors = [
    '#7C3A10','#C4895A','#D4870A','#2471A3','#7D3C98','#1F7A1F',
    '#C0392B','#1A6FCC','#5B2C6F','#117A65','#784212','#1B2631',
  ];

  const handleThemeChange = (id) => {
    updateSettings({ theme: id });
    const root = document.documentElement;
    id === 'warm' ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', id);
  };

  const handleAccentColor = (color) => {
    updateSettings({ accentColor: color });
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-tint', color + '18');
  };

  const handleTextureChange = (texture) => {
    updateSettings({ bgTexture: texture });
    document.body.className = texture !== 'none' ? `bg-${texture}` : '';
  };

  const handleExamToggle = (examId) => {
    const current = settings.activeExams || [];
    updateSettings({ activeExams: current.includes(examId) ? current.filter(id => id !== examId) : [...current, examId] });
  };

  const handleExamDateChange = (examId, dateString) => {
    updateSettings({ examDates: { ...settings.examDates, [examId]: dateString } });
  };

  const handleNotificationsToggle = async () => {
    if (!settings.notifications) {
      if (!('Notification' in window)) { toast.error('Browser does not support notifications.'); return; }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') { updateSettings({ notifications: true }); toast.success('Notifications enabled'); }
      else toast.error('Permission denied by browser.');
    } else {
      updateSettings({ notifications: false });
    }
  };

  const handleExportData = () => {
    const data = JSON.stringify(useAppStore.getState());
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([data], { type: 'application/json' })),
      download: `examhq-backup-${new Date().toISOString().split('T')[0]}.json`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('Full study data exported safely!');
  };

  const handleImportData = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        useAppStore.getState().importData(parsed);
        toast.success('Data imported successfully!');
        setTimeout(() => window.location.reload(), 1000);
      }
      catch { toast.error('Invalid backup file. Import failed.'); }
    };
    reader.readAsText(file);
  };

  const handleSelectiveClear = (type) => {
    if (window.confirm(`Are you sure you want to delete all ${type}? This cannot be undone.`)) {
      if (type === 'sessions') useAppStore.getState().clearSessions();
      if (type === 'flashcards') useAppStore.getState().clearFlashcards();
      if (type === 'scores') useAppStore.getState().clearScores();
      toast.success(`All ${type} have been deleted.`);
    }
  };

  const handleResetData = () => {
    if (window.confirm('WARNING: You are about to wipe ALL ExamHQ data from this device. Are you sure?')) {
      if (window.confirm('FINAL CONFIRMATION: This action is permanent and cannot be undone. Did you export a backup?')) {
        resetAll(); 
        toast.success('App reset to factory defaults.'); 
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  };

  const handleExportLog = () => {
    const logData = useAppStore.getState().eqLog || [];
    const data = JSON.stringify(logData);
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([data], { type: 'application/json' })),
      download: `examhq-event-log-${new Date().toISOString().split('T')[0]}.json`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('Event Log exported for AI tuning.');
  };

  const handleImportPatch = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const patch = JSON.parse(ev.target.result);
        if (window.confirm(`Apply AI configuration patch?\n\nHighlights:\nTarget Hours: ${patch.dailyTargetHours || 'unchanged'}\nGhost AIR: ${patch.ghostAIR || 'unchanged'}`)) {
          updateSettings(patch); 
          toast.success('Settings patched successfully!');
        }
      } catch { toast.error('Invalid patch file format.'); }
    };
    reader.readAsText(file);
  };

  const copyPrompt = () => {
    const prompt = "You are ExamHQ's internal algorithm tuner. Analyze the attached user study log JSON and return ONLY a valid JSON patch object modifying the user's settings. Look for: peak focus times, abandoned subjects, realistic daily study limits based on session history, and whether mood correlates with session duration. Structure response as pure JSON without Markdown. Return only the JSON.";
    navigator.clipboard.writeText(prompt);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success('Tuning prompt copied to clipboard!');
  };

  // ── Verify API Key ─────────────────────────────────────────────────────────
  // Uses the updated testApiKey which returns { ok, message } — never a plain boolean
  const handleVerifyKey = async () => {
    if (!settings.geminiApiKey?.trim()) {
      toast.error('Enter your API key first.');
      return;
    }
    setVerifying(true);
    try {
      const { testApiKey } = await import('../services/aiService');
      const result = await testApiKey(settings.geminiApiKey, settings.aiProvider || 'gemini');
      if (result?.ok) {
        toast.success(result.message || 'API key verified. AI features are active.');
      } else {
        toast.error(result?.message || 'Verification failed. Check your key and try again.');
      }
    } catch (e) {
      toast.error('Unexpected error during verification. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const getStorageUsage = () => {
    try {
      let total = 0;
      for (let x in localStorage) { if (localStorage.hasOwnProperty(x)) total += ((localStorage[x]?.length || 0) + x.length) * 2; }
      return (total / 1024).toFixed(1);
    } catch { return '0.0'; }
  };

  const sections = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'exams', label: 'Exams' },
    { id: 'study-goals', label: 'Study Goals' },
    { id: 'ai-config', label: 'AI Configuration' },
    { id: 'data', label: 'Data Management' },
    { id: 'danger', label: 'Danger Zone' }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto pb-12 items-start relative">
      
      {/* Sticky Sidebar Navigation (Desktop) */}
      <nav className="hidden md:flex flex-col gap-2 w-48 shrink-0 sticky top-8">
        <h1 className="text-3xl font-bold font-serif mb-6" style={{ color: 'var(--text)' }}>Settings</h1>
        {sections.map(s => (
          <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
            className="text-left px-3 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}>
            {s.label}
          </button>
        ))}
      </nav>

      {/* Main Settings Content */}
      <div className="flex-1 space-y-12">
        <div className="md:hidden">
          <h1 className="text-3xl font-bold font-serif" style={{ color: 'var(--text)' }}>Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Customize your workspace.</p>
        </div>

        {/* Appearance */}
        <SECTION id="appearance" title="Appearance">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Theme</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {themes.map(theme => (
                <button key={theme.id} onClick={() => handleThemeChange(theme.id)}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  style={{
                    background: settings.theme === theme.id ? 'var(--accent-tint)' : 'var(--bg-card)',
                    border: settings.theme === theme.id ? '1.5px solid var(--accent)' : '1px solid var(--border-medium)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                  <div className="w-5 h-5 rounded-full shrink-0" style={{ background: theme.color, border: '1.5px solid var(--border-medium)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Accent Color</label>
            <div className="flex flex-wrap gap-2">
              {accentColors.map(color => (
                <button key={color} onClick={() => handleAccentColor(color)}
                  className="w-8 h-8 rounded-full transition-all hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[currentColor]"
                  style={{
                    background: color,
                    outline: settings.accentColor === color ? `3px solid ${color}` : '2px solid transparent',
                    outlineOffset: '2px',
                  }} aria-label={`Select accent color ${color}`} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Background Texture</label>
            <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)' }}>
              {['none', 'grain', 'dots', 'lines'].map(t => (
                <button key={t} onClick={() => handleTextureChange(t)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  style={{
                    background: (settings.bgTexture || 'none') === t ? 'var(--accent)' : 'transparent',
                    color: (settings.bgTexture || 'none') === t ? 'var(--bg-card)' : 'var(--text-secondary)',
                  }}>
                  {t === 'none' ? 'Plain' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SELECT label="Typography Font" value={settings.font || 'inter'}
              onChange={e => updateSettings({ font: e.target.value })}
              options={[{ value: 'inter', label: 'Inter (Sans)' }, { value: 'lora', label: 'Lora (Serif)' }, { value: 'system', label: 'System UI' }]} />
            <SELECT label="Animation Motion" value={settings.motion || 'normal'}
              onChange={e => updateSettings({ motion: e.target.value })}
              options={[{ value: 'normal', label: 'Normal Transitions' }, { value: 'reduced', label: 'Reduced Motion' }, { value: 'none', label: 'No Animations' }]} />
          </div>
        </SECTION>

        {/* Exams */}
        <SECTION id="exams" title="Active Exams & Targets">
          <div className="space-y-3">
            {defaultExams.map(exam => {
              const isActive = activeExamsList.includes(exam.id);
              return (
                <div key={exam.id}
                  className="p-4 rounded-[14px] transition-all duration-150"
                  style={{
                    background: 'var(--bg-card)',
                    border: isActive ? `1.5px solid ${exam.color}` : '1px solid var(--border-light)',
                    opacity: isActive ? 1 : 0.65,
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                  }}>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={isActive} onChange={() => handleExamToggle(exam.id)}
                        className="w-5 h-5 cursor-pointer rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]" 
                        style={{ accentColor: 'var(--accent)' }} />
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{exam.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{exam.id.toUpperCase()} Examination</p>
                      </div>
                    </div>
                    
                    {isActive && (
                      <div className="flex flex-wrap items-center gap-4 mt-2 sm:mt-0">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Exam Date</label>
                          <input type="date" value={examDates[exam.id] || exam.date}
                            onChange={e => handleExamDateChange(exam.id, e.target.value)}
                            className="px-2 py-1 rounded-lg text-sm focus:outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text)' }} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Target AIR</label>
                          <input type="number" value={settings.targetAIR?.[exam.id] || ''}
                            onChange={e => updateSettings({ targetAIR: { ...settings.targetAIR, [exam.id]: parseInt(e.target.value) || 0 } })}
                            className="w-24 px-2 py-1 rounded-lg text-sm text-right focus:outline-none font-mono tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text)' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SECTION>

        {/* Study Goals */}
        <SECTION id="study-goals" title="Study Environment & Goals">
          <div className="rounded-[14px] p-6 transition-all duration-150 hover:-translate-y-0.5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Daily Focused Target</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Optimum hours of uninterrupted learning</p>
              </div>
              <span className="font-mono text-3xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--accent)' }}>{settings.dailyTargetHours || 8}<span className="text-base text-[var(--text-muted)] font-normal">h</span></span>
            </div>
            <input type="range" min="2" max="16" step="0.5" value={settings.dailyTargetHours || 8}
              onChange={e => updateSettings({ dailyTargetHours: parseFloat(e.target.value) })}
              className="w-full cursor-pointer transition-all" style={{ accentColor: 'var(--accent)' }} />
            <div className="flex justify-between text-xs font-semibold mt-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <span>2h Minimum</span><span>16h Extreme</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TOGGLE icon={Moon} iconColor="rgb(99,102,241)" label="Night Shift" description="Warm light mode after 9 PM"
              checked={settings.nightShift || false} onChange={e => updateSettings({ nightShift: e.target.checked })} />
            <TOGGLE icon={Sun} iconColor="rgb(245,158,11)" label="Keep Display Awake" description="Prevents sleep during Timer"
              checked={settings.keepAwake || false} onChange={e => updateSettings({ keepAwake: e.target.checked })} />
            <TOGGLE icon={Smartphone} iconColor="rgb(34,197,94)" label="Haptic Feedback" description="Vibrate on alerts (Mobile only)"
              checked={settings.haptic ?? true} onChange={e => updateSettings({ haptic: e.target.checked })} />
            <TOGGLE icon={Bell} iconColor="rgb(59,130,246)" label="Browser Notifications" description="Push alerts when timer ends"
              checked={settings.notifications || false} onChange={handleNotificationsToggle} />
          </div>
        </SECTION>

        {/* AI Configuration */}
        <SECTION id="ai-config" title="AI Configuration">
          <div className="rounded-[14px] p-6 space-y-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>API Gateway Configuration</p>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Power intelligent features securely. Your key never leaves your browser device. Leave empty to disable all AI overlays.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <select value={settings.aiProvider || 'gemini'} onChange={e => updateSettings({ aiProvider: e.target.value })}
                  className="px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text)' }}>
                  {AI_PROVIDER_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="relative flex-1">
                  <input type="password" value={settings.geminiApiKey || ''}
                    onChange={e => updateSettings({ geminiApiKey: e.target.value })}
                    placeholder={settings.aiProvider === "openai" ? "sk-proj-..." : settings.aiProvider === "sarvam" ? "sarvam-..." : "AIza..."}  
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-mono focus:outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text)' }}/>
                </div>
                {/* ── Fixed Verify button: uses {ok, message} from testApiKey ── */}
                <button
                  onClick={handleVerifyKey}
                  disabled={verifying}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 shadow-sm active:translate-y-0 disabled:opacity-60 disabled:cursor-wait"
                  style={{ background: 'var(--text)', color: 'var(--bg-card)' }}>
                  {verifying ? 'Verifying…' : 'Verify Setup'}
                </button>
              </div>
              {settings.geminiApiKey && <p className="text-xs font-semibold mt-3" style={{ color: '#22c55e' }}>✨ Machine Intelligence Active: Advisor, Planner & Tutors are online.</p>}
            </div>
            
            <hr style={{ borderColor: 'var(--border-light)' }}/>
            
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Algorithmic Meta-Tuning</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
                Export your rich event log to feed raw telemetry into external models, or automatically optimize your parameters if an API key is attached.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <button onClick={handleExportLog}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
                  <FileJson size={16} /> Export Raw eqLog
                </button>
                {settings.geminiApiKey && (
                  <button onClick={async () => {
                    toast.info('Tuning engine running. This may take a moment.');
                    const last30 = (sessions || []).slice(-30).map(s => ({ mins: Math.round(s.duration / 60), subject: s.subject, date: s.date }));
                    const now = new Date();
                    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
                    const recentSessions = (sessions || []).filter(s => new Date(s.date) >= fourteenDaysAgo);
                    const avgActualHoursLast14Days = (recentSessions.reduce((sum, s) => sum + s.duration, 0) / 3600) / 14;
                    
                    const ctx = {
                      last30Sessions: last30,
                      currentDailyTargetHours: settings.dailyTargetHours || 8,
                      avgActualHoursLast14Days: Number(avgActualHoursLast14Days.toFixed(1)),
                      studyDebtHours: ec.studyDebt || 0,
                      streakDays: ec.streakDays || 0,
                      burnoutStateLabel: ec.burnoutState?.label || 'Normal'
                    };
                    const res = await tuneSetting(ctx);
                    try {
                      const patchStr = res?.replace(/```json|```|`/g,'').trim();
                      const patch = JSON.parse(patchStr || '{}');
                      if (Object.keys(patch).length && typeof patch.dailyTargetHours === 'number') { 
                        updateSettings(patch); 
                        toast.success('Matrix Optimized: Parameters updated.'); 
                      } else { toast.error('Optimizer reached steady state.') }
                    } catch { toast.error('Engine error intercepting response.'); }
                  }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: 'var(--accent)', color: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                    <Sparkles size={16} /> Auto-Optimize Matrix
                  </button>
                )}
                <input ref={patchInputRef} type="file" accept=".json" onChange={handleImportPatch} style={{ display: "none" }} />
                <button onClick={() => patchInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--text)', color: 'var(--bg-card)' }}>
                  <Upload size={16} /> Load Patch.json
                </button>
              </div>
            </div>
          </div>
        </SECTION>

        {/* Data Management */}
        <SECTION id="data" title="Data Portability">
          <div className="rounded-[14px] p-6 space-y-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between text-sm py-2">
              <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>Current State Blob Size</span>
              <span className="font-mono font-bold px-3 py-1 rounded-md text-xs tabular-nums" style={{ background: 'var(--bg-sidebar)', color: 'var(--text)' }}>{getStorageUsage()} KB</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={handleExportData}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--accent)', color: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <Download size={18} strokeWidth={2.5} /> Download Local Backup
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportData} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', color: 'var(--text)' }}>
                <Upload size={18} strokeWidth={2.5} /> Restore From Backup
              </button>
            </div>
          </div>
        </SECTION>

        {/* Danger Zone */}
        <SECTION id="danger" title="Danger Zone">
          <div className="rounded-[14px] overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="px-6 py-4" style={{ background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'rgb(220,38,38)' }}>Destructive Actions</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Once deleted, data cannot be recovered without a local JSON backup.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Clear Historical Sessions</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Removes all timer records. Decreases Grind Index.</p>
                </div>
                <button onClick={() => handleSelectiveClear('sessions')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
                  style={{ color: 'rgb(220,38,38)', border: '1px solid rgba(239,68,68,0.3)' }}>Clear Sessions</button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Clear Flashcards</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Removes all custom generated flashcards.</p>
                </div>
                <button onClick={() => handleSelectiveClear('flashcards')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
                  style={{ color: 'rgb(220,38,38)', border: '1px solid rgba(239,68,68,0.3)' }}>Clear Cards</button>
              </div>
              
              <div className="pt-4 mt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Factory Reset</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Wipes entire browser LocalStorage partition.</p>
                  </div>
                  <button onClick={handleResetData}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                    style={{ background: 'rgb(220,38,38)', color: 'white', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>
                    <Trash2 size={16} /> Factory Reset App
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SECTION>
      </div>
    </div>
  );
}
