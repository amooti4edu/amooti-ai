import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import Onboarding from "@/components/onboarding/Onboarding";
import ProfileEditor from "@/components/ProfileEditor";
import { ChatMessages } from "@/components/ChatMessages";
import { ChatInput } from "@/components/ChatInput";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ModeSelector } from "@/components/ModeSelector";
import { DifficultySelector } from "@/components/DifficultySelector";
import { DailyLimitBadge } from "@/components/DailyLimitBadge";
import { TeacherResponse } from "@/components/TeacherResponse";
import { FlashcardQuiz } from "@/components/FlashcardQuiz";
import { parseQuizResponse } from "@/lib/quiz-parser";
import { parseGradingResponse } from "@/lib/grading-parser";
import { QuizLoadingOverlay } from "@/components/QuizLoadingOverlay";
import type {
  Message,
  ChatMode,
  Tier,
  Difficulty,
  TeacherDoc,
  ApiError,
} from "@/types/chat";
import type { QuizSession, StudentAnswer } from "@/types/quiz";

import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

const SUPABASE_URL = "https://ehswpksboxyzqztdhofh.supabase.co";

const THINKING_PHRASES = [
  "Thinking...",
  "planning research...",
  "Checking the syllabus...",
  "Validating findings...",
  "Putting it all together...",
  "Almost there...",
  "Almost there...",
  "Almost there...",
];

const TEACHER_PHRASES = [
  "Thinking...",
  "planning research...",
  "Checking the syllabus...",
  "Validating findings...",
  "Generating your document…",
  "Building lesson content…",
  "Formatting materials…",
  "Almost ready…",
];

/**
 * Chat page component wrapped with onboarding protection.
 * If user hasn't completed onboarding, shows Onboarding flow.
 */
export default function Chat() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Auth redirect
  useEffect(() => {
    if (!loading && !session) navigate("/");
  }, [session, loading, navigate]);

  // Show loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Check if onboarding is needed
  if (!profile?.onboarding_completed && !onboardingComplete) {
    return (
      <Onboarding
        onComplete={() => setOnboardingComplete(true)}
        isDevelopment={true}
      />
    );
  }

  // Onboarding complete - show chat
  return <ChatContent />;
}

/**
 * Actual chat implementation (was previously the default export)
 */
