import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuotaSync } from "@/hooks/useQuotaSync";
import { supabase } from "@/integrations/supabase/client";
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

// ── Subject configuration ─────────────────────────────────────────────────
// Edit these arrays to add or remove subjects. O-Level shows for S1–S4,
// A-Level shows for S5–S6, both show if class is not set.
const OLEVEL_SUBJECTS = [
  "Mathematics",
  "English",
  "Biology",
  "Chemistry",
  "Physics",
  "H&P",
  "Geography",
  "General Science",
] as const;

const ALEVEL_SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "History",
  "Geography",
  "General Paper",
] as const;

const ALEVEL_CLASSES = ["S5", "S6"];

/** Returns the subject list appropriate for the user's class. */
function getSubjectList(userClass?: string): string[] {
  if (!userClass) {
    // No class set — show combined, deduplicated list
    return Array.from(new Set([...OLEVEL_SUBJECTS, ...ALEVEL_SUBJECTS]));
  }
  return ALEVEL_CLASSES.includes(userClass)
    ? [...ALEVEL_SUBJECTS]
    : [...OLEVEL_SUBJECTS];
}
// ─────────────────────────────────────────────────────────────────────────

const THINKING_PHRASES = [
  "Thinking...",
  "Searching the syllabus...",
  "Finding the right concepts...",
  "Connecting the curriculum...",
  "Checking your progress...",
  "Planning the best answer...",
  "Validating findings...",
  "Putting it all together...",
  "Almost there...",
  "Just a moment more...",
  "Still working on it...",
  "Switching models, hang tight...",
  "Almost there...",
];

const TEACHER_PHRASES = [
  "Thinking...",
  "Reading the curriculum...",
  "Checking learning outcomes...",
  "Planning the structure...",
  "Generating your document…",
  "Building lesson content…",
  "Adding activities and methods…",
  "Formatting materials…",
  "Switching models, hang tight...",
  "Almost ready…",
  "Final touches…",
];

