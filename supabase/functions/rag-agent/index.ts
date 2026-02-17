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
  learningOutcomes: string[];
  syllabusChunks: string[];
  found: boolean;
}

// ============================================================================
// Score threshold
// ============================================================================

const SCORE_THRESHOLD = 0.45;

// ============================================================================
// Sanitize model output
//
// Fixes math delimiter drift and broken table output before it reaches
// the client. This is a runtime safety net — the model sometimes ignores
// prompt instructions about formatting.
// ============================================================================

function sanitizeMarkdown(text: string): string {
  // 1. Convert \[ ... \] display blocks → $$ ... $$
  text = text.replace(/\\\[\s*/g, "\n$$\n").replace(/\s*\\\]/g, "\n$$\n");

  // 2. Convert \( ... \) inline → $...$
  text = text.replace(/\\\(\s*/g, "$").replace(/\s*\\\)/g, "$");

  // 3. Convert bare [ formula ] lines that contain math characters
  //    Only targets lines that are purely a bracketed expression with \ or ^
  text = text.replace(
    /^\s*\[\s*((?:[^\[\]]*(?:\\|\^)[^\[\]]*)+)\s*\]\s*$/gm,
    "\n$$\n$1\n$$\n"
  );

  // 4. Strip any leftover stray \[ or \] on their own line
  text = text.replace(/^\s*\\\[\s*$/gm, "$$").replace(/^\s*\\\]\s*$/gm, "$$");

  // 5. Collapse 3+ consecutive blank lines → 2 (keeps output tidy)
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
}

// ============================================================================
// Parse curriculum alignment from Qdrant results
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

    if (!alignment.subject && meta?.subject) {
      alignment.subject    = meta.subject;
      alignment.level      = meta.level;
      alignment.term       = meta.term;
      alignment.topic      = meta.topic;
      alignment.competency = meta.competency;
      alignment.found      = true;
    }

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
// System prompt — UNCHANGED
// ============================================================================

function buildSystemPrompt(alignment: CurriculumAlignment, userRole: string): string {

  const level = alignment.level ?? "secondary school";
  const identity = `You are Amooti, a warm and encouraging AI study assistant for Uganda's secondary school students.
You have deep knowledge of all secondary school subjects. Your primary role is to explain things clearly, step by step, from foundations in language a student can follow.
You must connect topics that the student has already learnt even in other subjects.
Speak in a story format; like how you introduce things to children. Explore what makes that concept important; how are they likely to encounter that in future. Make learning fun and relatable.
`;

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

Your explanation must come from your own knowledge of the subject, pitched correctly
for a student working through this topic in the Uganda curriculum.`
    : ``;

  const answerRules = `
================================================================================
HOW TO ANSWER
================================================================================
Structure every answer like a good teacher would explain it in class:

Premise: highlight when they would have studied this and why eg: this topic is studied in biology of s2 because it builds on this topic and this other topic: to properly understand it you must be aware of this concept which we build on to understand this topic

1. Definition — Start with one plain sentence that directly answers what the student asked; and also hooks them, maybe with an example from real life where the concept is used.

2. Explanation (building the concept) — Develop the concept step by step; building from idea and concepts they already learnt in previous terms/classes and in other subjects. One clear idea per paragraph.
   Start from what the student already knows and build upward.
   Use everyday analogies for abstract ideas ("think of it like a dozen, but for atoms").

3. Demostration — For topics involving calculations or processes, walk through a worked example with real numbers. Show every step. Explain what you're doing at each step.
You should also connect with other subjects/topics where this is used;  referencing when they studied it and in which context.

4. Quiz — End with 3 short practice questions so the student can test themselves.
   Keep them at the right difficulty for.

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
• Keep length proportional to the question`;

  const toolInstruction = `
================================================================================
TOOL: search_curriculum
================================================================================
Use this when the syllabus above doesn't cover what you need — for example if the
student asks about a specific term or subtopic not shown above.
Parameters: query, subject, level, term, topic, content_type, limit.
Use sparingly — only when the initial context is genuinely insufficient.`;

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

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
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
// Stream a single provider request, returning the raw Response or null
// ============================================================================

async function fetchStream(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  label: string
): Promise<Response | null> {
  console.log(`[Stream] Attempting ${label}…`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Stream] ${label} error ${response.status}: ${text}`);
      // Propagate provider-level errors (rate limit, payment) directly
      if (response.status === 429 || response.status === 402) {
        return new Response(text, {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return null;
    }

    console.log(`[Stream] ✓ ${label} streaming`);
    return response;
  } catch (e) {
    console.error(`[Stream] ${label} exception:`, e);
    return null;
  }
}

