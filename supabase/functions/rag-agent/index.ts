import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchCurriculum } from "./curriculum-tool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// Types
// ============================================================================

interface QdrantResult {
  id: string;
  score: number;
  payload: {
    page_content?: string;
    text?: string;
    content?: string;
    metadata?: {
      subject?: string;
      level?: string;
      term?: string;
      topic?: string;
      theme?: string;
      content_type?: string;
      section_type?: string;
      competency?: string;
      has_learning_outcomes?: boolean;
      has_activities?: boolean;
      has_assessment?: boolean;
    };
  };
}

interface CurriculumAlignment {
  subject?: string;
  level?: string;
  term?: string;
  topic?: string;
  competency?: string;
  // What the student should be able to do — extracted from learning outcomes chunks
  learningOutcomes: string[];
  // Raw syllabus chunks for the model to read and understand scope/depth
  syllabusChunks: string[];
  // Whether we found anything relevant at all
  found: boolean;
}

// ============================================================================
// Score threshold
//
// Chunks below this score are from unrelated subjects and should be dropped.
// In testing, a moles query pulled Biology chunks at ~0.51.
// Relevant Chemistry chunks scored ~0.52+. Threshold set conservatively at 0.50
// to avoid dropping edge cases — the prompt handles irrelevant content gracefully.
// Raise to 0.55–0.60 if you see persistent cross-subject contamination.
// ============================================================================

const SCORE_THRESHOLD = 0.50;

// ============================================================================
// Parse curriculum alignment from Qdrant results
//
// ALL chunks in your database are syllabus specification data — learning outcomes,
// teaching activities, assessment strategies. There is no explanatory textbook
// content. The model uses its own knowledge to explain topics; the database
// tells it what level, depth, and outcomes apply for this student.
// ============================================================================

function parseCurriculumAlignment(results: QdrantResult[]): CurriculumAlignment {
  const alignment: CurriculumAlignment = {
    learningOutcomes: [],
    syllabusChunks: [],
    found: false,
  };

  for (const r of results) {
    if (r.score < SCORE_THRESHOLD) {
      console.log(
        `[RAG] Dropped (score ${r.score.toFixed(3)} < ${SCORE_THRESHOLD}): ` +
        `${r.payload.metadata?.subject ?? "?"} — ${r.payload.metadata?.topic ?? "?"}`
      );
      continue;
    }

    const text =
      r.payload.page_content ??
      r.payload.text ??
      r.payload.content ??
      JSON.stringify(r.payload);

    const meta = r.payload.metadata;

    // Pull top-level metadata from the highest-scoring chunk that has it
    if (!alignment.subject && meta?.subject) {
      alignment.subject    = meta.subject;
      alignment.level      = meta.level;
      alignment.term       = meta.term;
      alignment.topic      = meta.topic;
      alignment.competency = meta.competency;
      alignment.found      = true;
    }

    // Every passing chunk goes into syllabusChunks — the model reads all of
    // them to understand the full scope and depth expected at this level
    alignment.syllabusChunks.push(text);
  }

  console.log(
    `[RAG/Align] found: ${alignment.found} | ` +
    `subject: ${alignment.subject ?? "—"} | ` +
    `level: ${alignment.level ?? "—"} | ` +
    `syllabus chunks: ${alignment.syllabusChunks.length}`
  );

  return alignment;
}

// ============================================================================
// System prompt
//
// The database contains curriculum specification only — no textbook content.
// The model explains topics from its own knowledge, calibrated to the curriculum.
// ============================================================================

