import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "@/types/chat";
import { RefObject } from "react";
import { Bot, User } from "lucide-react";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  bottomRef: RefObject<HTMLDivElement>;
}

export function ChatMessages({ messages, isLoading, bottomRef }: ChatMessagesProps) {
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
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
        >
          {msg.role === "assistant" && (
            <div className="mt-1 flex-shrink-0 rounded-full bg-accent/20 p-1.5">
              <Bot size={16} className="text-accent" />
            </div>
          )}

          <div
            className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"
            }`}
          >
            {msg.role === "assistant" ? (
              msg.content === "" ? (
                // Empty assistant bubble while first tokens arrive — show cursor
                <span className="inline-block w-2 h-4 bg-current opacity-70 animate-pulse" />
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeHighlight]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )
            ) : (
              <span className="whitespace-pre-wrap">{msg.content}</span>
            )}
          </div>

          {msg.role === "user" && (
            <div className="mt-1 flex-shrink-0 rounded-full bg-primary/20 p-1.5">
              <User size={16} className="text-primary" />
            </div>
          )}
        </div>
      ))}

      {/* Typing dots — only while loading AND no assistant bubble yet */}
      {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === "user") && (
        <div className="flex gap-3 justify-start animate-fade-in">
          <div className="mt-1 flex-shrink-0 rounded-full bg-accent/20 p-1.5">
            <Bot size={16} className="text-accent" />
          </div>
          <div className="chat-bubble-assistant rounded-2xl px-4 py-3 flex gap-1 items-center">
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-dot" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