// ============================================================================
// Transform Ollama NDJSON stream → SSE stream
// ============================================================================

function ollamaToSSE(response: Response): Response {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let chunkCount = 0;

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              const content = parsed.message?.content ?? "";
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
                );
              }
            } catch { /* ignore malformed trailing data */ }
          }
          console.log(`[Stream] Ollama complete — ${chunkCount} chunks`);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content ?? "";
            if (content) {
              chunkCount++;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
              );
            }
          } catch { /* skip malformed lines */ }
        }
      } catch (error) {
        console.error("[Stream] Ollama read error:", error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

// ============================================================================
// SSE stream → accumulate full text (for tool-call detection mid-stream)
// ============================================================================

async function accumulateSSE(response: Response): Promise<{
  content: string;
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> | null;
}> {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  // For accumulating streamed tool call deltas
  const toolCallAccumulators: Record<number, { id: string; name: string; arguments: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        // Accumulate text content
        if (delta.content) content += delta.content;

        // Accumulate tool call deltas
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallAccumulators[idx]) {
              toolCallAccumulators[idx] = { id: tc.id ?? "", name: "", arguments: "" };
            }
            if (tc.id)                        toolCallAccumulators[idx].id          = tc.id;
            if (tc.function?.name)             toolCallAccumulators[idx].name        += tc.function.name;
            if (tc.function?.arguments)        toolCallAccumulators[idx].arguments   += tc.function.arguments;
          }
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  const toolCallEntries = Object.values(toolCallAccumulators);
  const toolCalls = toolCallEntries.length > 0
    ? toolCallEntries.map(tc => ({
        id: tc.id,
        function: { name: tc.name, arguments: tc.arguments },
      }))
    : null;

  return { content, toolCalls };
}

// ============================================================================
// Get streaming response from providers (in priority order)
// ============================================================================

async function getStreamingResponse(
  messages: unknown[],
  tools?: unknown[],
): Promise<Response> {
  const cerebrasKey   = Deno.env.get("CEREBRAS_API_KEY");
  const ollamaKey     = Deno.env.get("OLLAMA_API_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

  const baseBody: Record<string, unknown> = { messages };
  if (tools?.length) {
    baseBody.tools = tools;
    baseBody.tool_choice = "auto";
  }

  // Cerebras
  if (cerebrasKey) {
    const r = await fetchStream(
      "https://api.cerebras.ai/v1/chat/completions",
      cerebrasKey,
      { ...baseBody, model: "gpt-oss-120b" },
      "Cerebras (gpt-oss-120b)"
    );
    if (r) return r;
    console.warn("[Stream] Cerebras failed — trying Ollama");
  }

  // Ollama — returns NDJSON, needs SSE transform
  if (ollamaKey) {
    const r = await fetchStream(
      "https://ollama.com/api/chat",
      ollamaKey,
      { ...baseBody, model: "gpt-oss:120b-cloud" },
      "Ollama (gpt-oss:120b-cloud)"
    );
    if (r) return ollamaToSSE(r);
    console.warn("[Stream] Ollama failed — trying OpenRouter");
  }

  // OpenRouter
  if (openRouterKey) {
    const r = await fetchStream(
      "https://openrouter.ai/api/v1/chat/completions",
      openRouterKey,
      { ...baseBody, model: "cerebras/gpt-oss-120b" },
      "OpenRouter (cerebras/gpt-oss-120b)"
    );
    if (r) return r;
  }

  throw new Error("All streaming providers failed");
}

// ============================================================================
// Agentic loop — streaming-only
//
// We stream every pass. If the model requests tool calls, we accumulate the
// stream to read the tool call arguments, execute the tools, then stream the
// final answer. No non-streaming pass needed.
// ============================================================================

async function runAgenticLoop(messages: unknown[]): Promise<Response> {
  const tools = [CURRICULUM_SEARCH_TOOL];
  const MAX_TOOL_ROUNDS = 3;
  let workingMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent] Round ${round + 1}/${MAX_TOOL_ROUNDS}`);

    const streamResponse = await getStreamingResponse(workingMessages, tools);

    // Propagate hard errors from providers immediately
    const contentType = streamResponse.headers.get("Content-Type") ?? "";
    if (!contentType.includes("event-stream") && !contentType.includes("octet-stream")) {
      console.error(`[Agent] Provider returned non-stream response — propagating`);
      return streamResponse;
    }

    // Accumulate the stream to check for tool calls
    const { content, toolCalls } = await accumulateSSE(streamResponse);

    if (!toolCalls || toolCalls.length === 0) {
      // No tool calls — sanitize the content and stream it to the client
      console.log(`[Agent] No tool calls on round ${round + 1} — streaming final answer`);
      const sanitized = sanitizeMarkdown(content);
      const encoder   = new TextEncoder();

      const finalStream = new ReadableStream({
        start(controller) {
          // Stream in chunks so the client sees progressive rendering
          const CHUNK_SIZE = 40;
          for (let i = 0; i < sanitized.length; i += CHUNK_SIZE) {
            const chunk = sanitized.slice(i, i + CHUNK_SIZE);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(finalStream, { headers: { "Content-Type": "text/event-stream" } });
    }

    // Tool calls found — execute them and continue the loop
    console.log(`[Agent] ${toolCalls.length} tool call(s) on round ${round + 1}`);

    workingMessages.push({
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.map((tc, i) => ({
        id: tc.id || `tool_${round}_${i}`,
        type: "function",
        function: tc.function,
      })),
    });

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      const toolArgs = (() => {
        try { return JSON.parse(tc.function.arguments ?? "{}"); }
        catch { console.error(`[Agent] Failed to parse args for "${toolName}"`); return {}; }
      })();

      const toolResult = await executeTool(toolName, toolArgs);
      workingMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolResult,
      });
    }
  }

  // Exceeded max rounds — stream the final answer without tools
  console.warn(`[Agent] Hit MAX_TOOL_ROUNDS (${MAX_TOOL_ROUNDS}) — streaming final answer without tools`);
  return getStreamingResponse(workingMessages);
}

// ============================================================================
// Rate limiting
// ============================================================================

async function enforceRateLimit(userId: string, supabaseAdmin: ReturnType<typeof createClient>): Promise<boolean> {
  const now        = new Date();
  const windowMs   = 60 * 1000;
  const maxRequests = 20;

  const { data: rateLimit } = await supabaseAdmin
    .from("rate_limits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (rateLimit) {
    const windowStart   = new Date(rateLimit.window_start);
    const isWithinWindow = now.getTime() - windowStart.getTime() < windowMs;

    if (isWithinWindow) {
      if (rateLimit.request_count >= maxRequests) {
        console.warn(`[RateLimit] User ${userId} exceeded ${maxRequests} req/min`);
        return false;
      }
      await supabaseAdmin
        .from("rate_limits")
        .update({ request_count: rateLimit.request_count + 1 })
        .eq("user_id", userId);
    } else {
      await supabaseAdmin
        .from("rate_limits")
        .update({ request_count: 1, window_start: now.toISOString() })
        .eq("user_id", userId);
    }
  } else {
    await supabaseAdmin
      .from("rate_limits")
      .insert({ user_id: userId, request_count: 1, window_start: now.toISOString() });
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
    const QDRANT_URL                = Deno.env.get("QDRANT_URL");
    const QDRANT_API_KEY            = Deno.env.get("QDRANT_API_KEY");
    const SUPABASE_URL              = Deno.env.get("SUPABASE_URL");
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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse body
    const { messages, userRole } = await req.json();
    const lastUserMessage = [...messages]
      .filter((m: { role: string }) => m.role === "user")
      .pop()?.content || "";

    console.log(
      `[Request] Role: ${userRole || "individual"} | ` +
      `History: ${messages.length} msgs | ` +
      `Query: "${lastUserMessage.slice(0, 100)}${lastUserMessage.length > 100 ? "…" : ""}"`
    );

    // Step 1: Embedding
    const embedStart  = Date.now();
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
        console.log(
          `[RAG] ✓ ${results.length} raw chunks in ${Date.now() - qdrantStart}ms | ` +
          `scores: [${scores}]`
        );
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
    const historyMessages = userRole === "school"
      ? [messages[messages.length - 1]]
      : messages;

    const fullMessages = [{ role: "system", content: systemPrompt }, ...historyMessages];
    console.log(
      `[Agent] Starting — ${fullMessages.length} messages ` +
      `(${userRole === "school" ? "school/current-only" : "student/full-history"})`
    );

    // Step 5: Agentic loop (streaming-only)
    const agentStart = Date.now();
    const aiResponse = await runAgenticLoop(fullMessages);
    console.log(`[Agent] Complete in ${Date.now() - agentStart}ms | Total: ${Date.now() - requestStart}ms`);

    return new Response(aiResponse.body, {
      status: aiResponse.status,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error(`[Error] Unhandled after ${Date.now() - requestStart}ms:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