function buildSystemPrompt(alignment: CurriculumAlignment, userRole: string): string {

  // ── Identity ──────────────────────────────────────────────────────────────
  const level = alignment.level ?? "secondary school";
  const identity = `You are Amooti, a warm and encouraging AI study assistant for Uganda's secondary school students.
You have deep knowledge of all secondary school subjects. You explain things clearly, step by step, in language a ${level} student can follow.
You always talk directly to the student — never write teacher notes, lesson plans, or syllabus summaries.`;

  // ── Curriculum alignment section ──────────────────────────────────────────
  // This is the core of the architecture: give the model the curriculum spec
  // so it knows what depth, scope, and outcomes apply — then tell it to
  // explain from its OWN knowledge, not by reproducing the spec.
  const curriculumSection = alignment.found
    ? `
================================================================================
CURRICULUM SPECIFICATION (Uganda Secondary School Syllabus)
================================================================================
This is the official syllabus specification for the topic the student is asking about.
Read it carefully to understand:
  • What level and term this student is at
  • What outcomes they are expected to achieve
  • What depth and scope is appropriate
  • What connections to other topics exist

Subject:    ${alignment.subject}
Level:      ${alignment.level}
Term:       ${alignment.term}
Topic:      ${alignment.topic}
Competency: ${alignment.competency ?? "—"}

Syllabus Detail:
${alignment.syllabusChunks.join("\n\n---\n\n")}

================================================================================
HOW TO USE THIS SPECIFICATION:
================================================================================
✓ Use it to calibrate your explanation to the correct level and depth
✓ Use it to know which concepts the student is expected to understand
✓ Use it to know what skills they should be able to apply (e.g. mole calculations)
✓ Use it to connect to related topics they have already studied

✗ Do NOT reproduce the syllabus text in your answer
✗ Do NOT mention "learning outcomes", "competency", or "assessment strategies" to the student
✗ Do NOT structure your answer around the syllabus — structure it around the student's question

Your explanation must come from your own knowledge of the subject, pitched correctly
for a ${level} student working through this topic in the Uganda curriculum.`
    : `
================================================================================
NO CURRICULUM MATCH FOUND
================================================================================
The curriculum database did not return a relevant match for this query.
This means either the topic is outside the Uganda secondary syllabus scope,
or the search didn't find a close enough match.

Answer from your general knowledge of the subject at an appropriate secondary school level.
You can use the search_curriculum tool with specific filters (subject, level, term, topic)
to try finding the relevant syllabus section before answering.`;

  // ── How to answer ─────────────────────────────────────────────────────────
  const answerRules = `
================================================================================
HOW TO ANSWER
================================================================================
Structure every answer like a good teacher would explain it in class:

1. HOOK — Start with one plain sentence that directly answers what the student asked.
   Example: "A mole is simply a chemist's way of counting incredibly tiny particles."

2. BUILD — Develop the concept step by step. One clear idea per paragraph.
   Start from what the student already knows and build upward.
   Use everyday analogies for abstract ideas ("think of it like a dozen, but for atoms").

3. SHOW — For topics involving calculations or processes, walk through a worked example
   with real numbers. Show every step. Explain what you're doing at each step.

4. CHECK — End with 1 or 2 short practice questions so the student can test themselves.
   Keep them at the right difficulty for ${level}.

TONE:
• Talk directly to the student: "you", "let's", "notice that", "now try"
• Be encouraging — if something is tricky, say so and slow down
• Never be condescending

FORMAT:
• Use **bold** for key terms when first introduced
• Use numbered steps for processes and calculations
• Use bullet points for lists of related items
• Use $...$ for inline math (e.g. $n = \\frac{m}{M}$) — the app renders this correctly
• Use $$...$$ for display equations on their own line
• Use markdown tables only when genuinely comparing multiple items
• Keep length proportional to the question:
    - "What is X?" → 3–4 paragraphs + 1 worked example
    - "How do I calculate X?" → worked example first, then explain why it works
    - "I don't understand X" → go back to basics, use an analogy, then build up`;

  // ── Tool instruction ──────────────────────────────────────────────────────
  const toolInstruction = `
================================================================================
TOOL: search_curriculum
================================================================================
Use this when the syllabus above doesn't cover what you need — for example if the
student asks about a specific term or subtopic not shown above.
Parameters: query, subject, level, term, topic, content_type, limit.
Use sparingly — only when the initial context is genuinely insufficient.`;

  // ── History / account note ────────────────────────────────────────────────
  const accountNote = userRole === "school"
    ? `
================================================================================
ACCOUNT TYPE: School (shared session)
================================================================================
Multiple students may use this session. Do not reference earlier messages as
belonging to a specific student. Keep each response self-contained.`
    : `
================================================================================
ACCOUNT TYPE: Individual student
================================================================================
The full conversation history is provided. Use it to:
• Build on explanations you have already given — don't repeat yourself
• Notice where the student is struggling and adjust your approach
• Reference earlier turns naturally ("Remember when we looked at...")
• Maintain continuity so the student feels genuinely guided session to session`;

  return [identity, curriculumSection, answerRules, toolInstruction, accountNote].join("\n");
}

