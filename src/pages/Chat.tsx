/**
 * ChatMessages.tsx
 *
 * Drop-in replacement for your existing ChatMessages component.
 *
 * Renders every format a model typically produces:
 *   • Markdown (bold, italic, headers, blockquotes, hr)
 *   • Bullet and numbered lists (nested)
 *   • Tables  (GitHub-flavoured markdown)
 *   • Fenced code blocks with syntax highlighting
 *   • Inline code
 *   • LaTeX math — both display \[...\] / $$...$$ and inline \(...\) / $...$
 *   • Plain URLs auto-linked
 *
 * Dependencies to add to your project:
 *   npm install react-markdown remark-gfm remark-math rehype-katex rehype-highlight
 *   npm install katex highlight.js          # peer deps
 *
 * In your app entry (main.tsx / index.tsx) add:
 *   import 'katex/dist/katex.min.css'
 *   import 'highlight.js/styles/github.css'   ← or any hljs theme you prefer
 */

import { RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Message } from "./Chat"; // adjust path if needed

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  bottomRef: RefObject<HTMLDivElement>;
}

// ─── Markdown config ──────────────────────────────────────────────────────────

const REMARK_PLUGINS = [
  remarkGfm,   // tables, strikethrough, task lists, autolink literals
  remarkMath,  // $$...$$ and $...$ math blocks
];

const REHYPE_PLUGINS = [
  rehypeKatex,      // renders math via KaTeX
  rehypeHighlight,  // syntax highlights fenced code blocks
];

// Custom component overrides so we fully control styling
const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  // ── Headings ──
  h1: ({ children }) => (
    <h1 className="mt-5 mb-2 text-xl font-bold text-foreground leading-snug">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-1.5 text-lg font-semibold text-foreground leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-base font-semibold text-foreground">{children}</h3>
  ),

  // ── Paragraphs ──
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-foreground/90">{children}</p>
  ),

  // ── Lists ──
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-foreground/90">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-foreground/90">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // ── Inline code ──
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-amber-700 dark:text-amber-400"
          {...props}
        >
          {children}
        </code>
      );
    }
    // Block code — rehype-highlight adds the language class, we just style the wrapper
    return (
      <code className={`${className ?? ""} text-sm leading-relaxed`} {...props}>
        {children}
      </code>
    );
  },

  // ── Fenced code block wrapper ──
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 text-sm leading-relaxed">
      {children}
    </pre>
  ),

  // ── Tables (GFM) ──
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="transition-colors hover:bg-muted/30">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-foreground/85">{children}</td>
  ),

  // ── Blockquote ──
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),

  // ── Horizontal rule ──
  hr: () => <hr className="my-4 border-border" />,

  // ── Bold / italic / strikethrough ──
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),
  del: ({ children }) => (
    <del className="text-muted-foreground line-through">{children}</del>
  ),

  // ── Links ──
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
};

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

// ─── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Avatar dot for assistant */}
      {!isUser && (
        <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          A
        </div>
      )}

      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-3 shadow-sm
          ${isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-card border border-border text-foreground"
          }
        `}
      >
        {isUser ? (
          // User messages: plain text, no markdown needed
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          // Assistant messages: full markdown + math rendering
          <div className="prose-sm max-w-none text-sm">
            <ReactMarkdown
              remarkPlugins={REMARK_PLUGINS}
              rehypePlugins={REHYPE_PLUGINS}
              components={MD_COMPONENTS}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
        A
      </div>
      <div>
        <p className="font-semibold text-foreground">Hi, I'm Amooti</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Uganda curriculum study assistant. Ask me anything.
        </p>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ChatMessages({ messages, isLoading, bottomRef }: ChatMessagesProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 md:px-8">
      {messages.length === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                A
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
