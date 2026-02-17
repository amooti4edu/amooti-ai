import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessages } from "@/components/ChatMessages";
import { ChatInput } from "@/components/ChatInput";
import { ChatSidebar } from "@/components/ChatSidebar";
import type { Message } from "@/types/chat";

import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

// The Supabase project URL — used for direct fetch streaming
const SUPABASE_URL = "https://ehswpksboxyzqztdhofh.supabase.co";

export default function Chat() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    if (!loading && !session) navigate("/");
  }, [session, loading, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load conversations
  useEffect(() => {
    if (!session) return;
    supabase
      .from("conversations")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setConversations(data);
      });
  }, [session]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) return;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(
            data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
          );
        }
      });
  }, [activeConversationId]);

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setSidebarOpen(false);
  };

  const handleSend = async (content: string) => {
    if (!session || isLoading) return;

    const userMessage: Message = { role: "user", content };
    const allMessages: Message[] = [...messages, userMessage];

    // Optimistically show user message immediately
    setMessages(allMessages);
    setIsLoading(true);

    try {
      // ── Conversation + message persistence ─────────────────────────────────
      let convId = activeConversationId;

      if (!convId) {
        const { data } = await supabase
          .from("conversations")
          .insert({ user_id: session.user.id, title: content.slice(0, 60) })
          .select()
          .single();
        if (data) {
          convId = data.id;
          setActiveConversationId(convId);
          setConversations((prev) => [data, ...prev]);
        }
      }

      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "user",
          content,
        });
      }

      // ── Get user role ───────────────────────────────────────────────────────
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      const userRole = profile?.role || "student";

      // ── Get access token ────────────────────────────────────────────────────
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) throw new Error("No access token — user may be logged out");

      // ── Stream via fetch (supabase.functions.invoke doesn't support streaming) ──
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/rag-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          userRole,
        }),
      });

      // ── Handle provider-level errors ────────────────────────────────────────
      if (resp.status === 429) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "You're sending messages too quickly. Please wait a moment and try again." },
        ]);
        return;
      }
      if (resp.status === 402) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "AI credits are temporarily exhausted. Please try again shortly." },
        ]);
        return;
      }
      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Edge function error:", resp.status, errText);
        throw new Error(`Edge function returned ${resp.status}`);
      }
      if (!resp.body) throw new Error("Response has no body");

      // ── Read the SSE stream ─────────────────────────────────────────────────
      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      // Add an empty assistant bubble immediately so the user sees the typing indicator stop
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process complete lines from the buffer
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          // Normalise \r\n
          if (line.endsWith("\r")) line = line.slice(0, -1);

          // Skip SSE comment lines and blank lines
          if (line.startsWith(":") || line.trim() === "") continue;

          // Only process data lines
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              // Update the last message in state (the assistant bubble we added above)
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {
            // Partial JSON chunk — put it back and wait for more
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // ── Fallback: if nothing streamed, show a sensible error ───────────────
      if (!assistantContent) {
        console.warn("Stream ended with no content");
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "I didn't receive a response. Please try again.",
          };
          return updated;
        });
        return;
      }

      // ── Persist assistant message ───────────────────────────────────────────
      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantContent,
        });

        // Refresh sidebar conversation list (updates title/timestamp)
        supabase
          .from("conversations")
          .select("*")
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false })
          .then(({ data }) => { if (data) setConversations(data); });
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => {
        // Replace empty assistant bubble if one was added, otherwise append
        const last = prev[prev.length - 1];
        const withError = { role: "assistant" as const, content: "Sorry, something went wrong. Please try again." };
        if (last?.role === "assistant" && last.content === "") {
          return [...prev.slice(0, -1), withError];
        }
        return [...prev, withError];
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 hover:bg-muted lg:hidden"
          >
            <Menu size={20} />
          </button>
          <h1 className="font-serif text-lg font-semibold text-foreground">Amooti</h1>
        </header>
        <ChatMessages messages={messages} isLoading={isLoading} bottomRef={bottomRef} />
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