// ============================================================================
// Embedding
// ============================================================================

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.error("[Embedding] OPENROUTER_API_KEY not configured");
    return null;
  }

  console.log(`[Embedding] Generating via OpenRouter (baai/bge-m3) for: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "baai/bge-m3", input: text }),
    });

    if (!response.ok) {
      console.error(`[Embedding] OpenRouter error ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding ?? null;

    if (embedding) {
      console.log(`[Embedding] ✓ Generated — ${embedding.length} dimensions`);
    } else {
      console.warn("[Embedding] ✗ No embedding in response");
    }

    return embedding;
  } catch (error) {
    console.error("[Embedding] Exception:", error);
    return null;
  }
}

// ============================================================================
// Tool definition
// ============================================================================

const CURRICULUM_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_curriculum",
    description:
      "Search the Uganda curriculum database. Use only when the initial RAG context is insufficient for the student's question.",
    parameters: {
      type: "object",
      properties: {
        query:        { type: "string",  description: "Search text" },
        subject:      { type: "string",  description: "e.g. 'Physics', 'Chemistry', 'Biology'" },
        level:        { type: "string",  description: "e.g. 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'" },
        term:         { type: "string",  description: "e.g. 'Term 1', 'Term 2', 'Term 3'" },
        topic:        { type: "string",  description: "Specific topic name" },
        content_type: {
          type: "string",
          enum: ["learning_outcomes", "teaching_activities", "assessment_strategies", "ict_resources", "program_overview", "general_content"],
        },
        limit: { type: "number", default: 5 },
      },
    },
  },
};

