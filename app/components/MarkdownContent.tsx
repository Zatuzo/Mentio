'use client';
import ReactMarkdown from 'react-markdown';

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-foreground">{children}</em>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
        li: ({ children }) => <li className="text-foreground">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold text-foreground mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-foreground mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mb-1">{children}</h3>,
        code: ({ children }) => (
          <code className="bg-muted text-emerald-300 text-xs px-1.5 py-0.5 rounded-md font-mono">
            {children}
          </code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