function ChatContent() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  // Chat state
  const [messages, setMessages]                       = useState<Message[]>([]);
  const [isLoading, setIsLoading]                     = useState(false);
  const [loadingPhrase, setLoadingPhrase]             = useState(THINKING_PHRASES[0]);
  const [sidebarOpen, setSidebarOpen]                 = useState(false);
  const [conversations, setConversations]             = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // New state for modes & tiers
  const [mode, setMode]             = useState<ChatMode>("query");
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const [userTier, setUserTier]     = useState<Tier>("free");
  const [dailyUsed, setDailyUsed]   = useState(0);
  const [apiError, setApiError]     = useState<ApiError | null>(null);
  const [teacherDoc, setTeacherDoc] = useState<TeacherDoc | null>(null);
  const [subject, setSubject]       = useState<string | undefined>(undefined);
  const [userClass, setUserClass]   = useState<string | undefined>(undefined);

  // Quiz state
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null!);
  const phraseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !session) navigate("/");
  }, [session, loading, navigate]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, teacherDoc]);

  // ── Fetch conversations ────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    supabase
      .from("conversations")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { if (data) setConversations(data); });
  }, [session]);

  // ── Fetch user tier from profile ───────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("tier, subject, class")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setUserTier((d.tier as Tier) ?? "free");
          if (d.subject) setSubject(d.subject);
          if (d.class) setUserClass(d.class);
        }
      });
  }, [session]);

  // ── Load messages for active conversation ──────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    setTeacherDoc(null);
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

  // ── Loading phrase cycler ──────────────────────────────────────────────────
  const startLoadingPhrases = (phrases: string[]) => {
    setLoadingPhrase(phrases[0]);
    let idx = 0;
    phraseTimerRef.current = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      setLoadingPhrase(phrases[idx]);
    }, 1800);
  };

  const stopLoadingPhrases = () => {
    if (phraseTimerRef.current) {
      clearInterval(phraseTimerRef.current);
      phraseTimerRef.current = null;
    }
  };

  // ── Sidebar handlers ───────────────────────────────────────────────────────
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setTeacherDoc(null);
    setApiError(null);
    setQuizSession(null);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setApiError(null);
    setSidebarOpen(false);
  };

  // ── Error parser ───────────────────────────────────────────────────────────
  const parseApiError = async (resp: Response): Promise<ApiError> => {
    let message = "Something went wrong. Please try again.";
    try {
      const json = await resp.json();
      message = json.error ?? message;
    } catch { /* use default */ }

    if (resp.status === 429) return { type: "rate_limit", message };
    if (resp.status === 403) return { type: "forbidden", message };
    if (resp.status === 401) return { type: "auth", message };
    return { type: "server", message };
  };

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = async (content: string) => {
    if (!session || isLoading) return;
    setApiError(null);
    setTeacherDoc(null);

    const userMessage: Message = { role: "user", content };
    const allMessages: Message[] = [...messages, userMessage];
    setMessages(allMessages);
    setIsLoading(true);
    startLoadingPhrases(mode === "teacher" ? TEACHER_PHRASES : THINKING_PHRASES);

    let convId = activeConversationId;

    try {
      // ── Persist conversation ──────────────────────────────────────────────
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

      // ── Auth token ────────────────────────────────────────────────────────
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("No access token");

      // ── Branch: Teacher mode vs Chat mode ─────────────────────────────────
      if (mode === "teacher") {
        await handleTeacherRequest(allMessages, accessToken, convId);
      } else {
        await handleChatRequest(allMessages, accessToken, convId, content);
      }

      setDailyUsed((prev) => prev + 1);

    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const errorMessage: Message = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return last?.role === "assistant"
          ? [...prev.slice(0, -1), errorMessage]
          : [...prev, errorMessage];
      });
    } finally {
      stopLoadingPhrases();
      setIsLoading(false);
    }
  };

  // ── Teacher mode handler (non-streaming JSON) ──────────────────────────────
  const handleTeacherRequest = async (
    allMessages: Message[],
    accessToken: string,
    convId: string | null,
  ) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/teacher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        ...(subject ? { subject } : {}),
        ...(userClass ? { class: userClass } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const error = await parseApiError(resp);
      setApiError(error);
      if (error.type === "auth") navigate("/");
      return;
    }

    const json = await resp.json();
    stopLoadingPhrases();

    setTeacherDoc({
      content: json.content,
      downloadUrl: json.download_url,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    });

    // Add the markdown content as an assistant message
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: json.content },
    ]);

    // Persist
    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: json.content,
      });
      supabase
        .from("conversations")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("updated_at", { ascending: false })
        .then(({ data }) => { if (data) setConversations(data); });
    }
  };

  // ── Chat mode handler (SSE streaming) ──────────────────────────────────────
  const handleChatRequest = async (
    allMessages: Message[],
    accessToken: string,
    convId: string | null,
    _content: string,
  ) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        mode,
        ...(difficulty && mode === "quiz" ? { difficulty } : {}),
        ...(subject ? { subject } : {}),
        ...(userClass ? { class: userClass } : {}),
      }),
    });

    if (!resp.ok) {
      const error = await parseApiError(resp);
      setApiError(error);
      if (error.type === "auth") navigate("/");
      return;
    }

    if (!resp.body) throw new Error("Response has no body");

    // ── Read SSE stream ─────────────────────────────────────────────────────
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let assistantContent = "";
    let textBuffer = "";
    let assistantBubbleAdded = false;
    const isQuizMode = mode === "quiz";

    // In quiz mode, show loading overlay instead of streaming text
    if (isQuizMode) {
      setQuizLoading(true);
      stopLoadingPhrases();
    }

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
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            assistantContent += delta;

            // Only show streaming text for non-quiz modes
            if (!isQuizMode) {
              if (!assistantBubbleAdded) {
                assistantBubbleAdded = true;
                stopLoadingPhrases();
                setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
              }
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // ── Fallback ────────────────────────────────────────────────────────────
    if (!assistantContent) {
      setQuizLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I didn't receive a response. Please try again." },
      ]);
      return;
    }

    // ── Quiz mode: Parse quiz response ──────────────────────────────────────
    if (isQuizMode) {
      const quizData = parseQuizResponse(assistantContent);
      setQuizLoading(false);
      if (quizData && quizData.questions.length > 0) {
        // IMPORTANT: Store the full quiz content so the grading model can see the questions
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantContent },
        ]);
        setQuizSession({
          questionSet: quizData.questions,
          currentIndex: 0,
          studentAnswers: [],
          isSubmitted: false,
        });
        console.log("[Quiz] Initialized session with", quizData.questions.length, "questions");
      } else {
        console.warn("[Quiz] Failed to parse quiz — showing raw response to user");
        setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
      }
    }

    // ── Persist ─────────────────────────────────────────────────────────────
    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: assistantContent,
      });
      supabase
        .from("conversations")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("updated_at", { ascending: false })
        .then(({ data }) => { if (data) setConversations(data); });
    }
  };

  if (loading) return null;

  // ── Quiz handlers ──────────────────────────────────────────────────────────
  const handleQuizAnswerChange = (questionId: string, answer: string) => {
    if (!quizSession) return;

    setQuizSession((prev) => {
      if (!prev) return prev;

      const existingIndex = prev.studentAnswers.findIndex(
        (a) => a.questionId === questionId
      );

      let updatedAnswers: StudentAnswer[];
      if (existingIndex >= 0) {
        updatedAnswers = [...prev.studentAnswers];
        updatedAnswers[existingIndex] = { questionId, answer };
      } else {
        updatedAnswers = [...prev.studentAnswers, { questionId, answer }];
      }

      return {
        ...prev,
        studentAnswers: updatedAnswers,
      };
    });
  };

  const handleQuizNext = () => {
    setQuizSession((prev) => {
      if (!prev || prev.currentIndex >= prev.questionSet.length - 1) return prev;
      return { ...prev, currentIndex: prev.currentIndex + 1 };
    });
  };

  const handleQuizPrevious = () => {
    setQuizSession((prev) => {
      if (!prev || prev.currentIndex === 0) return prev;
      return { ...prev, currentIndex: prev.currentIndex - 1 };
    });
  };

  const handleQuizNavigate = (index: number) => {
    setQuizSession((prev) => {
      if (!prev || index < 0 || index >= prev.questionSet.length) return prev;
      return { ...prev, currentIndex: index };
    });
  };

  const handleQuizClose = () => {
    setQuizSession(null);
  };

  const handleQuizSubmit = async () => {
    if (!quizSession || !session) return;

    setIsLoading(true);
    startLoadingPhrases(THINKING_PHRASES);

    try {
      // Build a detailed grading request that includes BOTH questions AND answers
      const answersWithQuestions = quizSession.questionSet.map((q) => {
        const studentAns = quizSession.studentAnswers.find((a) => a.questionId === q.id);
        let questionText = `Q${q.number}. ${q.text}`;
        if (q.options) {
          questionText += "\n" + q.options.map((o) => `  ${o.id}) ${o.text}`).join("\n");
        }
        questionText += `\nStudent's answer: ${studentAns?.answer ?? "(no answer)"}`;
        return questionText;
      }).join("\n\n");

      const quizResultMessage: Message = {
        role: "user",
        content: `Here are the quiz questions and my answers. Please grade each one, tell me which are correct/incorrect, give the correct answer for wrong ones, and explain why.\n\n${answersWithQuestions}`,
      };

      const allMessages = [...messages, quizResultMessage];
      setMessages(allMessages);

      // Get access token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("No access token");

      // Send answers to model for grading
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          mode: "quiz", // Still in quiz mode for grading
          ...(difficulty ? { difficulty } : {}),
          ...(subject ? { subject } : {}),
          ...(userClass ? { class: userClass } : {}),
        }),
      });

      if (!resp.ok) {
        const error = await parseApiError(resp);
        setApiError(error);
        if (error.type === "auth") navigate("/");
        return;
      }

      if (!resp.body) throw new Error("Response has no body");

      // Read grading response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let gradingContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let textBuffer = decoder.decode(value, { stream: true });
        const lines = textBuffer.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) gradingContent += delta;
          } catch {
            // Skip parse errors
          }
        }
      }

      // Parse grading response into structured results
      setQuizSession((prev) => {
        if (!prev) return prev;
        const results = parseGradingResponse(
          gradingContent,
          prev.questionSet,
          prev.studentAnswers
        );
        return {
          ...prev,
          isSubmitted: true,
          results,
        };
      });

      // Persist conversation
      if (activeConversationId) {
        await supabase.from("messages").insert({
          conversation_id: activeConversationId,
          role: "user",
          content: quizResultMessage.content,
        });
        await supabase.from("messages").insert({
          conversation_id: activeConversationId,
          role: "assistant",
          content: gradingContent,
        });
      }
    } catch (err: any) {
      console.error("Quiz submission error:", err);
      setApiError({
        type: "server",
        message: "Error submitting quiz. Please try again.",
      });
    } finally {
      stopLoadingPhrases();
      setIsLoading(false);
    }
  };

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
        {/* Header */}
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 hover:bg-muted"
          >
            <Menu size={20} />
          </button>
          <h1 className="font-serif text-lg font-semibold text-foreground">Amooti</h1>
          <div className="ml-auto flex items-center gap-2">
            <DailyLimitBadge tier={userTier} used={dailyUsed} />
            <ProfileEditor />
          </div>
        </header>

        {/* API error banner */}
        {apiError && (
          <div
            className={`flex items-center justify-between px-4 py-2 text-sm ${
              apiError.type === "rate_limit"
                ? "bg-destructive/10 text-destructive"
                : apiError.type === "forbidden"
                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            <span>{apiError.message}</span>
            <button onClick={() => setApiError(null)} className="p-1 hover:bg-background/50 rounded">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Messages area */}
        {quizLoading ? (
          <QuizLoadingOverlay />
        ) : quizSession ? (
          <div className="flex-1 overflow-y-auto py-6 px-4">
            <FlashcardQuiz
              session={quizSession}
              onAnswerChange={handleQuizAnswerChange}
              onNext={handleQuizNext}
              onPrevious={handleQuizPrevious}
              onSubmit={handleQuizSubmit}
              onNavigate={handleQuizNavigate}
              onClose={handleQuizClose}
              isSubmitting={isLoading}
            />
          </div>
        ) : teacherDoc && !isLoading ? (
          <div className="flex-1 overflow-y-auto py-6 px-4">
            <TeacherResponse doc={teacherDoc} />
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            loadingPhrase={loadingPhrase}
            bottomRef={bottomRef}
          />
        )}

        {/* Controls bar: mode selector + difficulty */}
        {!quizSession && (
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2 bg-background">
            <ModeSelector mode={mode} onModeChange={setMode} tier={userTier} />
            {mode === "quiz" && (
              <DifficultySelector
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
              />
            )}
          </div>
        )}

        {!quizSession && <ChatInput onSend={handleSend} disabled={isLoading} />}
      </div>
    </div>
  );
}
