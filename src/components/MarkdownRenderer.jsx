// ─── Minimal Markdown Renderer ────────────────────────────────────────────────
// Renders **bold**, *italic*, - bullets, numbered lists, and line breaks.
// No external library needed. Used for all AI response displays.

import React from 'react';

function parseLine(text) {
  if (!text) return text;
  const parts = [];
  let remaining = text;
  let key = 0;

  // Process bold (**text**) and italic (*text*) inline
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(remaining)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // Bold
      parts.push(<strong key={key++} style={{ fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[3]) {
      // Italic
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export default function MarkdownRenderer({ text, className = '' }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null; // 'ul' | 'ol'
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    if (listType === 'ol') {
      elements.push(
        <ol key={key++} className="list-decimal pl-5 space-y-1 my-1.5">
          {listItems.map((item, i) => <li key={i} className="text-inherit leading-relaxed">{parseLine(item)}</li>)}
        </ol>
      );
    } else {
      elements.push(
        <ul key={key++} className="list-disc pl-5 space-y-1 my-1.5">
          {listItems.map((item, i) => <li key={i} className="text-inherit leading-relaxed">{parseLine(item)}</li>)}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Empty line → flush list, add spacer
    if (!line) {
      flushList();
      elements.push(<br key={key++} />);
      continue;
    }

    // Unordered list: - item or • item
    const ulMatch = line.match(/^[-•]\s+(.+)/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list: 1. item, 2. item, etc.
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    // Not a list item → flush any pending list
    flushList();

    // Regular paragraph
    elements.push(
      <p key={key++} className="my-1 leading-relaxed">{parseLine(line)}</p>
    );
  }

  flushList();

  return <div className={`markdown-rendered ${className}`}>{elements}</div>;
}