// ── Single default export — no onboarding wrapper ─────────────────────────
export default function Chat() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // ── Chat state ─────────────────────────────────────────────────────────
  const [messages, setMessages]                         = useState<Message[]>([]);
  const [isLoading, setIsLoading]                       = useState(false);
  const [loadingPhrase, setLoadingPhrase]               = useState(THINKING_PHRASES[0]);
  const [sidebarOpen, setSidebarOpen]                   = useState(false);
  const [conversations, setConversations]               = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // ── Mode / tier state ──────────────────────────────────────────────────
  const [mode, setMode]             = useState<ChatMode>("query");
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const [userTier, setUserTier]     = useState<Tier>("free");
  const quota                        = useQuotaSync(userTier as Tier, session?.user.id ?? null);
  const [apiError, setApiError]         = useState<ApiError | null>(null);
  const [teacherDoc, setTeacherDoc]     = useState<TeacherDoc | null>(null);
  const [subject, setSubject]           = useState<string | undefined>(undefined);
  const [userClass, setUserClass]       = useState<string | undefined>(undefined);
  // sessionSubject: what the user has selected for this session.
  // Starts from their profile subject but can be changed per-session
  // without touching the profile.
  const [sessionSubject, setSessionSubject] = useState<string | undefined>(undefined);

  // ── Quiz state ─────────────────────────────────────────────────────────
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null!);
  const phraseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth redirect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !session) navigate("/");
  }, [session, loading, navigate]);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, teacherDoc]);

  // ── Fetch conversations ────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    supabase
      .from("conversations")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { if (data) setConversations(data); });
  }, [session]);

  // ── Initial profile fetch ──────────────────────────────────────────────
  // Reads tier / subject / class from profiles table on mount.
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
          if (d.subject) {
            setSubject(d.subject);
            setSessionSubject(d.subject);   // seed session selector from profile
          }
          if (d.class) setUserClass(d.class);
        }
      });
  }, [session]);

  // ── Realtime: re-sync tier/subject/class when ProfileEditor saves ──────
  // This means the moment the user saves their profile (including a future
  // tier upgrade), Chat picks it up without requiring a page reload.
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`profile-changes-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "profiles",
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.tier) setUserTier(updated.tier as Tier);
          if (updated.subject) {
            setSubject(updated.subject);
            setSessionSubject(updated.subject); // keep selector in sync with profile
          }
          if (updated.class) setUserClass(updated.class);
          // Also keep the auth context profile fresh
          refreshProfile?.();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, refreshProfile]);

  // ── Load messages for active conversation ──────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    setTeacherDoc(null);
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        const allMessages = data.map((m) => ({
          role:    m.role as "user" | "assistant",
          content: m.content,
        }));

        // Keep last 30 messages in display to avoid token overflow
        const MAX_DISPLAY = 30;
        if (allMessages.length > MAX_DISPLAY) {
          setMessages(allMessages.slice(-MAX_DISPLAY));
        } else {
          setMessages(allMessages);
        }
      });
  }, [activeConversationId]);

  // ── Loading phrase cycler ──────────────────────────────────────────────
  const startLoadingPhrases = (phrases: string[]) => {
    setLoadingPhrase(phrases[0]);
    let idx = 0;
    phraseTimerRef.current = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      setLoadingPhrase(phrases[idx]);
    }, 3000);
  };

  const stopLoadingPhrases = () => {
    if (phraseTimerRef.current) {
      clearInterval(phraseTimerRef.current);
      phraseTimerRef.current = null;
    }
  };

  // ── Sidebar handlers ───────────────────────────────────────────────────
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
    setQuizSession(null);
    setSidebarOpen(false);
  };

  // ── Error parser ───────────────────────────────────────────────────────
  const parseApiError = async (resp: Response): Promise<ApiError> => {
    let message = "Something went wrong. Please try again.";
    try {
      const json = await resp.json();
      message = json.error ?? message;
    } catch { /* use default */ }

    if (resp.status === 429) return { type: "rate_limit", message };
    if (resp.status === 403) return { type: "forbidden", message };
    if (resp.status === 401) return { type: "auth",      message };
    return { type: "server", message };
  };

  // ── Limit messages sent to backend ────────────────────────────────────
  const getMessagesForBackend = (msgs: Message[]): Message[] => {
    const MAX_CONTEXT = 30;
    return msgs.length > MAX_CONTEXT ? msgs.slice(-MAX_CONTEXT) : msgs;
  };

  // ── Send handler ───────────────────────────────────────────────────────
  const handleSend = async (content: string) => {
    if (!session || isLoading) return;
    setApiError(null);
    setTeacherDoc(null);

    const userMessage: Message   = { role: "user", content };
    const allMessages: Message[] = [...messages, userMessage];

    // Show user message + empty assistant bubble immediately so the dot-pulse
    // animation starts right away — even during long model failover waits.
    setMessages([...allMessages, { role: "assistant", content: "" }]);
    setIsLoading(true);
    startLoadingPhrases(mode === "teacher" ? TEACHER_PHRASES : THINKING_PHRASES);

    let convId = activeConversationId;

    try {
      // ── Persist conversation ────────────────────────────────────────
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
          role:    "user",
          content,
        });
      }

      // ── Auth token ──────────────────────────────────────────────────
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("No access token");

      // ── Branch: Teacher mode vs Chat mode ───────────────────────────
      if (mode === "teacher") {
        await handleTeacherRequest(allMessages, accessToken, convId);
      } else {
        await handleChatRequest(allMessages, accessToken, convId);
      }

      quota.invalidate();

    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => {
        const errorMessage: Message = {
          role:    "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        const last = prev[prev.length - 1];
        return last?.role === "assistant"
          ? [...prev.slice(0, -1), errorMessage]
          : [...prev, errorMessage];
      });
    } finally {
      stopLoadingPhrases();
      setIsLoading(false);
    }
  };

  // ── Teacher mode handler (non-streaming JSON) ──────────────────────────
  const handleTeacherRequest = async (
    allMessages: Message[],
    accessToken: string,
    convId: string | null,
  ) => {
    if (userTier !== "premium" && userTier !== "enterprise") {
      setApiError({
        type:    "forbidden",
        message: "Teacher mode requires a Premium plan (15,000 UGX/month).",
      });
      return;
    }

    // Teacher endpoint can take 2+ minutes — extend timeout and add keep-alive.
    let resp: Response;
    try {
      resp = await fetch(`${SUPABASE_URL}/functions/v1/teacher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: getMessagesForBackend(allMessages).map((m) => ({
            role:    m.role,
            content: m.content,
          })),
          ...(sessionSubject ? { subject: sessionSubject } : {}),
          ...(userClass      ? { class: userClass }        : {}),
        }),
        signal: AbortSignal.timeout(150_000), // 2.5 min — teacher docs take time
      });
    } catch (fetchErr: any) {
      // Timeout or network drop — try polling DB in case backend finished
      if (convId) {
        setLoadingPhrase("Still building your document, hang tight…");
        const polled = await pollForReply(convId, 8000, 10);
        if (polled) {
          stopLoadingPhrases();
          // We have the summary but not the download URL — show what we have
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: polled };
            return updated;
          });
          refreshConversations();
          return;
        }
      }
      throw fetchErr;
    }

    if (!resp.ok) {
      const error = await parseApiError(resp);
      setApiError(error);
      if (error.type === "auth") navigate("/");
      return;
    }

    const json = await resp.json();
    stopLoadingPhrases();

    const docObj     = json.content;
    const docSummary = typeof docObj === "string"
      ? docObj
      : `📄 ${docObj?.title ?? "Teacher document"} (${docObj?.type ?? "document"}) — download the Word file above to view the full document.`;

    setTeacherDoc({
      content:     docObj,
      downloadUrl: json.download_url,
      expiresAt:   Date.now() + (json.expires_in ?? 3600) * 1000,
    });

    // Fill in the empty bubble we added in handleSend
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: "assistant", content: docSummary };
      return updated;
    });

    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role:    "assistant",
        content: docSummary,
      });
      refreshConversations();
    }
  };

  // ── Poll DB for assistant reply (keep-alive fallback) ─────────────────
  // Called when SSE stream ends with no content or times out. The backend
  // may have finished writing to the DB even if the stream disconnected.
  const pollForReply = async (convId: string, pollMs = 5000, maxAttempts = 12) => {
    console.log("[Poll] SSE empty — polling DB for reply...");
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollMs));
      const { data } = await supabase
        .from("messages")
        .select("content, role, created_at")
        .eq("conversation_id", convId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data?.content) {
        console.log(`[Poll] Found reply on attempt ${i + 1}`);
        return data.content as string;
      }
    }
    console.warn("[Poll] No reply found after polling");
    return null;
  };

  // ── Chat mode handler (SSE streaming with retry + keep-alive) ──────────
  const handleChatRequest = async (
    allMessages: Message[],
    accessToken: string,
    convId: string | null,
  ) => {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // In quiz mode only send the single triggering user message.
        // Sending prior conversation history confuses the backend into
        // returning raw JSON instead of a properly formatted quiz.
        const isQuizRequest = mode === "quiz";
        const messagesForBackend = isQuizRequest
          ? [allMessages[allMessages.length - 1]]
          : getMessagesForBackend(allMessages);

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messages: messagesForBackend.map((m) => ({ role: m.role, content: m.content })),
            mode,
            ...(difficulty && mode === "quiz" ? { difficulty }              : {}),
            ...(sessionSubject                ? { subject: sessionSubject } : {}),
            ...(userClass                     ? { class: userClass }        : {}),
          }),
        });

        if (!resp.ok) {
          const error = await parseApiError(resp);
          setApiError(error);
          if (error.type === "auth") navigate("/");
          return;
        }

        if (!resp.body) throw new Error("Response has no body");

        // ── Read SSE stream ───────────────────────────────────────────
        const reader     = resp.body.getReader();
        const decoder    = new TextDecoder();
        let textBuffer   = "";
        let assistantContent = "";
        const isQuizMode = mode === "quiz";

        if (isQuizMode) {
          setQuizLoading(true);
          stopLoadingPhrases();
        }

        readLoop:
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
            if (jsonStr === "[DONE]") break readLoop;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta  = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;

                if (!isQuizMode) {
                  // Stop the loading phrases on first token, then stream into
                  // the bubble we already added in handleSend.
                  stopLoadingPhrases();
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role:    "assistant",
                      content: assistantContent,
                    };
                    return updated;
                  });
                }
              }
            } catch {
              // Incomplete JSON chunk — accumulate and retry
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // ── Keep-alive: if stream ended with no content, poll the DB ─────
        // This catches cases where the backend finished but the SSE stream
        // disconnected before delivering tokens to the client.
        if (!assistantContent && convId) {
          setLoadingPhrase("Still waiting for a response…");
          const polled = await pollForReply(convId);
          if (polled) {
            assistantContent = polled;
            if (!isQuizMode) {
              stopLoadingPhrases();
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: polled };
                return updated;
              });
            }
          }
        }

        // ── Still nothing after polling ───────────────────────────────
        if (!assistantContent) {
          setQuizLoading(false);
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

        // ── Quiz mode: parse and start quiz session ───────────────────
        if (isQuizMode) {
          const quizData = parseQuizResponse(assistantContent);
          setQuizLoading(false);
          if (quizData && quizData.questions.length > 0) {
            // Replace the empty bubble with the raw quiz content
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: assistantContent };
              return updated;
            });
            setQuizSession({
              questionSet:    quizData.questions,
              currentIndex:   0,
              studentAnswers: [],
              isSubmitted:    false,
            });
          } else {
            // Parse failed — show friendly retry prompt instead of raw JSON
            console.warn("[Quiz] Failed to parse quiz response");
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: "I wasn't able to format that as a quiz. Try being more specific — for example: **Quiz me on quadratic equations** or **Quiz me on S3 term 1 Biology**.",
              };
              return updated;
            });
          }
        }

        // ── Persist assistant message to DB (skip if already polled — it's there) ─
        if (convId) {
          // Only insert if we got this from the stream (not from polling)
          const { data: existing } = await supabase
            .from("messages")
            .select("id")
            .eq("conversation_id", convId)
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const alreadyInDb = existing != null;
          if (!alreadyInDb) {
            await supabase.from("messages").insert({
              conversation_id: convId,
              role:    "assistant",
              content: assistantContent,
            });
          }
          refreshConversations();
        }

        quota.invalidate();
        return; // success — exit retry loop

      } catch (err: any) {
        lastError = err;
        console.warn(`[SSE] Attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt - 1) * 1000)
          );
        }
      }
    }

    // All retries exhausted
    setQuizLoading(false);
    console.error("[SSE] All retries failed:", lastError);
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = {
        role:    "assistant",
        content: `Sorry, I couldn't get a response after ${MAX_RETRIES} attempts. Please try again in a moment.`,
      };
      return updated;
    });
  };

  // ── Refresh conversation list (safe — uses closure over session) ───────
  const refreshConversations = () => {
    const userId = session?.user.id;
    if (!userId) return;
    supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { if (data) setConversations(data); });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white">Loading…</div>
      </div>
    );
  }

  // ── Quiz handlers ──────────────────────────────────────────────────────
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
      return { ...prev, studentAnswers: updatedAnswers };
    });
  };

  const handleQuizNext = () =>
    setQuizSession((prev) => {
      if (!prev || prev.currentIndex >= prev.questionSet.length - 1) return prev;
      return { ...prev, currentIndex: prev.currentIndex + 1 };
    });

  const handleQuizPrevious = () =>
    setQuizSession((prev) => {
      if (!prev || prev.currentIndex === 0) return prev;
      return { ...prev, currentIndex: prev.currentIndex - 1 };
    });

  const handleQuizNavigate = (index: number) =>
    setQuizSession((prev) => {
      if (!prev || index < 0 || index >= prev.questionSet.length) return prev;
      return { ...prev, currentIndex: index };
    });

  const handleQuizClose = () => setQuizSession(null);

  const handleQuizSubmit = async () => {
    if (!quizSession || !session) return;

    setIsLoading(true);
    startLoadingPhrases(THINKING_PHRASES);

    try {
      const answersWithQuestions = quizSession.questionSet
        .map((q) => {
          const studentAns = quizSession.studentAnswers.find(
            (a) => a.questionId === q.id
          );
          let questionText = `Q${q.number}. ${q.text}`;
          if (q.options) {
            questionText +=
              "\n" + q.options.map((o) => `  ${o.id}) ${o.text}`).join("\n");
          }
          questionText += `\nStudent's answer: ${studentAns?.answer ?? "(no answer)"}`;
          return questionText;
        })
        .join("\n\n");

      const quizResultMessage: Message = {
        role:    "user",
        content: `Here are the quiz questions and my answers. Please grade each one, tell me which are correct/incorrect, give the correct answer for wrong ones, and explain why.\n\n${answersWithQuestions}`,
      };

      const allMessages = [...messages, quizResultMessage];
      setMessages(allMessages);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("No access token");

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          mode:     "quiz",
          grading:  true,
          ...(difficulty    ? { difficulty }              : {}),
          ...(sessionSubject ? { subject: sessionSubject } : {}),
          ...(userClass     ? { class: userClass }        : {}),
        }),
      });

      if (!resp.ok) {
        const error = await parseApiError(resp);
        setApiError(error);
        if (error.type === "auth") navigate("/");
        return;
      }

      if (!resp.body) throw new Error("Response has no body");

      // ── Read grading stream ─────────────────────────────────────────
      // FIX: accumulate across chunks, same pattern as handleChatRequest
      const reader        = resp.body.getReader();
      const decoder       = new TextDecoder();
      let textBuffer      = "";
      let gradingContent  = "";

      readLoop:
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break readLoop;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta  = parsed.choices?.[0]?.delta?.content;
            if (delta) gradingContent += delta;
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      setQuizSession((prev) => {
        if (!prev) return prev;
        const results = parseGradingResponse(
          gradingContent,
          prev.questionSet,
          prev.studentAnswers
        );
        return { ...prev, isSubmitted: true, results };
      });

      if (activeConversationId) {
        await supabase.from("messages").insert({
          conversation_id: activeConversationId,
          role:    "user",
          content: quizResultMessage.content,
        });
        await supabase.from("messages").insert({
          conversation_id: activeConversationId,
          role:    "assistant",
          content: gradingContent,
        });
      }
    } catch (err: any) {
      console.error("Quiz submission error:", err);
      setApiError({
        type:    "server",
        message: "Error submitting quiz. Please try again.",
      });
    } finally {
      stopLoadingPhrases();
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
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
            <DailyLimitBadge tier={userTier} used={quota.used} />
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
            <button
              onClick={() => setApiError(null)}
              className="p-1 hover:bg-background/50 rounded"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Main content area */}
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

        {/* Controls bar */}
        {!quizSession && (
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2 bg-background">
            <ModeSelector mode={mode} onModeChange={setMode} tier={userTier} />

            {/* Subject selector — always visible across all modes */}
            <select
              value={sessionSubject ?? ""}
              onChange={(e) => setSessionSubject(e.target.value || undefined)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Subject…</option>
              {getSubjectList(userClass).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {mode === "quiz" && (
              <DifficultySelector
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
              />
            )}
          </div>
        )}

        {!quizSession && (
          <ChatInput onSend={handleSend} disabled={isLoading} mode={mode} />
        )}

      </div>
    </div>
  );
}
