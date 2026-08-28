'use client';

import { useEffect } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { useTheme } from 'next-themes';
import '@blocknote/shadcn/style.css';

interface Props {
  content: string;
  onChange: (jsonString: string) => void;
  editable?: boolean;
}

function tryParseBlocks(content: string): unknown[] | null | undefined {
  if (!content?.trim()) return undefined;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // not JSON
  }
  return null; // null = legacy markdown
}

export function BlockEditor({ content, onChange, editable = true }: Props) {
  const { resolvedTheme } = useTheme();
  const parsed = tryParseBlocks(content);

  const editor = useCreateBlockNote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: (parsed as any) ?? undefined,
  });

  // Convert legacy markdown to blocks on first mount
  useEffect(() => {
    if (parsed !== null || !content?.trim()) return;
    const blocks = editor.tryParseMarkdownToBlocks(content);
    editor.replaceBlocks(editor.document, blocks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return editor.onChange(() => {
      onChange(JSON.stringify(editor.document));
    });
  }, [editor, onChange]);

  return (
    <BlockNoteView
      editor={editor}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      editable={editable}
      className="bn-shadcn"
    />
  );
}

/** Extract plain text from BlockNote JSON string for char counting */
export function blockJsonToText(jsonString: string): string {
  if (!jsonString?.trim()) return '';
  try {
    const blocks = JSON.parse(jsonString);
    if (!Array.isArray(blocks)) return jsonString;
    const texts: string[] = [];
    function extractText(block: { content?: unknown[]; children?: unknown[] }) {
      if (Array.isArray(block.content)) {
        for (const inline of block.content) {
          if (typeof inline === 'object' && inline !== null && 'text' in inline) {
            texts.push((inline as { text: string }).text);
          }
        }
      }
      if (Array.isArray(block.children)) {
        for (const child of block.children) {
          extractText(child as { content?: unknown[]; children?: unknown[] });
        }
      }
    }
    for (const block of blocks) extractText(block);
    return texts.join('');
  } catch {
    return jsonString;
  }
}