// ============================================================================
// Tool executor
// ============================================================================

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  console.log(`[Tool] Executing "${name}" with args:`, JSON.stringify(args));

  if (name === "search_curriculum") {
    try {
      const result = await searchCurriculum(args);
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      console.log(`[Tool] ✓ "${name}" returned ${resultStr.length} chars`);
      return resultStr;
    } catch (error) {
      console.error(`[Tool] ✗ "${name}" threw:`, error);
      return `Tool error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  return `Unknown tool: ${name}`;
}

// ============================================================================
// Chat providers — non-streaming (tool-call detection pass)
// ============================================================================

async function chatNonStreaming(messages: any[], tools: any[]): Promise<any | null> {
  const cerebrasKey   = Deno.env.get("CEREBRAS_API_KEY");
  const ollamaKey     = Deno.env.get("OLLAMA_API_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

  // Cerebras
  if (cerebrasKey) {
    console.log("[Chat/NonStream] Attempting Cerebras (gpt-oss-120b)…");
    try {
      const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${cerebrasKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-oss-120b", messages, tools, tool_choice: "auto", stream: false }),
      });
      if (response.ok) { console.log("[Chat/NonStream] ✓ Cerebras responded"); return await response.json(); }
      console.error(`[Chat/NonStream] Cerebras error ${response.status}: ${await response.text()}`);
    } catch (e) { console.error("[Chat/NonStream] Cerebras exception:", e); }
  }

  // Ollama cloud
  if (ollamaKey) {
    console.log("[Chat/NonStream] Attempting Ollama cloud (gpt-oss:120b-cloud)…");
    try {
      const response = await fetch("https://ollama.com/api/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${ollamaKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-oss:120b-cloud", messages, tools, stream: false }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log("[Chat/NonStream] ✓ Ollama responded — normalizing shape");
        return {
          choices: [{
            message: {
              role: "assistant",
              content: data.message?.content ?? null,
              tool_calls: data.message?.tool_calls ?? undefined,
            },
            finish_reason: data.done
              ? (data.message?.tool_calls?.length ? "tool_calls" : "stop")
              : "stop",
          }],
        };
      }
      console.error(`[Chat/NonStream] Ollama error ${response.status}: ${await response.text()}`);
    } catch (e) { console.error("[Chat/NonStream] Ollama exception:", e); }
  }

  // OpenRouter
  if (openRouterKey) {
    console.log("[Chat/NonStream] Attempting OpenRouter (cerebras/gpt-oss-120b)…");
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "cerebras/gpt-oss-120b", messages, tools, tool_choice: "auto", stream: false }),
      });
      if (response.ok) { console.log("[Chat/NonStream] ✓ OpenRouter responded"); return await response.json(); }
      console.error(`[Chat/NonStream] OpenRouter error ${response.status}: ${await response.text()}`);
    } catch (e) { console.error("[Chat/NonStream] OpenRouter exception:", e); }
  }

  console.error("[Chat/NonStream] All providers failed");
  return null;
}

// ============================================================================
// Chat providers — streaming (final answer pass)
// ============================================================================

async function chatCerebrasStream(messages: any[], apiKey: string): Promise<Response | null> {
  console.log("[Chat/Stream] Attempting Cerebras (gpt-oss-120b)…");
  try {
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss-120b", messages, stream: true }),
    });
    if (!response.ok) { console.error(`[Chat/Stream] Cerebras error ${response.status}: ${await response.text()}`); return null; }
    console.log("[Chat/Stream] ✓ Cerebras streaming");
    return response;
  } catch (e) { console.error("[Chat/Stream] Cerebras exception:", e); return null; }
}

async function chatOllamaStream(messages: any[], apiKey: string): Promise<Response | null> {
  console.log("[Chat/Stream] Attempting Ollama cloud (gpt-oss:120b-cloud)…");
  try {
    const response = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss:120b-cloud", messages, stream: true }),
    });
    if (!response.ok) { console.error(`[Chat/Stream] Ollama error ${response.status}: ${await response.text()}`); return null; }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json") && !contentType.includes("octet-stream") && !contentType.includes("event-stream")) {
      console.error(`[Chat/Stream] Ollama unexpected content-type: "${contentType}"`); return null;
    }

    console.log("[Chat/Stream] ✓ Ollama streaming — transforming NDJSON → SSE");
    const reader  = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = ""; let chunkCount = 0;

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer.trim());
                const content = parsed.message?.content || "";
                if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
              } catch { /* ignore */ }
            }
            console.log(`[Chat/Stream] Ollama complete — ${chunkCount} chunks`);
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close(); return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n"); buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              const content = parsed.message?.content || "";
              if (content) { chunkCount++; controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)); }
            } catch { /* skip */ }
          }
        } catch (error) { console.error("[Chat/Stream] Ollama read error:", error); controller.error(error); }
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  } catch (e) { console.error("[Chat/Stream] Ollama exception:", e); return null; }
}

async function chatOpenRouterStream(messages: any[], apiKey: string): Promise<Response | null> {
  console.log("[Chat/Stream] Attempting OpenRouter (cerebras/gpt-oss-120b)…");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "cerebras/gpt-oss-120b", messages, stream: true }),
    });
    if (!response.ok) {
      if (response.status === 429) { console.error("[Chat/Stream] OpenRouter rate limit (429)"); return new Response(JSON.stringify({ error: "Rate limits exceeded" }), { status: 429 }); }
      if (response.status === 402) { console.error("[Chat/Stream] OpenRouter payment required (402)"); return new Response(JSON.stringify({ error: "Payment required" }), { status: 402 }); }
      console.error(`[Chat/Stream] OpenRouter error ${response.status}: ${await response.text()}`); return null;
    }
    console.log("[Chat/Stream] ✓ OpenRouter streaming");
    return response;
  } catch (e) { console.error("[Chat/Stream] OpenRouter exception:", e); return null; }
}

async function getStreamingResponse(messages: any[]): Promise<Response> {
  const cerebrasKey   = Deno.env.get("CEREBRAS_API_KEY");
  const ollamaKey     = Deno.env.get("OLLAMA_API_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

  if (cerebrasKey)   { const r = await chatCerebrasStream(messages, cerebrasKey);    if (r) return r; console.warn("[Chat/Stream] Cerebras failed — trying Ollama"); }
  if (ollamaKey)     { const r = await chatOllamaStream(messages, ollamaKey);        if (r) return r; console.warn("[Chat/Stream] Ollama failed — trying OpenRouter"); }
  if (openRouterKey) { const r = await chatOpenRouterStream(messages, openRouterKey); if (r) return r; }

  throw new Error("All streaming providers failed");
}

// ============================================================================
// Agentic loop
// ============================================================================

async function runAgenticLoop(messages: any[]): Promise<Response> {
  const tools = [CURRICULUM_SEARCH_TOOL];
  const MAX_TOOL_ROUNDS = 3;
  let workingMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent] Round ${round + 1}/${MAX_TOOL_ROUNDS} — non-streaming pass`);

    const completion = await chatNonStreaming(workingMessages, tools);
    if (!completion) throw new Error("All providers failed during agentic loop");

    const choice      = completion.choices?.[0];
    const message     = choice?.message;
    const finishReason = choice?.finish_reason;

    console.log(`[Agent] finish_reason: "${finishReason}"`);

    if (finishReason !== "tool_calls" || !message?.tool_calls?.length) {
      console.log("[Agent] No tool calls — proceeding to streaming answer");

      if (message?.content) {
        console.log("[Agent] Wrapping non-stream answer as SSE");
        const encoder = new TextEncoder();
        const content = message.content;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      return getStreamingResponse(workingMessages);
    }

    console.log(`[Agent] Model requested ${message.tool_calls.length} tool call(s)`);
    workingMessages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function?.name;
      const toolArgs = (() => {
        try { return JSON.parse(toolCall.function?.arguments ?? "{}"); }
        catch { console.error(`[Agent] Failed to parse args for "${toolName}"`); return {}; }
      })();
      const toolResult = await executeTool(toolName, toolArgs);
      workingMessages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
    }
  }

  console.warn(`[Agent] Hit MAX_TOOL_ROUNDS (${MAX_TOOL_ROUNDS}) — forcing final stream`);
  return getStreamingResponse(workingMessages);
}

