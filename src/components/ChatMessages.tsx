import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "@/types/chat";
import { RefObject } from "react";
import { Bot } from "lucide-react";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  bottomRef: RefObject<HTMLDivElement>;
}

export function ChatMessages({ messages, isLoading, bottomRef }: ChatMessagesProps) {
  // ── Empty state ────────────────────────────────────────────────────────────
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Bot size={32} className="text-accent" />
        </div>
        <h2 className="font-serif text-2xl text-foreground">Ask Amooti anything</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          I can help you with your studies by searching through educational materials and answering your questions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-6 space-y-0">
      {messages.map((msg, i) =>
        msg.role === "user" ? (
          // ── User message — right-aligned pill ───────────────────────────────
          <div key={i} className="flex justify-end px-4 md:px-8 py-2 animate-fade-in">
            <div className="max-w-[75%] md:max-w-[55%] rounded-2xl bg-accent px-4 py-2.5 text-sm leading-relaxed text-accent-foreground shadow-sm">
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          </div>
        ) : (
          // ── Assistant message — full width, written on the page ─────────────
          <div
            key={i}
            className="w-full px-4 md:px-8 py-5 animate-fade-in"
          >
            {/* Subtle top rule to visually open a new "page section" */}
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex-shrink-0 rounded-full bg-accent/15 p-1.5">
                <Bot size={14} className="text-accent" />
              </div>
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Amooti
              </span>
            </div>

            {msg.content === "" ? (
              // Cursor pulse while first tokens arrive
              <div className="flex items-center gap-1 pl-0.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse-dot" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-foreground
                prose-headings:font-serif prose-headings:text-foreground
                prose-p:leading-relaxed prose-p:text-foreground/90
                prose-strong:text-foreground prose-strong:font-semibold
                prose-code:text-accent prose-code:bg-accent/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
                prose-pre:bg-muted prose-pre:border prose-pre:border-border
                prose-blockquote:border-accent prose-blockquote:text-muted-foreground
                prose-ul:text-foreground/90 prose-ol:text-foreground/90
                prose-li:leading-relaxed
                prose-table:text-sm prose-th:text-foreground prose-td:text-foreground/90
                prose-hr:border-border
              ">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeHighlight]}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )
      )}

      {/* Typing dots — shown only while waiting for first token */}
      {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === "user") && (
        <div className="w-full px-4 md:px-8 py-5 animate-fade-in">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex-shrink-0 rounded-full bg-accent/15 p-1.5">
              <Bot size={14} className="text-accent" />
            </div>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Amooti
            </span>
          </div>
          <div className="flex items-center gap-1.5 pl-0.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse-dot" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
