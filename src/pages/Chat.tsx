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
          setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
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
    if (!session) return;

    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Create conversation if needed
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

      // Save user message
      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "user",
          content,
        });
      }

      // Call edge function with full messages array
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Get user role from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      const resp = await supabase.functions.invoke("rag-agent", {
        body: { messages: allMessages, userRole: profile?.role || "student" },
        headers: { Accept: "text/event-stream" },
      });

      // Handle streaming or plain response
      let assistantContent = "";

      if (resp.error) {
        assistantContent = "Sorry, something went wrong. Please try again.";
        console.error("Edge function error:", resp.error);
      } else {
        // Get raw text from response regardless of type
        let rawText = "";
        if (resp.data instanceof Blob) {
          rawText = await resp.data.text();
        } else if (typeof resp.data === "string") {
          rawText = resp.data;
        } else if (resp.data && typeof resp.data === "object") {
          // Already parsed JSON — check for message or SSE-like content
          if ("message" in resp.data) {
            assistantContent = resp.data.message;
          } else if (resp.data.choices?.[0]?.delta?.content) {
            assistantContent = resp.data.choices[0].delta.content;
          }
        }

        // Parse SSE lines from raw text
        if (rawText && !assistantContent) {
          const lines = rawText.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) assistantContent += delta;
              } catch {
                // If not JSON, use raw data content
                assistantContent += trimmed.slice(6);
              }
            }
          }
        }
      }

      if (!assistantContent) {
        assistantContent = "Sorry, I couldn't generate a response. Please try again.";
      }

      const assistantMessage: Message = { role: "assistant", content: assistantContent };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message
      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantContent,
        });
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, an error occurred. Please try again." },
      ]);
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
          <button onClick={() => setSidebarOpen(true)} className="rounded-md p-1.5 hover:bg-muted lg:hidden">
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
