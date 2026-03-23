import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Download, Pin, PinOff, Save, Eye, EyeOff, AlignLeft, HelpCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { NOTES_SHORTCUTS } from '../config/shortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { motion, AnimatePresence } from 'motion/react';

const SUBJECTS = ['General', 'Math', 'Physics', 'Chemistry'];

// ─── Lightweight markdown + KaTeX renderer ───────────────────────────────────
function renderContent(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const html = [];
  let inList = false;

  for (let line of lines) {
    // Headings
    if (line.startsWith('### ')) { if(inList){html.push('</ul>');inList=false;} html.push(`<h3 class="preview-h3">${esc(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## '))  { if(inList){html.push('</ul>');inList=false;} html.push(`<h2 class="preview-h2">${esc(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# '))   { if(inList){html.push('</ul>');inList=false;} html.push(`<h1 class="preview-h1">${esc(line.slice(2))}</h1>`); continue; }
    // Blockquote
    if (line.startsWith('> '))   { if(inList){html.push('</ul>');inList=false;} html.push(`<blockquote class="preview-bq">${inline(line.slice(2))}</blockquote>`); continue; }
    // HR
    if (line.match(/^-{3,}$/))   { if(inList){html.push('</ul>');inList=false;} html.push('<hr class="preview-hr"/>'); continue; }
    // List item
    if (line.match(/^[-*] /)) {
      if (!inList) { html.push('<ul class="preview-ul">'); inList = true; }
      html.push(`<li class="preview-li">${inline(line.slice(2))}</li>`);
      continue;
    }
    // End list
    if (inList && line.trim() !== '') { html.push('</ul>'); inList = false; }
    // Empty line = paragraph break
    if (line.trim() === '') { html.push('<div class="preview-gap"/>'); continue; }
    html.push(`<p class="preview-p">${inline(line)}</p>`);
  }
  if (inList) html.push('</ul>');
  return html.join('');
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function inline(text) {
  // Block math $$...$$ first
  text = text.replace(/\$\$(.+?)\$\$/g, (_,m) => `<span class="math-block" data-math="${encodeURIComponent(m)}"></span>`);
  // Inline math $...$
  text = text.replace(/\$(.+?)\$/g, (_,m) => `<span class="math-inline" data-math="${encodeURIComponent(m)}"></span>`);
  // Bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Code `text`
  text = text.replace(/`(.+?)`/g, '<code class="preview-code">$1</code>');
  return text;
}

function PreviewPane({ content }) {
  const ref = useRef(null);
  const html = renderContent(content);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = html;
    // Render math spans using KaTeX if available
    const mathSpans = ref.current.querySelectorAll('.math-inline, .math-block');
    mathSpans.forEach(span => {
      const src = decodeURIComponent(span.dataset.math || '');
      const isBlock = span.classList.contains('math-block');
      try {
        if (window.katex) {
          span.innerHTML = window.katex.renderToString(src, { displayMode: isBlock, throwOnError: false });
        } else {
          span.innerHTML = isBlock ? `<code>$$${src}$$</code>` : `<code>$${src}$</code>`;
        }
      } catch { span.textContent = src; }
    });
  }, [html]);

  return <div ref={ref} className="preview-root prose-sm max-w-none px-1"/>;
}

export default function Notes() {
  const { notes, updateNote, pinnedNotes, pinNote, unpinNote } = useAppStore();
  const [subject, setSubject] = useState('General');
  const [content, setContent] = useState(notes['General'] || '');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [previewMode, setPreviewMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useKeyboardShortcuts('GLOBAL', {
    'Show this help': () => setShowShortcuts(s => !s),
  });

  // Load KaTeX from CDN once
  useEffect(() => {
    if (window.katex) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    document.head.appendChild(script);
  }, []);

  useEffect(() => { setContent(notes[subject] || ''); setSaveStatus('saved'); }, [subject, notes]);

  const handleSave = useCallback(() => {
    setSaveStatus('saving');
    updateNote(subject, content);
    setTimeout(() => setSaveStatus('saved'), 400);
  }, [subject, content, updateNote]);

  useEffect(() => {
    if (saveStatus === 'dirty') {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(handleSave, 1500);
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [content, saveStatus, handleSave]);

  const handleChange = (e) => { setContent(e.target.value); if (saveStatus !== 'dirty') setSaveStatus('dirty'); };

  const insertText = (text) => {
    const ta = textareaRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const nc = content.slice(0,s) + text + content.slice(e);
    setContent(nc); setSaveStatus('dirty');
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s+text.length, s+text.length); }, 0);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); handleSave(); }
    if ((e.ctrlKey||e.metaKey) && e.key==='p') { e.preventDefault(); setPreviewMode(p=>!p); }
    if ((e.ctrlKey||e.metaKey) && e.key==='/') { e.preventDefault(); insertText('\n$$\n\n$$\n'); }
    if ((e.ctrlKey||e.metaKey) && e.key==='b') {
      e.preventDefault();
      const ta = textareaRef.current; if(!ta) return;
      const s=ta.selectionStart,end=ta.selectionEnd;
      if(s!==end){ const sel=content.slice(s,end); const nc=content.slice(0,s)+`**${sel}**`+content.slice(end); setContent(nc); setSaveStatus('dirty'); }
      else insertText('**bold**');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${subject.toLowerCase()}-notes.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const isPinned = !!pinnedNotes[subject];
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  // Auto table of contents from ## headings
  const toc = content.split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3).trim());

  return (
    <div className="max-w-4xl mx-auto pb-8 space-y-4">
      {/* KaTeX styles */}
      <style>{`
        .preview-root { color: var(--text); line-height: 1.7; }
        .preview-h1 { font-size:1.5rem; font-weight:700; margin:1.2rem 0 0.5rem; color:var(--text); border-bottom:1px solid var(--border-light); padding-bottom:0.3rem; }
        .preview-h2 { font-size:1.2rem; font-weight:700; margin:1rem 0 0.4rem; color:var(--text); }
        .preview-h3 { font-size:1rem; font-weight:600; margin:0.8rem 0 0.3rem; color:var(--text-secondary); }
        .preview-p  { margin:0.3rem 0; font-size:0.875rem; }
        .preview-bq { border-left:3px solid var(--accent); padding-left:0.8rem; margin:0.5rem 0; color:var(--text-secondary); font-style:italic; }
        .preview-hr { border:none; border-top:1px solid var(--border-medium); margin:1rem 0; }
        .preview-ul { list-style:disc; padding-left:1.2rem; margin:0.3rem 0; }
        .preview-li { font-size:0.875rem; margin:0.2rem 0; }
        .preview-gap { height:0.5rem; }
        .preview-code { background:var(--bg-sidebar); border:1px solid var(--border-light); border-radius:3px; padding:0 3px; font-size:0.8rem; font-family:monospace; }
        strong { font-weight:700; }
        em { font-style:italic; }
        .math-block { display:block; text-align:center; margin:0.5rem 0; overflow-x:auto; }
        .math-inline { display:inline; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--text)' }}>Notes</h1>
          <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>Supports **bold**, *italic*, # headings, $LaTeX$, $$block math$$</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
            <HelpCircle size={16} />
          </button>
          <button onClick={() => setPreviewMode(p=>!p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: previewMode ? 'var(--accent)' : 'var(--bg-sidebar)', color: previewMode ? 'var(--bg-card)' : 'var(--text-secondary)', border:'1px solid var(--border-light)' }}>
            {previewMode ? <EyeOff size={13}/> : <Eye size={13}/>} {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Shortcuts popover */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="rounded-xl p-4 z-50 relative" style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', boxShadow:'var(--shadow-md)' }}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>Notes Shortcuts</p>
              <button onClick={() => setShowShortcuts(false)}><X size={14} style={{ color:'var(--text-muted)' }}/></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NOTES_SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-[11px]">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[9px]" style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)' }}>{s.key}</kbd>
                  <span style={{ color:'var(--text-muted)' }}>{s.action}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject tabs */}
      <div className="flex gap-1 bg-[var(--bg-sidebar)] p-1 rounded-lg border border-[var(--border-light)]">
        {SUBJECTS.map(s => (
          <button key={s} onClick={() => setSubject(s)}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${subject===s ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table of contents (when in preview and has headings) */}
      {previewMode && toc.length > 2 && (
        <div className="rounded-xl px-4 py-3" style={{ background:'var(--accent-tint)', border:'1px solid var(--border-light)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:'var(--accent)' }}>Contents</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {toc.map((h,i) => <span key={i} className="text-xs" style={{ color:'var(--text-secondary)' }}>{i+1}. {h}</span>)}
          </div>
        </div>
      )}

      {/* Editor / Preview */}
      <div className="rounded-[14px] overflow-hidden" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', boxShadow:'var(--shadow-sm)' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ borderColor:'var(--border-light)' }}>
          {[['**','Bold'],['*','Italic'],['`','Code'],['## ','H2'],['> ','Quote']].map(([t,l]) => (
            <button key={t} onClick={() => insertText(t)} className="px-2 py-1 text-xs rounded hover:bg-[var(--bg-sidebar)] font-mono transition-colors"
              style={{ color:'var(--text-secondary)' }} title={l}>{t.trim()||l}</button>
          ))}
          <button onClick={() => insertText('$formula$')} className="px-2 py-1 text-xs rounded hover:bg-[var(--bg-sidebar)] transition-colors font-mono"
            style={{ color:'var(--accent)' }}>$math$</button>
          <button onClick={() => insertText('\n$$\n\n$$\n')} className="px-2 py-1 text-xs rounded hover:bg-[var(--bg-sidebar)] transition-colors font-mono"
            style={{ color:'var(--accent)' }}>$$block$$</button>
          <div className="flex-1"/>
          <div className="flex items-center gap-2">
            <button onClick={() => isPinned ? unpinNote(subject) : pinNote(subject, content)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--bg-sidebar)] transition-colors"
              style={{ color: isPinned ? 'var(--accent)' : 'var(--text-muted)' }}>
              {isPinned ? <Pin size={11}/> : <PinOff size={11}/>}
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--bg-sidebar)] transition-colors"
              style={{ color:'var(--text-muted)' }}><Download size={11}/></button>
            <button onClick={handleSave} className="flex items-center gap-1 px-2 py-1 text-xs rounded font-semibold transition-all"
              style={{ color: saveStatus==='saved' ? 'var(--text-muted)' : saveStatus==='saving' ? '#f59e0b' : 'var(--accent)' }}>
              <Save size={11}/> {saveStatus==='saved'?'Saved':saveStatus==='saving'?'Saving...':'Save'}
            </button>
          </div>
        </div>

        {previewMode ? (
          <div className="px-5 py-4 min-h-[400px]"><PreviewPane content={content}/></div>
        ) : (
          <textarea ref={textareaRef} value={content} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder="Start typing... Use # for headings, **bold**, *italic*, $formula$ for LaTeX, $$block$$ for display math"
            className="w-full resize-none p-4 min-h-[400px] text-sm font-mono leading-relaxed focus:outline-none"
            style={{ background:'transparent', color:'var(--text)', caretColor:'var(--accent)' }}
            spellCheck={false}/>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center px-4 py-2 text-xs border-t" style={{ borderColor:'var(--border-light)', color:'var(--text-muted)' }}>
          <span>{wordCount} words · {charCount} chars</span>
          <span>Ctrl+P: Preview · Ctrl+/: LaTeX block · Ctrl+S: Save</span>
        </div>
      </div>
    </div>
  );
}
