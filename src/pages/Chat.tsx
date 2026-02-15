import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessages } from "@/components/ChatMessages";
import { ChatInput } from "@/components/ChatInput";
import { Menu, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

const Chat = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isStudent = profile?.role === "student";

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [user, authLoading, navigate]);

  // Load conversations for students
  useEffect(() => {
    if (isStudent && user) loadConversations();
  }, [isStudent, user]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      setConversationId(convId);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setSidebarOpen(false);
  };

  const sendMessage = async (input: string) => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    // For students, create conversation if needed
    let convId = conversationId;
    if (isStudent && !convId) {
      const { data } = await supabase
        .from("conversations")
        .insert({ user_id: user!.id, title: input.slice(0, 60) })
        .select()
        .single();
      if (data) {
        convId = data.id;
        setConversationId(data.id);
      }
    }

    // Save user message for students
    if (isStudent && convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "user",
        content: input,
      });
    }

    // Stream response
    let assistantContent = "";
    try {
      const resp = await fetch(
        `https://ehswpksboxyzqztdhofh.supabase.co/functions/v1/rag-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            conversationId: convId,
            userRole: profile?.role || "school",
          }),
        }
      );

      if (resp.status === 429) {
        toast({ title: "Rate limited", description: "Too many requests. Please wait a moment.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: "Usage limit", description: "AI credits exhausted. Please try again later.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Failed to get response");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message for students
      if (isStudent && convId && assistantContent) {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantContent,
        });
        loadConversations();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center">Loading…</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for students */}
      {isStudent && (
        <ChatSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          conversations={conversations}
          activeId={conversationId}
          onSelect={(id) => { loadMessages(id); setSidebarOpen(false); }}
          onNewChat={startNewChat}
        />
      )}

      {/* Main chat */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            {isStudent && (
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
                <Menu size={20} />
              </button>
            )}
            <h1 className="font-serif text-xl text-foreground">Amooti</h1>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {profile?.role === "student" ? "Student" : "School"}
            </span>
          </div>
          <button onClick={() => { signOut(); navigate("/"); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut size={16} /> Sign out
          </button>
        </header>

        {/* Messages */}
        <ChatMessages messages={messages} isLoading={isLoading} bottomRef={bottomRef} />

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Chat;
