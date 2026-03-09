import { useState, useEffect } from "react";
import { Download, Copy, Check, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { TeacherDoc } from "@/types/chat";

interface TeacherResponseProps {
  doc: TeacherDoc;
}

export function TeacherResponse({ doc }: TeacherResponseProps) {
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const checkExpiry = () => setExpired(Date.now() >= doc.expiresAt);
    checkExpiry();
    const interval = setInterval(checkExpiry, 30_000);
    return () => clearInterval(interval);
  }, [doc.expiresAt]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-3xl rounded-lg border bg-card p-6 shadow-sm">
      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {expired ? (
          <button
            disabled
            className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground"
          >
            <AlertCircle size={16} />
            Link expired — regenerate document
          </button>
        ) : (
          <button
            onClick={() => window.open(doc.downloadUrl, "_blank")}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Download size={16} />
            Download Word Document
          </button>
        )}

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy text"}
        </button>

        {!expired && (
          <span className="ml-auto text-xs text-muted-foreground">
            Download link expires in{" "}
            {Math.max(0, Math.ceil((doc.expiresAt - Date.now()) / 60_000))} min
          </span>
        )}
      </div>

      {/* Document content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            table: ({ children }) => <div className="my-2">{children}</div>,
            thead: ({ children }) => <>{children}</>,
            tbody: ({ children }) => <>{children}</>,
            tr: ({ children }) => {
              const cells = Array.isArray(children) ? children : [children];
              return <p className="leading-relaxed">{cells}</p>;
            },
            th: ({ children }) => <strong className="mr-2">{children}  •  </strong>,
            td: ({ children }) => <span className="mr-2">{children}  •  </span>,
          }}
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
        >
          {doc.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
