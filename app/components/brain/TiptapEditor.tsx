'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  CheckSquare, Minus, Link as LinkIcon,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

// ─── Slash Command Extension ───────────────────────────────────────────────

type SlashRange = { from: number; to: number };

type SlashItem = {
  title: string;
  shortcut?: string;
  group: 'basic';
  icon: React.ReactNode;
  keywords: string[];
  command: (params: { editor: Editor; range: SlashRange }) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Text',
    shortcut: undefined,
    group: 'basic',
    icon: <span className="text-[13px] font-semibold leading-none">T</span>,
    keywords: ['text', 'paragraph', 'p'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Heading 1',
    shortcut: '#',
    group: 'basic',
    icon: <Heading1 className="w-[15px] h-[15px]" />,
    keywords: ['heading', 'h1', 'head', 'title'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    shortcut: '##',
    group: 'basic',
    icon: <Heading2 className="w-[15px] h-[15px]" />,
    keywords: ['heading', 'h2', 'head', 'subtitle'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    shortcut: '###',
    group: 'basic',
    icon: <Heading3 className="w-[15px] h-[15px]" />,
    keywords: ['heading', 'h3', 'head'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bulleted list',
    shortcut: '-',
    group: 'basic',
    icon: <List className="w-[15px] h-[15px]" />,
    keywords: ['bullet', 'list', 'unordered', 'ul', '-'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    shortcut: '1.',
    group: 'basic',
    icon: <ListOrdered className="w-[15px] h-[15px]" />,
    keywords: ['numbered', 'list', 'ordered', 'ol', '1.'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'To-do list',
    shortcut: '[]',
    group: 'basic',
    icon: <CheckSquare className="w-[15px] h-[15px]" />,
    keywords: ['todo', 'checklist', 'task', 'checkbox', '[]'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Quote',
    shortcut: '>',
    group: 'basic',
    icon: <Quote className="w-[15px] h-[15px]" />,
    keywords: ['quote', 'blockquote', '>'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code block',
    shortcut: '```',
    group: 'basic',
    icon: <Code className="w-[15px] h-[15px]" />,
    keywords: ['code', 'codeblock', 'pre', '```'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    shortcut: '---',
    group: 'basic',
    icon: <Minus className="w-[15px] h-[15px]" />,
    keywords: ['divider', 'rule', 'hr', 'line', '---'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

// ─── Slash Command Menu Component ─────────────────────────────────────────

interface SlashMenuProps {
  items: SlashItem[];
  query: string;
  command: (item: SlashItem) => void;
  clientRect: (() => DOMRect | null) | null;
}

function SlashCommandMenu({ items, query, command, clientRect }: SlashMenuProps) {
  const [selected, setSelected] = useState(0);

  useEffect(() => { setSelected(0); }, [items]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, items.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); if (items[selected]) command(items[selected]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, selected, command]);

  const rect = clientRect?.();
  if (!rect) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom + 6,
    left: rect.left,
    zIndex: 9999,
  };

  return createPortal(
    <div
      style={style}
      className="w-[220px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
      ) : (
        <>
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            {query ? 'Filtered results' : 'Basic blocks'}
          </p>
          {items.map((item, i) => (
            <button
              key={item.title}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => { e.preventDefault(); command(item); }}
              onMouseEnter={() => setSelected(i)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors ${
                i === selected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
              }`}
            >
              <span className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground">
                {item.icon}
              </span>
              <span className="text-sm flex-1 truncate">{item.title}</span>
              {item.shortcut && (
                <span className="text-[11px] text-muted-foreground/50 font-mono shrink-0">{item.shortcut}</span>
              )}
            </button>
          ))}
        </>
      )}
    </div>,
    document.body
  );
}


// ─── Markdown conversion helpers ──────────────────────────────────────────
// Convert stored markdown to HTML for Tiptap and back

function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Todo list (- [ ] / - [x])
    .replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">$1</li></ul>')
    .replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false">$1</li></ul>')
    // Bullet list
    .replace(/^[*-] (.+)$/gm, '<ul><li>$1</li></ul>')
    // Numbered list
    .replace(/^\d+\. (.+)$/gm, '<ol><li>$1</li></ol>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap in paragraph if not starting with block element
  if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<pre') && !html.startsWith('<blockquote')) {
    html = '<p>' + html + '</p>';
  }
  return html;
}

function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html
    // Task list items
    .replace(/<li data-type="taskItem" data-checked="true">([\s\S]*?)<\/li>/g, '- [x] $1\n')
    .replace(/<li data-type="taskItem" data-checked="false">([\s\S]*?)<\/li>/g, '- [ ] $1\n')
    .replace(/<ul data-type="taskList">([\s\S]*?)<\/ul>/g, '$1')
    // Code blocks
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1```\n')
    // Headings
    .replace(/<h1>([\s\S]*?)<\/h1>/g, '# $1\n')
    .replace(/<h2>([\s\S]*?)<\/h2>/g, '## $1\n')
    .replace(/<h3>([\s\S]*?)<\/h3>/g, '### $1\n')
    // Blockquote
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '> $1\n')
    // Bold & italic
    .replace(/<strong><em>([\s\S]*?)<\/em><\/strong>/g, '***$1***')
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
    .replace(/<s>([\s\S]*?)<\/s>/g, '~~$1~~')
    .replace(/<u>([\s\S]*?)<\/u>/g, '$1')
    .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)')
    // Lists
    .replace(/<li>([\s\S]*?)<\/li>/g, '- $1\n')
    .replace(/<\/?[uo]l[^>]*>/g, '')
    // HR
    .replace(/<hr\s*\/?>/g, '---\n')
    // Paragraphs
    .replace(/<\/p><p>/g, '\n\n')
    .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Fix entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    // Trim excess newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return md;
}

// ─── Main TiptapEditor Component ──────────────────────────────────────────

interface Props {
  content: string; // markdown
  onChange: (markdown: string) => void;
  editable?: boolean;
}

export function TiptapEditor({ content, onChange, editable = true }: Props) {
  const [slashState, setSlashStateLocal] = useState<{
    items: SlashItem[];
    query: string;
    command: (item: SlashItem) => void;
    clientRect: (() => DOMRect | null) | null;
  } | null>(null);

  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {},
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading…';
          return "Type '/' for commands, or start writing…";
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      Typography,
      Extension.create({
        name: 'slash',
        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              char: '/',
              startOfLine: false,
              allowedPrefixes: null,
              items: ({ query }: { query: string }) => {
                if (!query) return SLASH_ITEMS;
                const q = query.toLowerCase();
                return SLASH_ITEMS.filter((item) =>
                  item.title.toLowerCase().includes(q) ||
                  item.keywords.some((kw) => kw.includes(q))
                );
              },
              command: ({ editor: ed, range, props }) => {
                (props as SlashItem).command({ editor: ed as Editor, range: range as SlashRange });
                setSlashStateLocal(null);
              },
              render: () => ({
                onStart: (p) => {
                  const props = p as { items: SlashItem[]; query: string; command: (item: SlashItem) => void; clientRect: (() => DOMRect | null) | null };
                  setSlashStateLocal({ items: props.items, query: props.query, command: props.command, clientRect: props.clientRect });
                },
                onUpdate: (p) => {
                  const props = p as { items: SlashItem[]; query: string; command: (item: SlashItem) => void; clientRect: (() => DOMRect | null) | null };
                  setSlashStateLocal({ items: props.items, query: props.query, command: props.command, clientRect: props.clientRect });
                },
                onKeyDown: ({ event }: { event: KeyboardEvent }) => {
                  if (['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return true;
                  return false;
                },
                onExit: () => setSlashStateLocal(null),
              }),
            }),
          ];
        },
      }),
    ],
    content: markdownToHtml(content),
    editable,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(htmlToMarkdown(html));
    },
  });

  // Sync content when note changes (navigation between notes)
  const prevId = useRef(content);
  useEffect(() => {
    if (!editor || prevId.current === content) return;
    prevId.current = content;
    editor.commands.setContent(markdownToHtml(content));
  }, [content, editor]);

  // Show/hide bubble toolbar on selection change
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to } = editor.state.selection;
      if (from === to) { setBubblePos(null); return; }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { setBubblePos(null); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0) { setBubblePos(null); return; }
      setBubblePos({
        top: rect.top + window.scrollY - 48,
        left: Math.max(8, rect.left + rect.width / 2 - 180),
      });
    };
    editor.on('selectionUpdate', update);
    editor.on('blur', () => setBubblePos(null));
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('blur', () => setBubblePos(null));
    };
  }, [editor]);

  return (
    <>
      {/* Floating format toolbar — appears on text selection */}
      {editor && bubblePos && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'absolute', top: bubblePos.top, left: bubblePos.left, zIndex: 9999 }}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-card/95 backdrop-blur shadow-xl p-1 pointer-events-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)">
            <Bold className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)">
            <Italic className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)">
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
            <Code className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
            <Heading1 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
            <Heading3 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolbarBtn
            onClick={() => { const url = window.prompt('URL:'); if (url) editor.chain().focus().setLink({ href: url }).run(); }}
            active={editor.isActive('link')} title="Link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
            <Quote className="w-3.5 h-3.5" />
          </ToolbarBtn>
        </div>,
        document.body
      )}

      <EditorContent
        editor={editor}
        className="tiptap-editor flex-1"
      />

      {/* Slash command dropdown */}
      {slashState && (
        <SlashCommandMenu
          items={slashState.items}
          query={slashState.query}
          command={slashState.command}
          clientRect={slashState.clientRect}
        />
      )}
    </>
  );
}

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  );
}