// ============================================================================
// Rate limiting
// ============================================================================

async function enforceRateLimit(userId: string, supabaseAdmin: any): Promise<boolean> {
  const now = new Date(); const windowMs = 60 * 1000; const maxRequests = 20;

  const { data: rateLimit } = await supabaseAdmin.from("rate_limits").select("*").eq("user_id", userId).single();

  if (rateLimit) {
    const windowStart = new Date(rateLimit.window_start);
    const isWithinWindow = now.getTime() - windowStart.getTime() < windowMs;
    if (isWithinWindow) {
      if (rateLimit.request_count >= maxRequests) { console.warn(`[RateLimit] User ${userId} exceeded ${maxRequests} req/min`); return false; }
      await supabaseAdmin.from("rate_limits").update({ request_count: rateLimit.request_count + 1 }).eq("user_id", userId);
    } else {
      await supabaseAdmin.from("rate_limits").update({ request_count: 1, window_start: now.toISOString() }).eq("user_id", userId);
    }
  } else {
    await supabaseAdmin.from("rate_limits").insert({ user_id: userId, request_count: 1, window_start: now.toISOString() });
  }

  return true;
}

// ============================================================================
// Main handler
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestStart = Date.now();
  console.log(`[Request] ${req.method} ${req.url}`);

  try {
    const QDRANT_URL               = Deno.env.get("QDRANT_URL");
    const QDRANT_API_KEY           = Deno.env.get("QDRANT_API_KEY");
    const SUPABASE_URL             = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!QDRANT_URL)                throw new Error("QDRANT_URL not configured");
    if (!QDRANT_API_KEY)            throw new Error("QDRANT_API_KEY not configured");
    if (!SUPABASE_URL)              throw new Error("SUPABASE_URL not configured");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
      console.log(`[Auth] User: ${userId ?? "anonymous"}`);
    } else {
      console.log("[Auth] No Authorization header");
    }

    // Rate limit
    if (userId) {
      const allowed = await enforceRateLimit(userId, supabaseAdmin);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse body
    const { messages, userRole } = await req.json();
    const lastUserMessage = [...messages].filter((m: any) => m.role === "user").pop()?.content || "";
    console.log(`[Request] Role: ${userRole || "individual"} | History: ${messages.length} msgs | Query: "${lastUserMessage.slice(0, 100)}${lastUserMessage.length > 100 ? "…" : ""}"`);

    // Step 1: Embedding
    const embedStart = Date.now();
    const queryVector = await getEmbedding(lastUserMessage);
    console.log(`[Embedding] Completed in ${Date.now() - embedStart}ms`);

    // Step 2: RAG → curriculum alignment
    let alignment: CurriculumAlignment = { learningOutcomes: [], syllabusChunks: [], found: false };

    if (queryVector) {
      console.log(`[RAG] Searching Qdrant (limit: 18, threshold: ${SCORE_THRESHOLD})…`);
      const qdrantStart = Date.now();

      const qdrantResponse = await fetch(`${QDRANT_URL}/collections/amooti/points/search`, {
        method: "POST",
        headers: { "api-key": QDRANT_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ vector: queryVector, limit: 18, with_payload: true }),
      });

      if (qdrantResponse.ok) {
        const qdrantData = await qdrantResponse.json();
        const results: QdrantResult[] = qdrantData.result || [];
        const scores = results.map(r => r.score.toFixed(3)).join(", ");
        console.log(`[RAG] ✓ ${results.length} raw chunks in ${Date.now() - qdrantStart}ms | scores: [${scores}]`);
        alignment = parseCurriculumAlignment(results);
        const totalChars = alignment.syllabusChunks.join("").length;
        console.log(`[RAG/Align] Context size: ${totalChars} chars across ${alignment.syllabusChunks.length} chunks`);
      } else {
        console.error(`[RAG] Qdrant error ${qdrantResponse.status}: ${await qdrantResponse.text()}`);
      }
    } else {
      console.warn("[RAG] Skipping Qdrant — no embedding available");
    }

    // Step 3: Build system prompt
    const systemPrompt = buildSystemPrompt(alignment, userRole || "individual");
    console.log(`[Prompt] Built — ${systemPrompt.length} chars`);

    // Step 4: History strategy
    // School: current message only (no persistent student, avoid context bloat)
    // Student: full history (continuity across the session)
    const historyMessages = userRole === "school"
      ? [messages[messages.length - 1]]
      : messages;

    const fullMessages = [{ role: "system", content: systemPrompt }, ...historyMessages];
    console.log(`[Agent] Starting — ${fullMessages.length} messages (${userRole === "school" ? "school/current-only" : "student/full-history"})`);

    // Step 5: Agentic loop
    const agentStart = Date.now();
    const aiResponse = await runAgenticLoop(fullMessages);
    console.log(`[Agent] Complete in ${Date.now() - agentStart}ms | Total: ${Date.now() - requestStart}ms`);

    // Propagate provider errors
    const contentType = aiResponse.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const body = await aiResponse.text();
      console.error(`[Response] Provider error: ${body}`);
      return new Response(body, { status: aiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[Response] Streaming to client`);
    return new Response(aiResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (error) {
    console.error(`[Error] Unhandled after ${Date.now() - requestStart}ms:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
